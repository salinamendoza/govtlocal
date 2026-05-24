import type { PublicEntry } from '$lib/types';

export interface CachedPage {
  items: PublicEntry[];
  nextCursor: number | null;
  etag: string | null;
  fetchedAt: number;
}

export type CacheKey = string;

export function makeKey(kind: string, cat: string | null, q: string): CacheKey {
  return `${kind}|${cat ?? ''}|${q.trim().toLowerCase()}`;
}

/**
 * In-memory cache of list results, keyed by (kind, cat, q). Lives for the
 * lifetime of the page — survives navigations between /help and /donate
 * because the layout doesn't remount.
 *
 * Designed for on-the-ground use on crowded wifi: pair with ETag
 * revalidation so a repeat filter paints instantly from this cache while
 * we confirm freshness with a header-only 304 in the background.
 */
const store = new Map<CacheKey, CachedPage>();

export function get(key: CacheKey): CachedPage | undefined {
  return store.get(key);
}

export function set(key: CacheKey, value: CachedPage): void {
  store.set(key, value);
}

export function clear(): void {
  store.clear();
}
