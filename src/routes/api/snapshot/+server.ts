import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDB } from '$lib/server/db';
import { getSnapshot, getSnapshotVersion } from '$lib/server/snapshot';

export const GET: RequestHandler = async ({ platform, request, url }) => {
  const db = getDB(platform);

  // Cheap fast path: client sends its known version. If unchanged, 304.
  const known = url.searchParams.get('since');
  const ifNoneMatch = request.headers.get('if-none-match');

  const headers: Record<string, string> = {
    'cache-control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=300',
    vary: 'Accept-Encoding'
  };

  if (known) {
    const current = await getSnapshotVersion(db);
    headers.etag = `"v${current}"`;
    if (parseInt(known, 10) === current) {
      return new Response(null, { status: 304, headers });
    }
  } else if (ifNoneMatch) {
    const current = await getSnapshotVersion(db);
    headers.etag = `"v${current}"`;
    if (ifNoneMatch === `"v${current}"`) {
      return new Response(null, { status: 304, headers });
    }
  }

  const snapshot = await getSnapshot(db);
  headers.etag = `"v${snapshot.version}"`;
  return json(snapshot, { headers });
};
