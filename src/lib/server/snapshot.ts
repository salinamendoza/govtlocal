import type { D1Database } from '@cloudflare/workers-types';
import type { PublicEntry } from '$lib/types';
import { hydrateEntry } from './entries';

export interface HazardZone {
  id: string;
  geojson: unknown;
  severity: 'evacuate' | 'shelter_in_place' | 'advisory';
  message: string | null;
  updated_at: number;
}

export interface UpdatePost {
  id: string;
  headline: string;
  body: string | null;
  severity: 'info' | 'advisory' | 'urgent' | 'critical';
  posted_at: number;
}

export interface Snapshot {
  version: number;
  generated_at: number;
  entries: PublicEntry[];
  hazard_zones: HazardZone[];
  updates: UpdatePost[];
}

const MAX_UPDATES = 100;

export async function getSnapshotVersion(db: D1Database): Promise<number> {
  const row = await db
    .prepare('SELECT version FROM snapshot_version WHERE id = 1')
    .first<{ version: number }>();
  return row?.version ?? 1;
}

export async function bumpSnapshotVersion(db: D1Database): Promise<void> {
  await db.prepare('UPDATE snapshot_version SET version = version + 1 WHERE id = 1').run();
}

export async function getSnapshot(db: D1Database): Promise<Snapshot> {
  const [versionRow, entriesRes, hazardsRes, updatesRes] = await Promise.all([
    db.prepare('SELECT version FROM snapshot_version WHERE id = 1').first<{ version: number }>(),
    db
      .prepare(
        `SELECT id, kind, category, title, description, url, phone, address, city, zip,
                contact_name, contact_email, status, capacity_status, services,
                created_at, updated_at, approved_at
         FROM entries WHERE status = 'approved'
         ORDER BY created_at DESC`
      )
      .all(),
    db
      .prepare(
        `SELECT id, geojson, severity, message, updated_at
         FROM hazard_zones WHERE archived_at IS NULL
         ORDER BY updated_at DESC`
      )
      .all<{
        id: string;
        geojson: string;
        severity: HazardZone['severity'];
        message: string | null;
        updated_at: number;
      }>(),
    db
      .prepare(
        `SELECT id, headline, body, severity, posted_at
         FROM updates WHERE archived_at IS NULL
         ORDER BY posted_at DESC LIMIT ?`
      )
      .bind(MAX_UPDATES)
      .all<UpdatePost>()
  ]);

  const entries: PublicEntry[] = ((entriesRes.results ?? []) as Parameters<typeof hydrateEntry>[0][]).map(hydrateEntry);
  const hazard_zones: HazardZone[] = (hazardsRes.results ?? []).map((r) => ({
    id: r.id,
    severity: r.severity,
    message: r.message,
    updated_at: r.updated_at,
    geojson: safeParseJSON(r.geojson)
  }));
  const updates = (updatesRes.results ?? []) as UpdatePost[];

  return {
    version: versionRow?.version ?? 1,
    generated_at: Math.floor(Date.now() / 1000),
    entries,
    hazard_zones,
    updates
  };
}

function safeParseJSON(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
