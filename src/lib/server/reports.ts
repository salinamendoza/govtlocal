import type { D1Database } from '@cloudflare/workers-types';
import { now } from './db';

export type ReportType = 'need_help' | 'status_report' | 'resource_full' | 'other';

export interface IncomingReport {
  id: string; // client-generated UUID — idempotent
  type: ReportType;
  payload: unknown;
  client_timestamp?: number | null;
}

export interface UpsertResult {
  accepted: string[];
  rejected: { id: string; reason: string }[];
}

const ALLOWED_TYPES: readonly ReportType[] = [
  'need_help',
  'status_report',
  'resource_full',
  'other'
];

function isUuidish(id: string): boolean {
  return typeof id === 'string' && id.length >= 8 && id.length <= 64 && /^[A-Za-z0-9_-]+$/.test(id);
}

export async function upsertReports(
  db: D1Database,
  reports: IncomingReport[]
): Promise<UpsertResult> {
  const accepted: string[] = [];
  const rejected: { id: string; reason: string }[] = [];
  const t = now();

  const stmt = db.prepare(
    `INSERT INTO reports (id, type, payload, client_timestamp, received_at, status)
     VALUES (?, ?, ?, ?, ?, 'new')
     ON CONFLICT(id) DO NOTHING`
  );

  const ops = [];
  for (const r of reports) {
    if (!isUuidish(r.id)) {
      rejected.push({ id: String(r.id), reason: 'invalid id' });
      continue;
    }
    if (!ALLOWED_TYPES.includes(r.type)) {
      rejected.push({ id: r.id, reason: 'invalid type' });
      continue;
    }
    let payloadStr: string;
    try {
      payloadStr = JSON.stringify(r.payload ?? {});
    } catch {
      rejected.push({ id: r.id, reason: 'invalid payload' });
      continue;
    }
    if (payloadStr.length > 8 * 1024) {
      rejected.push({ id: r.id, reason: 'payload too large' });
      continue;
    }
    ops.push(stmt.bind(r.id, r.type, payloadStr, r.client_timestamp ?? null, t));
    accepted.push(r.id);
  }

  if (ops.length > 0) {
    await db.batch(ops);
  }

  return { accepted, rejected };
}
