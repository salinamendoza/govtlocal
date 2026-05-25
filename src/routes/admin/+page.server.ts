import { fail, type Actions, type PageServerLoad } from '@sveltejs/kit';
import { getDB } from '$lib/server/db';
import { createEntry, listEntries, updateEntry, deleteEntry } from '$lib/server/entries';
import { quickAdd } from '$lib/server/quickAdd';
import { validateEntrySubmission } from '$lib/server/validation';
import { isValidCapacity, type CapacityStatus } from '$lib/capacity';
import type { EntryInput, EntryStatus, Kind } from '$lib/types';

const VALID_STATUS: readonly (EntryStatus | 'all')[] = [
  'pending', 'approved', 'rejected', 'archived', 'all'
];

const MAX_BULK_ITEMS = 20;
const BULLET_RE = /^\s*(?:[-*•]|\d+[.)])\s+(.*)$/;

/**
 * Split a paste into 1+ individual entries.
 *
 * Only EXPLICIT bullet markers trigger bulk mode — blank lines between
 * paragraphs in a normal single-entry paste are not a signal.
 *
 * Non-bullet preamble (e.g. "Hotlines:") is prepended to each bullet
 * so the AI keeps the surrounding context.
 */
function splitBulkPaste(text: string): string[] {
  const lines = text.split(/\r?\n/);
  const bullets: string[] = [];
  const preamble: string[] = [];
  for (const line of lines) {
    const m = line.match(BULLET_RE);
    if (m) {
      bullets.push(m[1].trim());
    } else if (bullets.length === 0 && line.trim().length > 0) {
      preamble.push(line.trim());
    }
  }
  if (bullets.length >= 2) {
    const prefix = preamble.join(' ').replace(/[:\-—]\s*$/, '').trim();
    return bullets.map((b) => (prefix ? `${prefix}: ${b}` : b));
  }
  return [text.trim()];
}

/**
 * A draft is the AI's extraction PLUS the original source text. The
 * client persists drafts in localStorage and shows them to the admin
 * one at a time for review and edit before any DB write happens.
 */
export interface ParsedDraft {
  source: string;
  parsed: EntryInput | null;
  error?: string;
}

export const load: PageServerLoad = async ({ url, platform }) => {
  const db = getDB(platform);
  const rawKind = url.searchParams.get('kind');
  const kind: Kind = rawKind === 'donation' ? 'donation' : 'resource';
  const rawStatus = url.searchParams.get('status') as EntryStatus | 'all' | null;
  const status = rawStatus && VALID_STATUS.includes(rawStatus) ? rawStatus : 'pending';
  const query = url.searchParams.get('q') ?? undefined;

  const { items } = await listEntries(db, {
    kind,
    status,
    query,
    limit: 100
  });

  return { items, kind, status, query: query ?? '' };
};

export const actions: Actions = {
  approve: async ({ request, platform }) => {
    const db = getDB(platform);
    const id = (await request.formData()).get('id') as string | null;
    if (!id) return fail(400, { error: 'missing id' });
    await updateEntry(db, id, { status: 'approved' });
    return { ok: true };
  },
  reject: async ({ request, platform }) => {
    const db = getDB(platform);
    const id = (await request.formData()).get('id') as string | null;
    if (!id) return fail(400, { error: 'missing id' });
    await updateEntry(db, id, { status: 'rejected' });
    return { ok: true };
  },
  archive: async ({ request, platform }) => {
    const db = getDB(platform);
    const id = (await request.formData()).get('id') as string | null;
    if (!id) return fail(400, { error: 'missing id' });
    await updateEntry(db, id, { status: 'archived' });
    return { ok: true };
  },
  delete: async ({ request, platform }) => {
    const db = getDB(platform);
    const id = (await request.formData()).get('id') as string | null;
    if (!id) return fail(400, { error: 'missing id' });
    await deleteEntry(db, id);
    return { ok: true };
  },
  setCapacity: async ({ request, platform }) => {
    const db = getDB(platform);
    const form = await request.formData();
    const id = form.get('id') as string | null;
    const cap = form.get('capacity_status') as string | null;
    if (!id) return fail(400, { error: 'missing id' });
    if (!isValidCapacity(cap)) return fail(400, { error: 'invalid capacity' });
    await updateEntry(db, id, { capacity_status: cap as CapacityStatus });
    return { ok: true };
  },

  /**
   * Parse-only. Runs AI extraction on the pasted text (or each bullet)
   * and returns the drafts WITHOUT writing anything to the DB. The
   * client then walks the admin through each draft to confirm/edit/save.
   */
  parseQuick: async ({ request, platform }) => {
    const form = await request.formData();
    const text = ((form.get('text') as string) ?? '').trim();
    const kindRaw = (form.get('kind') as string) ?? 'resource';
    const kind: Kind = kindRaw === 'donation' ? 'donation' : 'resource';

    if (!text) {
      return fail(400, { parseQuick: { error: 'Paste something first.', text, kind } });
    }
    if (!platform?.env.AI) {
      return fail(503, {
        parseQuick: {
          error: 'AI binding not available. Check wrangler.toml.',
          text,
          kind
        }
      });
    }

    const items = splitBulkPaste(text);
    if (items.length > MAX_BULK_ITEMS) {
      return fail(400, {
        parseQuick: {
          error: `That looks like ${items.length} entries — please paste in batches of ${MAX_BULK_ITEMS} or fewer.`,
          text,
          kind
        }
      });
    }

    const results = await Promise.all(
      items.map((it) => quickAdd(platform.env.AI!, kind, it))
    );

    const drafts: ParsedDraft[] = results.map((r, i) => ({
      source: items[i],
      parsed: r.ok ? r.entry : null,
      error: r.ok ? undefined : r.error
    }));

    return { parseQuick: { drafts, kind } };
  },

  /**
   * The admin reviewed (and possibly edited) the form fields. Validate
   * exactly like a public submission would and create the entry.
   * No AI involvement at this step — the values are whatever the admin
   * confirmed.
   */
  commitDraft: async ({ request, platform }) => {
    const db = getDB(platform);
    const form = await request.formData();
    const kindRaw = (form.get('kind') as string) ?? 'resource';
    const kind: Kind = kindRaw === 'donation' ? 'donation' : 'resource';

    const result = validateEntrySubmission(form, kind);
    if (!result.ok) {
      return fail(400, {
        commitDraft: {
          errors: result.errors,
          values: result.values,
          kind
        }
      });
    }

    // Strip the EntryInput honeypot-shaped values to just what createEntry needs.
    const input: EntryInput = result.value;
    const entry = await createEntry(db, input);
    return {
      commitDraft: {
        committed: { id: entry.id, title: entry.title },
        kind
      }
    };
  }
};
