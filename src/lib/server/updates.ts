import { nanoid } from 'nanoid';
import type { D1Database } from '@cloudflare/workers-types';
import { now } from './db';

export type UpdateSeverity = 'info' | 'advisory' | 'urgent' | 'critical';
export const UPDATE_SEVERITIES: readonly UpdateSeverity[] = [
  'info',
  'advisory',
  'urgent',
  'critical'
];

export interface UpdateRow {
  id: string;
  headline: string;
  body: string | null;
  severity: UpdateSeverity;
  posted_at: number;
  archived_at: number | null;
}

export async function listUpdates(
  db: D1Database,
  includeArchived = false
): Promise<UpdateRow[]> {
  const sql = includeArchived
    ? 'SELECT * FROM updates ORDER BY posted_at DESC'
    : 'SELECT * FROM updates WHERE archived_at IS NULL ORDER BY posted_at DESC';
  const res = await db.prepare(sql).all<UpdateRow>();
  return res.results ?? [];
}

export async function createUpdate(
  db: D1Database,
  input: { headline: string; body: string | null; severity: UpdateSeverity }
): Promise<string> {
  const id = nanoid(12);
  await db
    .prepare(
      `INSERT INTO updates (id, headline, body, severity, posted_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(id, input.headline, input.body, input.severity, now())
    .run();
  return id;
}

export async function archiveUpdate(db: D1Database, id: string): Promise<void> {
  await db
    .prepare('UPDATE updates SET archived_at = ? WHERE id = ?')
    .bind(now(), id)
    .run();
}

export async function unarchiveUpdate(db: D1Database, id: string): Promise<void> {
  await db.prepare('UPDATE updates SET archived_at = NULL WHERE id = ?').bind(id).run();
}
