import type { PublicEntry } from '$lib/types';

/**
 * FNV-1a 32-bit hash. Not cryptographic — we just need a stable,
 * cheap fingerprint of the result set for ETag revalidation.
 */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * Computes a weak ETag from the (id, updated_at) of each row plus the
 * cursor. Identical lists → identical ETag, so the client can revalidate
 * with a 304 instead of pulling the full payload.
 */
export function computeETag(items: PublicEntry[], nextCursor: number | null): string {
  const fingerprint = items.map((e) => `${e.id}:${e.updated_at}`).join('|');
  return `W/"${fnv1a(fingerprint)}-${items.length}-${nextCursor ?? 0}"`;
}
