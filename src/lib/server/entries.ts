import { nanoid } from 'nanoid';
import type { D1Database } from '@cloudflare/workers-types';
import type {
  Entry,
  EntryInput,
  EntryStatus,
  ListEntriesOptions,
  ListResult
} from '$lib/types';
import type { CapacityStatus } from '$lib/capacity';
import { isValidCapacity } from '$lib/capacity';
import { parseServices, serializeServices, type ServiceTag } from '$lib/services';
import { isValidDateString, todayISO } from '$lib/expiration';
import { buildFtsQuery, escapeLike, now } from './db';
import { bumpSnapshotVersion } from './snapshot';

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;

const ENTRY_COLS = `
  id, kind, category, title, description, url, phone, address, city, zip,
  contact_name, contact_email, status, capacity_status, services, expires_at,
  created_at, updated_at, approved_at
`;

interface RawEntry extends Omit<Entry, 'services' | 'capacity_status' | 'expires_at'> {
  services: string;
  capacity_status: string;
  expires_at: string | null;
}

/** Convert a raw D1 row into a typed Entry. */
export function hydrateEntry(row: RawEntry): Entry {
  return {
    ...row,
    capacity_status: isValidCapacity(row.capacity_status)
      ? (row.capacity_status as CapacityStatus)
      : 'unknown',
    services: parseServices(row.services),
    expires_at: isValidDateString(row.expires_at) ? row.expires_at : null
  };
}

function normalize(raw: string | null | undefined): string | null {
  if (raw === undefined || raw === null) return null;
  const v = raw.trim();
  return v.length === 0 ? null : v;
}

export async function listEntries(
  db: D1Database,
  opts: ListEntriesOptions
): Promise<ListResult> {
  const limit = Math.min(opts.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const status = opts.status ?? 'approved';
  const q = opts.query?.trim() ?? '';

  const useFts = q.length >= 3;
  const useLike = q.length > 0 && q.length < 3;

  const params: unknown[] = [];
  const where: string[] = ['e.kind = ?'];
  params.push(opts.kind);

  if (status !== 'all') {
    where.push('e.status = ?');
    params.push(status);
  }

  if (opts.category) {
    where.push('e.category = ?');
    params.push(opts.category);
  }

  if (opts.service) {
    // services is stored as JSON like ["Meals","Showers"]; LIKE on the
    // quoted tag finds exact matches without false positives on prefixes.
    where.push(`e.services LIKE ? ESCAPE '\\'`);
    params.push(`%"${escapeLike(opts.service)}"%`);
  }

  if (opts.onlyExpired) {
    where.push('e.expires_at IS NOT NULL AND e.expires_at < ?');
    params.push(todayISO());
  } else if (!opts.includeExpired) {
    // Public default: hide already-expired rows. NULL expires_at means
    // no expiration and is kept.
    where.push('(e.expires_at IS NULL OR e.expires_at >= ?)');
    params.push(todayISO());
  }

  if (useFts) {
    const ftsQuery = buildFtsQuery(q);
    if (ftsQuery) {
      where.push('e.rowid IN (SELECT rowid FROM entries_fts WHERE entries_fts MATCH ?)');
      params.push(ftsQuery);
    }
  } else if (useLike) {
    const like = `%${escapeLike(q)}%`;
    where.push(`(e.title LIKE ? ESCAPE '\\' OR e.description LIKE ? ESCAPE '\\' OR e.city LIKE ? ESCAPE '\\')`);
    params.push(like, like, like);
  }

  if (opts.cursor != null) {
    where.push('e.created_at < ?');
    params.push(opts.cursor);
  }

  const sql = `
    SELECT ${ENTRY_COLS} FROM entries e
    WHERE ${where.join(' AND ')}
    ORDER BY e.created_at DESC
    LIMIT ?
  `;
  params.push(limit + 1);

  const res = await db
    .prepare(sql)
    .bind(...params)
    .all<RawEntry>();

  const rows = (res.results ?? []).map(hydrateEntry);
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1].created_at : null;

  return { items, nextCursor };
}

export async function getEntry(
  db: D1Database,
  id: string,
  opts: { includeUnapproved?: boolean } = {}
): Promise<Entry | null> {
  const row = await db
    .prepare(`SELECT ${ENTRY_COLS} FROM entries WHERE id = ?`)
    .bind(id)
    .first<RawEntry>();
  if (!row) return null;
  const hydrated = hydrateEntry(row);
  if (!opts.includeUnapproved && hydrated.status !== 'approved') return null;
  return hydrated;
}

export async function createEntry(
  db: D1Database,
  input: EntryInput
): Promise<Entry> {
  const id = nanoid(12);
  const t = now();

  const capacity: CapacityStatus = input.capacity_status ?? 'unknown';
  const servicesJson = serializeServices(input.services ?? []);
  const expires_at = isValidDateString(input.expires_at) ? input.expires_at : null;

  const entry: Entry = {
    id,
    kind: input.kind,
    category: input.category,
    title: input.title.trim(),
    description: input.description.trim(),
    url: normalize(input.url),
    phone: normalize(input.phone),
    address: normalize(input.address),
    city: normalize(input.city),
    zip: normalize(input.zip),
    contact_name: normalize(input.contact_name),
    contact_email: normalize(input.contact_email),
    status: 'pending',
    capacity_status: capacity,
    services: parseServices(servicesJson),
    expires_at,
    created_at: t,
    updated_at: t,
    approved_at: null
  };

  await db
    .prepare(
      `INSERT INTO entries (
        id, kind, category, title, description, url, phone, address, city, zip,
        contact_name, contact_email, status, capacity_status, services, expires_at,
        created_at, updated_at, approved_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    )
    .bind(
      entry.id,
      entry.kind,
      entry.category,
      entry.title,
      entry.description,
      entry.url,
      entry.phone,
      entry.address,
      entry.city,
      entry.zip,
      entry.contact_name,
      entry.contact_email,
      entry.status,
      entry.capacity_status,
      servicesJson,
      entry.expires_at,
      entry.created_at,
      entry.updated_at,
      entry.approved_at
    )
    .run();

  return entry;
}

const UPDATABLE_STRING_FIELDS = [
  'category',
  'title',
  'description',
  'url',
  'phone',
  'address',
  'city',
  'zip',
  'contact_name',
  'contact_email'
] as const;

type UpdatableStringField = (typeof UPDATABLE_STRING_FIELDS)[number];

export interface UpdateInput {
  category?: string;
  title?: string;
  description?: string;
  url?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  zip?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  status?: EntryStatus;
  capacity_status?: CapacityStatus;
  services?: ServiceTag[];
  expires_at?: string | null;
}

export async function updateEntry(
  db: D1Database,
  id: string,
  input: UpdateInput
): Promise<Entry | null> {
  const before = await getEntry(db, id, { includeUnapproved: true });
  if (!before) return null;

  const sets: string[] = [];
  const params: unknown[] = [];

  for (const field of UPDATABLE_STRING_FIELDS) {
    const v = input[field as UpdatableStringField];
    if (v === undefined) continue;
    sets.push(`${field} = ?`);
    params.push(typeof v === 'string' ? normalize(v) : v);
  }

  if (input.capacity_status !== undefined && isValidCapacity(input.capacity_status)) {
    sets.push('capacity_status = ?');
    params.push(input.capacity_status);
  }

  if (input.services !== undefined) {
    sets.push('services = ?');
    params.push(serializeServices(input.services));
  }

  if (input.expires_at !== undefined) {
    sets.push('expires_at = ?');
    params.push(isValidDateString(input.expires_at) ? input.expires_at : null);
  }

  if (input.status !== undefined) {
    sets.push('status = ?');
    params.push(input.status);
    if (input.status === 'approved') {
      sets.push('approved_at = ?');
      params.push(now());
    }
  }

  if (sets.length === 0) {
    return before;
  }

  sets.push('updated_at = ?');
  params.push(now());

  params.push(id);

  await db
    .prepare(`UPDATE entries SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...params)
    .run();

  const after = await getEntry(db, id, { includeUnapproved: true });

  // Bump snapshot version only if the change is visible to the public
  // snapshot (i.e. it involved an approved row before or after).
  const publicBefore = before.status === 'approved';
  const publicAfter = after?.status === 'approved';
  if (publicBefore || publicAfter) {
    await bumpSnapshotVersion(db);
  }

  return after;
}

export async function deleteEntry(db: D1Database, id: string): Promise<boolean> {
  const existing = await getEntry(db, id, { includeUnapproved: true });
  const res = await db.prepare('DELETE FROM entries WHERE id = ?').bind(id).run();
  const changed = (res.meta?.changes ?? 0) > 0;
  if (changed && existing?.status === 'approved') {
    await bumpSnapshotVersion(db);
  }
  return changed;
}

export async function approveEntry(db: D1Database, id: string) {
  return updateEntry(db, id, { status: 'approved' });
}

export async function rejectEntry(db: D1Database, id: string) {
  return updateEntry(db, id, { status: 'rejected' });
}
