import { browser } from '$app/environment';
import { getDB, type OutboxItem } from './idb';

export type ReportType = OutboxItem['type'];

const MAX_BATCH = 25;
const MAX_BACKOFF_MS = 5 * 60 * 1000;

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'r_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function backoffMs(attempts: number): number {
  return Math.min(2 ** attempts * 1000, MAX_BACKOFF_MS);
}

/**
 * Queue a resident report locally. Returns the client UUID, which the
 * caller can show to the user as a receipt. The server upserts by id,
 * so retries are idempotent.
 */
export async function enqueueReport(input: {
  type: ReportType;
  payload: unknown;
}): Promise<string> {
  const db = await getDB();
  const now = Date.now();
  const item: OutboxItem = {
    id: uuid(),
    type: input.type,
    payload: input.payload,
    client_timestamp: Math.floor(now / 1000),
    attempts: 0,
    next_attempt_at: now,
    last_error: null
  };
  await db.put('outbox', item);

  // Try Background Sync if supported, else best-effort immediate flush.
  if (
    'serviceWorker' in navigator &&
    'SyncManager' in self &&
    navigator.serviceWorker.controller
  ) {
    try {
      const reg = await navigator.serviceWorker.ready;
      // @ts-expect-error background sync typings are incomplete in lib.dom
      await reg.sync.register('flush-outbox');
    } catch {
      void flushOutbox();
    }
  } else {
    void flushOutbox();
  }
  return item.id;
}

export async function pendingCount(): Promise<number> {
  if (!browser) return 0;
  const db = await getDB();
  return db.count('outbox');
}

/**
 * Send queued reports in batches. Successful items are removed; failed
 * items get an attempt count + exponential backoff stamped on them so
 * the next poll skips them until their next_attempt_at is reached.
 */
export async function flushOutbox(): Promise<{ sent: number; remaining: number }> {
  if (!browser || !navigator.onLine) {
    return { sent: 0, remaining: await pendingCount() };
  }

  const db = await getDB();
  const all = await db.getAll('outbox');
  const due = all.filter((i) => i.next_attempt_at <= Date.now()).slice(0, MAX_BATCH);

  if (due.length === 0) return { sent: 0, remaining: all.length };

  try {
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        submissions: due.map((i) => ({
          id: i.id,
          type: i.type,
          payload: i.payload,
          client_timestamp: i.client_timestamp
        }))
      })
    });

    if (!res.ok) throw new Error(`Reports POST failed (${res.status})`);
    const data = (await res.json()) as { accepted: string[]; rejected: { id: string; reason: string }[] };

    const tx = db.transaction('outbox', 'readwrite');
    const store = tx.objectStore('outbox');
    const acceptedSet = new Set(data.accepted);
    const rejectedSet = new Set(data.rejected.map((r) => r.id));
    for (const item of due) {
      if (acceptedSet.has(item.id) || rejectedSet.has(item.id)) {
        // Rejected reports are server-side validation failures; no point
        // retrying them either. Surface via console for now.
        if (rejectedSet.has(item.id)) {
          // eslint-disable-next-line no-console
          console.warn('Report rejected', item.id);
        }
        await store.delete(item.id);
      } else {
        const attempts = item.attempts + 1;
        await store.put({
          ...item,
          attempts,
          next_attempt_at: Date.now() + backoffMs(attempts),
          last_error: 'not acknowledged'
        });
      }
    }
    await tx.done;

    return { sent: data.accepted.length, remaining: await db.count('outbox') };
  } catch (e) {
    const tx = db.transaction('outbox', 'readwrite');
    const store = tx.objectStore('outbox');
    for (const item of due) {
      const attempts = item.attempts + 1;
      await store.put({
        ...item,
        attempts,
        next_attempt_at: Date.now() + backoffMs(attempts),
        last_error: e instanceof Error ? e.message : 'network error'
      });
    }
    await tx.done;
    return { sent: 0, remaining: await db.count('outbox') };
  }
}
