import { fail, type Actions, type PageServerLoad } from '@sveltejs/kit';
import { getDB } from '$lib/server/db';
import { createEntry, listEntries, updateEntry, deleteEntry } from '$lib/server/entries';
import { quickAdd } from '$lib/server/quickAdd';
import { isValidCapacity, type CapacityStatus } from '$lib/capacity';
import type { EntryStatus, Kind } from '$lib/types';

const VALID_STATUS: readonly (EntryStatus | 'all')[] = [
  'pending', 'approved', 'rejected', 'archived', 'all'
];

const MAX_BULK_ITEMS = 20;
const BULLET_RE = /^\s*(?:[-*•]|\d+[.)])\s+(.*)$/;

/**
 * Split a paste into 1+ individual entries.
 * - Bullets (-, *, •, "1.", "1)") become separate items; any non-bullet
 *   preamble (e.g. "Hotlines:") is prepended to each so the AI keeps
 *   context.
 * - Otherwise, blocks separated by blank lines become items.
 * - Otherwise, the whole text is a single item.
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
  const blocks = text.split(/\n\s*\n+/).map((b) => b.trim()).filter(Boolean);
  if (blocks.length >= 2) return blocks;
  return [text.trim()];
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
  quickAdd: async ({ request, platform }) => {
    const db = getDB(platform);
    const form = await request.formData();
    const text = ((form.get('text') as string) ?? '').trim();
    const kindRaw = (form.get('kind') as string) ?? 'resource';
    const kind: Kind = kindRaw === 'donation' ? 'donation' : 'resource';

    if (!text) {
      return fail(400, { quickAdd: { error: 'Paste something first.', text, kind } });
    }
    if (!platform?.env.AI) {
      return fail(503, {
        quickAdd: {
          error: 'AI binding not available. Check wrangler.toml.',
          text,
          kind
        }
      });
    }

    const items = splitBulkPaste(text);
    if (items.length > MAX_BULK_ITEMS) {
      return fail(400, {
        quickAdd: {
          error: `That looks like ${items.length} entries — please paste in batches of ${MAX_BULK_ITEMS} or fewer.`,
          text,
          kind
        }
      });
    }

    // Single-entry path (most common). Preserves the original UX where
    // the success message links straight to the new entry's edit page.
    if (items.length === 1) {
      const result = await quickAdd(platform.env.AI, kind, items[0]);
      if (!result.ok) {
        return fail(400, { quickAdd: { error: result.error, text, kind } });
      }
      const entry = await createEntry(db, result.entry);
      return { quickAdd: { added: [{ id: entry.id, title: entry.title }], kind } };
    }

    // Bulk path. Run AI calls in parallel — small N, safe under any
    // reasonable Workers AI rate cap.
    const results = await Promise.all(
      items.map((it) => quickAdd(platform.env.AI!, kind, it))
    );

    const added: { id: string; title: string }[] = [];
    const failures: { source: string; error: string }[] = [];
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.ok) {
        const entry = await createEntry(db, r.entry);
        added.push({ id: entry.id, title: entry.title });
      } else {
        failures.push({
          source: items[i].slice(0, 80),
          error: r.error
        });
      }
    }

    return { quickAdd: { added, failures, kind, bulk: true } };
  }
};
