import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDB } from '$lib/server/db';
import { listEntries } from '$lib/server/entries';
import { computeETag } from '$lib/server/etag';
import { isValidCategory } from '$lib/categories';
import type { Kind } from '$lib/types';

export const GET: RequestHandler = async ({ url, platform, request }) => {
  const db = getDB(platform);

  const kind = url.searchParams.get('kind');
  if (kind !== 'resource' && kind !== 'donation') {
    throw error(400, 'kind must be "resource" or "donation"');
  }

  const rawCat = url.searchParams.get('cat');
  const category =
    rawCat && isValidCategory(kind as Kind, rawCat) ? rawCat : undefined;

  const query = url.searchParams.get('q') ?? undefined;

  const limitRaw = url.searchParams.get('limit');
  const limit = limitRaw ? Math.max(1, Math.min(100, parseInt(limitRaw, 10) || 24)) : undefined;

  const cursorRaw = url.searchParams.get('cursor');
  const cursor = cursorRaw ? parseInt(cursorRaw, 10) || null : null;

  const result = await listEntries(db, {
    kind: kind as Kind,
    category,
    query,
    status: 'approved',
    limit,
    cursor
  });

  const etag = computeETag(result.items, result.nextCursor);
  const ifNoneMatch = request.headers.get('if-none-match');

  const headers = {
    etag,
    'cache-control': 'public, max-age=10, s-maxage=30, stale-while-revalidate=60',
    vary: 'Accept-Encoding'
  };

  if (ifNoneMatch && ifNoneMatch === etag) {
    return new Response(null, { status: 304, headers });
  }

  return json(result, { headers });
};
