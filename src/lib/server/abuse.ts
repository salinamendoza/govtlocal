/**
 * Abuse defenses applied at the route layer.
 *
 * Privacy posture: we never persist a submitter IP. To still get
 * meaningful per-source rate limiting, we derive a short-lived key from
 * HMAC-SHA256(ip, IP_HASH_PEPPER) and store *that* in KV with a TTL.
 * The KV entry expires within the rate-limit window and the IP itself
 * never lands in any datastore.
 *
 * Edge defenses (Cloudflare dashboard, not code):
 *   - Rate Limiting Rules: 10 POSTs per 60s per IP on /submit/* and /api/reports
 *   - WAF managed rules: SQLi, XSS, common bot signatures
 *   - Bot Fight Mode: definite-bot challenge
 *
 * In-code defenses, in order of cost:
 *   1. honeypot field present? → silent drop
 *   2. content-length over cap? → 413
 *   3. body shape invalid? → 400
 *   4. KV rate limit (keyed by IP HMAC) exceeded? → 429
 *   5. Turnstile token invalid? → 403
 */

export const MAX_SUBMISSION_BYTES = 16 * 1024; // 16 KB
export const MAX_REPORT_BYTES = 8 * 1024; // 8 KB per the reports server cap
export const HONEYPOT_FIELD = 'website'; // hidden, label tells bots to fill it

export function honeypotTripped(value: FormDataEntryValue | string | null | undefined): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true; // a File in the honeypot is definitely a bot
}

export function payloadTooLarge(req: Request, cap: number): boolean {
  const cl = req.headers.get('content-length');
  if (!cl) return false;
  const n = parseInt(cl, 10);
  if (!Number.isFinite(n)) return false;
  return n > cap;
}

export function clientIp(getClientAddress: () => string): string | null {
  try {
    return getClientAddress();
  } catch {
    return null;
  }
}

/**
 * Pseudonymous identifier for rate-limit keying. The IP never leaves
 * this function — only the HMAC does. Without the pepper, the hash
 * can't be reversed even given the full IPv4 space.
 *
 * Returns null if there's no IP or no pepper, so callers can decide
 * whether to fail open or apply a global limit instead.
 */
export async function ipHash(ip: string | null, pepper: string | undefined): Promise<string | null> {
  if (!ip || !pepper) return null;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pepper),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(ip));
  // Truncate to 16 bytes / 32 hex chars — plenty of collision space
  // for rate-limit keys, half the storage in KV.
  return Array.from(new Uint8Array(sig).slice(0, 16))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
