import { browser } from '$app/environment';
import { applySnapshot, getMeta, setMeta } from './idb';
import { connection } from './connection.svelte';
import { flushOutbox } from './outbox';

let pollHandle: ReturnType<typeof setInterval> | null = null;
const POLL_INTERVAL_MS = 60_000;

type Listener = () => void;
const listeners = new Set<Listener>();

export function onSnapshotUpdated(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  for (const fn of listeners) {
    try {
      fn();
    } catch {
      // listeners are best-effort
    }
  }
}

/**
 * Fetch the latest snapshot if our local version is stale. Cheap when
 * up-to-date: server returns 304 with no body.
 */
export async function syncSnapshot(force = false): Promise<boolean> {
  if (!browser || !navigator.onLine) return false;
  connection.markSyncStart();
  try {
    const known = force ? null : await getMeta('snapshot_version');
    const url = new URL('/api/snapshot', window.location.origin);
    if (known != null) url.searchParams.set('since', String(known));

    const res = await fetch(url, {
      headers: known != null ? { 'if-none-match': `"v${known}"` } : {}
    });

    await setMeta('last_sync_attempt_at', Math.floor(Date.now() / 1000));

    if (res.status === 304) {
      connection.markSyncSuccess();
      return false;
    }
    if (!res.ok) throw new Error(`Snapshot fetch failed (${res.status})`);

    const snapshot = await res.json();
    await applySnapshot(snapshot);
    connection.markSyncSuccess();
    notify();
    return true;
  } catch (e) {
    connection.markSyncFailure(e instanceof Error ? e.message : 'sync failed');
    return false;
  }
}

/**
 * Wire up the sync lifecycle: initial sync, polling, online/offline
 * listeners, and outbox flush on reconnect.
 */
export function startSync(): void {
  if (!browser) return;
  const lastSyncAt = getMeta('last_sync_at');
  lastSyncAt.then((v) => {
    if (v != null) connection.lastSyncAt = v;
  });

  void syncSnapshot();
  void flushOutbox();

  if (pollHandle) clearInterval(pollHandle);
  pollHandle = setInterval(() => {
    void syncSnapshot();
    void flushOutbox();
  }, POLL_INTERVAL_MS);

  window.addEventListener('online', () => {
    connection.markOnline();
    void syncSnapshot();
    void flushOutbox();
  });
  window.addEventListener('offline', () => {
    connection.markOffline();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void syncSnapshot();
      void flushOutbox();
    }
  });
}
