/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE_PREFIX = 'erd';
const STATIC_CACHE = `${CACHE_PREFIX}-static-${version}`;
const RUNTIME_CACHE = `${CACHE_PREFIX}-runtime-${version}`;

// Precache the build output and static files. SvelteKit gives us
// fingerprinted asset URLs in `build` and static asset URLs in `files`.
const PRECACHE_URLS = [...build, ...files];

sw.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  void sw.skipWaiting();
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith(CACHE_PREFIX) && k !== STATIC_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      );
      await sw.clients.claim();
    })()
  );
});

function isPrecached(url: URL): boolean {
  return PRECACHE_URLS.includes(url.pathname);
}

async function networkFirst(req: Request, cacheName: string, timeoutMs = 3000): Promise<Response> {
  const cache = await caches.open(cacheName);
  try {
    const network = await Promise.race([
      fetch(req),
      new Promise<Response>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), timeoutMs)
      )
    ]);
    if (network.ok) {
      cache.put(req, network.clone()).catch(() => {});
    }
    return network;
  } catch {
    const cached = await cache.match(req);
    if (cached) return cached;
    throw new Error('offline and no cache');
  }
}

async function cacheFirst(req: Request, cacheName: string): Promise<Response> {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  const network = await fetch(req);
  if (network.ok) cache.put(req, network.clone()).catch(() => {});
  return network;
}

sw.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== sw.location.origin) return;

  // Precached build artifacts — always cache-first.
  if (isPrecached(url)) {
    event.respondWith(cacheFirst(req, STATIC_CACHE));
    return;
  }

  // /api/snapshot — network-first with 3s timeout, fall back to cached
  // payload so the app boots even offline.
  if (url.pathname === '/api/snapshot') {
    event.respondWith(networkFirst(req, RUNTIME_CACHE));
    return;
  }

  // /api/entries — network-first, cache fallback. The IDB mirror is the
  // real offline source; this just helps when the SW intercepts before
  // the client falls back to IDB.
  if (url.pathname.startsWith('/api/entries')) {
    event.respondWith(networkFirst(req, RUNTIME_CACHE));
    return;
  }

  // /api/reports — never serve from cache. Outbox handles offline.
  if (url.pathname === '/api/reports') return;

  // HTML navigations — network-first so users get fresh server state
  // when online, cached shell when not.
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      (async () => {
        try {
          return await networkFirst(req, RUNTIME_CACHE);
        } catch {
          const cache = await caches.open(RUNTIME_CACHE);
          const fallback = (await cache.match('/help')) ?? (await cache.match('/'));
          if (fallback) return fallback;
          return new Response('Offline', { status: 503 });
        }
      })()
    );
  }
});

// Background Sync: drain the outbox by waking the active client and
// asking it to flush. The actual outbox lives in IndexedDB, so the
// page-side code is the source of truth — we just nudge it.
sw.addEventListener('sync', (event: ExtendableEvent & { tag?: string }) => {
  if (event.tag !== 'flush-outbox') return;
  event.waitUntil(
    (async () => {
      const clients = await sw.clients.matchAll({ type: 'window' });
      for (const c of clients) c.postMessage({ type: 'flush-outbox' });
    })()
  );
});
