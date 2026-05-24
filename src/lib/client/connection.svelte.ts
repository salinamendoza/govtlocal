import { browser } from '$app/environment';

/**
 * Reactive connection state shared by all components. Tracks browser
 * online/offline plus last successful snapshot sync.
 *
 *   green  → online, fresh data (< STALE_SECONDS)
 *   yellow → online, data is stale (≥ STALE_SECONDS) or sync failing
 *   gray   → offline, using local mirror only
 */
const STALE_SECONDS = 5 * 60;

class ConnectionState {
  online = $state<boolean>(browser ? navigator.onLine : true);
  lastSyncAt = $state<number | null>(null);
  lastAttemptAt = $state<number | null>(null);
  syncing = $state<boolean>(false);
  lastSyncError = $state<string | null>(null);

  status = $derived<'green' | 'yellow' | 'gray'>(this.#computeStatus());

  #computeStatus(): 'green' | 'yellow' | 'gray' {
    if (!this.online) return 'gray';
    if (this.lastSyncAt == null) return 'yellow';
    const ageSec = Math.floor(Date.now() / 1000) - this.lastSyncAt;
    if (ageSec < STALE_SECONDS && !this.lastSyncError) return 'green';
    return 'yellow';
  }

  markOnline() {
    this.online = true;
  }
  markOffline() {
    this.online = false;
  }
  markSyncStart() {
    this.syncing = true;
    this.lastAttemptAt = Math.floor(Date.now() / 1000);
  }
  markSyncSuccess() {
    this.syncing = false;
    this.lastSyncAt = Math.floor(Date.now() / 1000);
    this.lastSyncError = null;
  }
  markSyncFailure(err: string) {
    this.syncing = false;
    this.lastSyncError = err;
  }
}

export const connection = new ConnectionState();
