import type { D1Database } from '@cloudflare/workers-types';

/**
 * Abuse defenses applied at the route layer.
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
 *   4. KV rate limit exceeded? → 429
 *   5. per-IP pending queue full? → 429 with "too many pending" hint
 *   6. Turnstile token invalid? → 403
 */

export const MAX_SUBMISSION_BYTES = 16 * 1024; // 16 KB
export const MAX_REPORT_BYTES = 8 * 1024; // 8 KB per the reports server cap
export const MAX_PENDING_PER_IP = 3;
export const HONEYPOT_FIELD = 'website'; // hidden, label tells bots to fill it

export function honeypotTripped(value: FormDataEntryValue | string | null | undefined): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true; // a File in the honeypot is definitely a bot
}

export function payloadTooLarge(req: Request, cap: number): boolean {
  const cl = req.headers.get('content-length');
  if (!cl) return false; // unknown length; we'll catch oversized parses elsewhere
  const n = parseInt(cl, 10);
  if (!Number.isFinite(n)) return false;
  return n > cap;
}

export async function pendingCountByIp(db: D1Database, ip: string | null): Promise<number> {
  if (!ip) return 0;
  const row = await db
    .prepare("SELECT COUNT(*) AS n FROM entries WHERE submitter_ip = ? AND status = 'pending'")
    .bind(ip)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export function clientIp(getClientAddress: () => string): string | null {
  try {
    return getClientAddress();
  } catch {
    return null;
  }
}
