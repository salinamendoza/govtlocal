import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { PublicEntry } from '$lib/types';
import type { HazardZone, UpdatePost } from '$lib/server/snapshot';

const DB_NAME = 'emergency-resource-directory';
const DB_VERSION = 1;

export interface OutboxItem {
  id: string;
  type: 'need_help' | 'status_report' | 'resource_full' | 'other';
  payload: unknown;
  client_timestamp: number;
  attempts: number;
  next_attempt_at: number;
  last_error: string | null;
}

export type MetaKey = 'snapshot_version' | 'last_sync_at' | 'last_sync_attempt_at';

interface Schema extends DBSchema {
  entries: {
    key: string;
    value: PublicEntry;
    indexes: {
      'by-kind': string;
      'by-category': string;
      'by-created': number;
    };
  };
  hazard_zones: {
    key: string;
    value: HazardZone;
  };
  updates: {
    key: string;
    value: UpdatePost;
    indexes: { 'by-posted': number };
  };
  outbox: {
    key: string;
    value: OutboxItem;
    indexes: { 'by-next-attempt': number };
  };
  meta: {
    key: MetaKey;
    value: { key: MetaKey; value: number };
  };
}

let dbp: Promise<IDBPDatabase<Schema>> | null = null;

export function getDB(): Promise<IDBPDatabase<Schema>> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB unavailable'));
  }
  if (!dbp) {
    dbp = openDB<Schema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('entries')) {
          const s = db.createObjectStore('entries', { keyPath: 'id' });
          s.createIndex('by-kind', 'kind');
          s.createIndex('by-category', 'category');
          s.createIndex('by-created', 'created_at');
        }
        if (!db.objectStoreNames.contains('hazard_zones')) {
          db.createObjectStore('hazard_zones', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('updates')) {
          const s = db.createObjectStore('updates', { keyPath: 'id' });
          s.createIndex('by-posted', 'posted_at');
        }
        if (!db.objectStoreNames.contains('outbox')) {
          const s = db.createObjectStore('outbox', { keyPath: 'id' });
          s.createIndex('by-next-attempt', 'next_attempt_at');
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      }
    });
  }
  return dbp;
}

export async function getMeta(key: MetaKey): Promise<number | null> {
  const db = await getDB();
  const row = await db.get('meta', key);
  return row?.value ?? null;
}

export async function setMeta(key: MetaKey, value: number): Promise<void> {
  const db = await getDB();
  await db.put('meta', { key, value });
}

/**
 * Replace the local mirror with the server snapshot. Done in a single
 * transaction so a torn write can't leave us with mixed versions.
 */
export async function applySnapshot(snapshot: {
  version: number;
  entries: PublicEntry[];
  hazard_zones: HazardZone[];
  updates: UpdatePost[];
}): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['entries', 'hazard_zones', 'updates', 'meta'], 'readwrite');
  await Promise.all([
    tx.objectStore('entries').clear(),
    tx.objectStore('hazard_zones').clear(),
    tx.objectStore('updates').clear()
  ]);
  for (const e of snapshot.entries) await tx.objectStore('entries').put(e);
  for (const h of snapshot.hazard_zones) await tx.objectStore('hazard_zones').put(h);
  for (const u of snapshot.updates) await tx.objectStore('updates').put(u);
  await tx.objectStore('meta').put({ key: 'snapshot_version', value: snapshot.version });
  await tx.objectStore('meta').put({ key: 'last_sync_at', value: Math.floor(Date.now() / 1000) });
  await tx.done;
}

/**
 * Read entries from IDB filtered by kind, optional category, and an
 * optional case-insensitive substring across title/description/city.
 * Linear scan — fine for the few hundred entries we expect.
 */
export async function queryEntries(opts: {
  kind: 'resource' | 'donation';
  category?: string | null;
  query?: string;
  limit?: number;
}): Promise<{ items: PublicEntry[]; total: number }> {
  const db = await getDB();
  const all = await db.getAllFromIndex('entries', 'by-kind', opts.kind);
  const q = (opts.query ?? '').trim().toLowerCase();
  const filtered = all
    .filter((e) => !opts.category || e.category === opts.category)
    .filter((e) => {
      if (!q) return true;
      return (
        e.title.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        (e.city?.toLowerCase().includes(q) ?? false) ||
        (Array.isArray(e.services) &&
          e.services.some((s) => s.toLowerCase().includes(q)))
      );
    })
    .sort((a, b) => b.created_at - a.created_at);

  const limit = opts.limit ?? 100;
  return { items: filtered.slice(0, limit), total: filtered.length };
}
