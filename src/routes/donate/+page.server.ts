import type { PageServerLoad } from './$types';
import { getDB } from '$lib/server/db';
import { listEntries } from '$lib/server/entries';
import { isValidCategory } from '$lib/categories';

export const load: PageServerLoad = async ({ url, platform }) => {
  const db = getDB(platform);
  const rawCat = url.searchParams.get('cat');
  const category = rawCat && isValidCategory('donation', rawCat) ? rawCat : undefined;
  const query = url.searchParams.get('q') ?? undefined;

  const { items, nextCursor } = await listEntries(db, {
    kind: 'donation',
    category,
    query,
    status: 'approved'
  });

  return { items, nextCursor };
};
