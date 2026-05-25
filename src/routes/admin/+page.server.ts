import { fail, type Actions, type PageServerLoad } from '@sveltejs/kit';
import { getDB } from '$lib/server/db';
import { createEntry, getEntry, listEntries, updateEntry, deleteEntry } from '$lib/server/entries';
import { quickAdd, type ExistingEntryHint } from '$lib/server/quickAdd';
import { validateEntrySubmission } from '$lib/server/validation';
import { isValidCapacity, type CapacityStatus } from '$lib/capacity';
import type { EntryInput, EntryStatus, Kind } from '$lib/types';

/** "expired" is a synthetic filter: approved rows whose expires_at is past. */
type AdminStatusFilter = EntryStatus | 'all' | 'expired';
const VALID_STATUS: readonly AdminStatusFilter[] = [
  'pending', 'approved', 'rejected', 'archived', 'all', 'expired'
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
  /** When set, the draft is an UPDATE to an existing entry rather than a create. */
  updateId?: string;
  /** Display-only hint of what's being updated. */
  updateTitle?: string;
  error?: string;
}

const MAX_EXISTING_HINTS = 100;

export const load: PageServerLoad = async ({ url, platform }) => {
  const db = getDB(platform);
  const rawKind = url.searchParams.get('kind');
  const kind: Kind = rawKind === 'donation' ? 'donation' : 'resource';
  const rawStatus = url.searchParams.get('status') as AdminStatusFilter | null;
  const status: AdminStatusFilter =
    rawStatus && VALID_STATUS.includes(rawStatus) ? rawStatus : 'pending';
  const query = url.searchParams.get('q') ?? undefined;

  // Admin views always include expired rows. The "expired" status filter
  // additionally restricts to only-expired (and treats them as approved).
  const listStatus: EntryStatus | 'all' =
    status === 'expired' ? 'approved' : status === 'all' ? 'all' : status;

  const { items } = await listEntries(db, {
    kind,
    status: listStatus,
    query,
    includeExpired: true,
    onlyExpired: status === 'expired',
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
    const db = getDB(platform);
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

    // Hand the AI the list of existing entries (this kind, approved or
    // pending) so it can detect "this is an UPDATE to that one" instead
    // of always creating new.
    const { items: existingEntries } = await listEntries(db, {
      kind,
      status: 'all',
      includeExpired: true,
      limit: MAX_EXISTING_HINTS
    });
    const hintMap = new Map(existingEntries.map((e) => [e.id, e]));
    const hints: ExistingEntryHint[] = existingEntries.map((e) => ({
      id: e.id,
      title: e.title,
      city: e.city
    }));

    const results = await Promise.all(
      items.map((it) => quickAdd(platform.env.AI!, kind, it, hints))
    );

    const drafts: ParsedDraft[] = results.map((r, i) => {
      if (!r.ok) {
        return { source: items[i], parsed: null, error: r.error };
      }
      // If the AI matched an existing entry, merge: start from the
      // existing values and overlay anything the AI extracted as non-null.
      if (r.updateId) {
        const base = hintMap.get(r.updateId);
        if (base) {
          const merged: EntryInput = {
            kind: base.kind,
            title: r.entry.title || base.title,
            description: r.entry.description || base.description,
            category: r.entry.category || base.category,
            capacity_status: r.entry.capacity_status ?? base.capacity_status,
            services: Array.from(
              new Set([...(base.services ?? []), ...(r.entry.services ?? [])])
            ),
            expires_at: r.entry.expires_at ?? base.expires_at,
            city: r.entry.city ?? base.city,
            zip: r.entry.zip ?? base.zip,
            address: r.entry.address ?? base.address,
            phone: r.entry.phone ?? base.phone,
            url: r.entry.url ?? base.url,
            contact_name: r.entry.contact_name ?? base.contact_name,
            contact_email: r.entry.contact_email ?? base.contact_email
          };
          return {
            source: items[i],
            parsed: merged,
            updateId: r.updateId,
            updateTitle: base.title
          };
        }
      }
      return { source: items[i], parsed: r.entry };
    });

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
    const updateId = (form.get('updateId') as string | null) || null;

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

    const input: EntryInput = result.value;

    if (updateId) {
      const existing = await getEntry(db, updateId, { includeUnapproved: true });
      if (!existing) {
        return fail(404, {
          commitDraft: {
            errors: { _form: 'Entry to update no longer exists.' },
            values: result.values,
            kind
          }
        });
      }
      const updated = await updateEntry(db, updateId, {
        title: input.title,
        description: input.description,
        category: input.category,
        capacity_status: input.capacity_status,
        services: input.services,
        expires_at: input.expires_at,
        city: input.city,
        zip: input.zip,
        address: input.address,
        phone: input.phone,
        url: input.url,
        contact_name: input.contact_name,
        contact_email: input.contact_email
      });
      return {
        commitDraft: {
          committed: { id: updateId, title: updated?.title ?? input.title },
          updated: true,
          kind
        }
      };
    }

    const entry = await createEntry(db, input);
    return {
      commitDraft: {
        committed: { id: entry.id, title: entry.title },
        kind
      }
    };
  }
};
