import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDB } from '$lib/server/db';
import { upsertReports, type IncomingReport } from '$lib/server/reports';

const MAX_BATCH = 50;

export const POST: RequestHandler = async ({ request, platform, getClientAddress }) => {
  const db = getDB(platform);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Invalid JSON');
  }

  if (
    !body ||
    typeof body !== 'object' ||
    !Array.isArray((body as { submissions?: unknown }).submissions)
  ) {
    throw error(400, 'Expected { submissions: [...] }');
  }

  const submissions = (body as { submissions: IncomingReport[] }).submissions;
  if (submissions.length === 0) {
    return json({ accepted: [], rejected: [] });
  }
  if (submissions.length > MAX_BATCH) {
    throw error(413, `Batch too large (max ${MAX_BATCH})`);
  }

  const ip = (() => {
    try {
      return getClientAddress();
    } catch {
      return null;
    }
  })();

  const result = await upsertReports(db, submissions, ip);
  return json(result);
};
