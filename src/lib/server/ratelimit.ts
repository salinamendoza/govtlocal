import type { KVNamespace } from '@cloudflare/workers-types';

const WINDOW_SECONDS = 60 * 60; // 1 hour
const DEFAULT_LIMIT = 10;

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  limit: number;
}

/**
 * Per-IP sliding-ish counter using a KV key with a TTL of WINDOW_SECONDS.
 * Cheaper than D1 for hot writes, and the imprecision is acceptable for
 * abuse triage.
 */
export async function checkRateLimit(
  kv: KVNamespace,
  ip: string,
  limit = DEFAULT_LIMIT
): Promise<RateLimitResult> {
  const key = `rl:submit:${ip}`;
  const raw = await kv.get(key);
  const count = raw ? parseInt(raw, 10) || 0 : 0;

  if (count >= limit) {
    return { ok: false, remaining: 0, limit };
  }

  await kv.put(key, String(count + 1), { expirationTtl: WINDOW_SECONDS });
  return { ok: true, remaining: limit - count - 1, limit };
}
