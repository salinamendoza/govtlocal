import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDB } from '$lib/server/db';
import { upsertReports, type IncomingReport } from '$lib/server/reports';
import { checkRateLimit } from '$lib/server/ratelimit';
import {
  MAX_REPORT_BYTES,
  clientIp,
  ipHash,
  payloadTooLarge
} from '$lib/server/abuse';

const MAX_BATCH = 50;
const REPORTS_PER_HOUR = 60;

export const POST: RequestHandler = async ({ request, platform, getClientAddress }) => {
  const db = getDB(platform);

  if (payloadTooLarge(request, MAX_REPORT_BYTES * MAX_BATCH)) {
    throw error(413, 'Payload too large');
  }

  const ip = clientIp(getClientAddress);
  const ipKey = await ipHash(ip, platform?.env.IP_HASH_PEPPER);
  if (ipKey && platform?.env.RATELIMIT) {
    const rl = await checkRateLimit(platform.env.RATELIMIT, `rep:${ipKey}`, REPORTS_PER_HOUR);
    if (!rl.ok) {
      throw error(429, 'Too many reports — try again later');
    }
  }

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

  const result = await upsertReports(db, submissions);
  return json(result);
};
