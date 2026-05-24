import { fail, type Actions, type PageServerLoad } from '@sveltejs/kit';
import { getDB } from '$lib/server/db';
import { createEntry, listEntries, updateEntry, deleteEntry } from '$lib/server/entries';
import { quickAdd } from '$lib/server/quickAdd';
import type { EntryStatus, Kind } from '$lib/types';

const VALID_STATUS: readonly (EntryStatus | 'all')[] = [
  'pending', 'approved', 'rejected', 'archived', 'all'
];

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

    const result = await quickAdd(platform.env.AI, kind, text);
    if (!result.ok) {
      return fail(400, { quickAdd: { error: result.error, text, kind } });
    }

    const entry = await createEntry(db, result.entry);
    return { quickAdd: { added: { id: entry.id, title: entry.title, kind } } };
  }
};
