import type { PageServerLoad } from './$types';
import { getDB } from '$lib/server/db';
import { listEntries, getActiveCategories } from '$lib/server/entries';
import { isValidCategory } from '$lib/categories';

export const load: PageServerLoad = async ({ url, platform }) => {
  const db = getDB(platform);
  const rawCat = url.searchParams.get('cat');
  const category = rawCat && isValidCategory('resource', rawCat) ? rawCat : undefined;
  const query = url.searchParams.get('q') ?? undefined;

  const [{ items, nextCursor }, activeCategories] = await Promise.all([
    listEntries(db, {
      kind: 'resource',
      category,
      query,
      status: 'approved'
    }),
    getActiveCategories(db, 'resource')
  ]);

  return { items, nextCursor, activeCategories };
};
