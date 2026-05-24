import { nanoid } from 'nanoid';
import type { D1Database } from '@cloudflare/workers-types';
import type {
  Entry,
  EntryInput,
  EntryStatus,
  ListEntriesOptions,
  ListResult,
  PublicEntry
} from '$lib/types';
import { buildFtsQuery, escapeLike, now } from './db';

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;

function stripIp(e: Entry): PublicEntry {
  const { submitter_ip: _ip, ...rest } = e;
  return rest;
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

  let sql: string;
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

  sql = `
    SELECT e.* FROM entries e
    WHERE ${where.join(' AND ')}
    ORDER BY e.created_at DESC
    LIMIT ?
  `;
  params.push(limit + 1);

  const res = await db
    .prepare(sql)
    .bind(...params)
    .all<Entry>();

  const rows = res.results ?? [];
  const hasMore = rows.length > limit;
  const items = (hasMore ? rows.slice(0, limit) : rows).map(stripIp);
  const nextCursor = hasMore ? items[items.length - 1].created_at : null;

  return { items, nextCursor };
}

export async function getEntry(
  db: D1Database,
  id: string,
  opts: { includeUnapproved?: boolean } = {}
): Promise<Entry | null> {
  const row = await db
    .prepare('SELECT * FROM entries WHERE id = ?')
    .bind(id)
    .first<Entry>();
  if (!row) return null;
  if (!opts.includeUnapproved && row.status !== 'approved') return null;
  return row;
}

export async function createEntry(
  db: D1Database,
  input: EntryInput,
  submitterIp: string | null
): Promise<Entry> {
  const id = nanoid(12);
  const t = now();

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
    submitter_ip: submitterIp,
    created_at: t,
    updated_at: t,
    approved_at: null
  };

  await db
    .prepare(
      `INSERT INTO entries (
        id, kind, category, title, description, url, phone, address, city, zip,
        contact_name, contact_email, status, submitter_ip,
        created_at, updated_at, approved_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
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
      entry.submitter_ip,
      entry.created_at,
      entry.updated_at,
      entry.approved_at
    )
    .run();

  return entry;
}

const UPDATABLE_FIELDS = [
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

type UpdatableField = (typeof UPDATABLE_FIELDS)[number];

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
}

export async function updateEntry(
  db: D1Database,
  id: string,
  input: UpdateInput
): Promise<Entry | null> {
  const sets: string[] = [];
  const params: unknown[] = [];

  for (const field of UPDATABLE_FIELDS) {
    const v = input[field as UpdatableField];
    if (v === undefined) continue;
    sets.push(`${field} = ?`);
    params.push(typeof v === 'string' ? normalize(v) : v);
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
    return getEntry(db, id, { includeUnapproved: true });
  }

  sets.push('updated_at = ?');
  params.push(now());

  params.push(id);

  await db
    .prepare(`UPDATE entries SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...params)
    .run();

  return getEntry(db, id, { includeUnapproved: true });
}

export async function deleteEntry(db: D1Database, id: string): Promise<boolean> {
  const res = await db.prepare('DELETE FROM entries WHERE id = ?').bind(id).run();
  return (res.meta?.changes ?? 0) > 0;
}

export async function approveEntry(db: D1Database, id: string) {
  return updateEntry(db, id, { status: 'approved' });
}

export async function rejectEntry(db: D1Database, id: string) {
  return updateEntry(db, id, { status: 'rejected' });
}
