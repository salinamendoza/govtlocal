import { nanoid } from 'nanoid';
import type { D1Database } from '@cloudflare/workers-types';
import { now } from './db';
import type { HazardSeverity } from '$lib/hazards';

export type { HazardSeverity } from '$lib/hazards';
export { HAZARD_SEVERITIES } from '$lib/hazards';

export interface HazardRow {
  id: string;
  geojson: string;
  severity: HazardSeverity;
  message: string | null;
  updated_at: number;
  archived_at: number | null;
}

export async function listHazards(
  db: D1Database,
  includeArchived = false
): Promise<HazardRow[]> {
  const sql = includeArchived
    ? 'SELECT * FROM hazard_zones ORDER BY updated_at DESC'
    : 'SELECT * FROM hazard_zones WHERE archived_at IS NULL ORDER BY updated_at DESC';
  const res = await db.prepare(sql).all<HazardRow>();
  return res.results ?? [];
}

export async function getHazard(db: D1Database, id: string): Promise<HazardRow | null> {
  return (await db.prepare('SELECT * FROM hazard_zones WHERE id = ?').bind(id).first<HazardRow>()) ?? null;
}

export async function createHazard(
  db: D1Database,
  input: { geojson: string; severity: HazardSeverity; message: string | null }
): Promise<string> {
  const id = nanoid(12);
  await db
    .prepare(
      `INSERT INTO hazard_zones (id, geojson, severity, message, updated_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(id, input.geojson, input.severity, input.message, now())
    .run();
  return id;
}

export async function updateHazard(
  db: D1Database,
  id: string,
  input: { geojson?: string; severity?: HazardSeverity; message?: string | null; archived?: boolean }
): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (input.geojson !== undefined) {
    sets.push('geojson = ?');
    params.push(input.geojson);
  }
  if (input.severity !== undefined) {
    sets.push('severity = ?');
    params.push(input.severity);
  }
  if (input.message !== undefined) {
    sets.push('message = ?');
    params.push(input.message);
  }
  if (input.archived !== undefined) {
    sets.push('archived_at = ?');
    params.push(input.archived ? now() : null);
  }
  if (sets.length === 0) return;
  sets.push('updated_at = ?');
  params.push(now());
  params.push(id);
  await db.prepare(`UPDATE hazard_zones SET ${sets.join(', ')} WHERE id = ?`).bind(...params).run();
}
