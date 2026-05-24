import type { D1Database } from '@cloudflare/workers-types';

export type ReportStatus = 'new' | 'triaged' | 'resolved' | 'dismissed';
export const REPORT_STATUSES: readonly ReportStatus[] = ['new', 'triaged', 'resolved', 'dismissed'];

export interface ReportRow {
  id: string;
  type: string;
  payload: string;
  client_timestamp: number | null;
  received_at: number;
  status: ReportStatus;
}

export async function listReports(
  db: D1Database,
  status: ReportStatus | 'all' = 'new',
  limit = 200
): Promise<ReportRow[]> {
  const sql =
    status === 'all'
      ? 'SELECT * FROM reports ORDER BY received_at DESC LIMIT ?'
      : 'SELECT * FROM reports WHERE status = ? ORDER BY received_at DESC LIMIT ?';
  const stmt =
    status === 'all'
      ? db.prepare(sql).bind(limit)
      : db.prepare(sql).bind(status, limit);
  const res = await stmt.all<ReportRow>();
  return res.results ?? [];
}

export async function setReportStatus(
  db: D1Database,
  id: string,
  status: ReportStatus
): Promise<void> {
  await db.prepare('UPDATE reports SET status = ? WHERE id = ?').bind(status, id).run();
}
