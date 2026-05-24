/**
 * Server-side Cloudflare Turnstile verification.
 *
 * Setup:
 *   1. Create a Turnstile site in CF dashboard → copy site key + secret
 *   2. Pages env vars:
 *        PUBLIC_TURNSTILE_SITE_KEY (build-time, public, embedded in client)
 *        TURNSTILE_SECRET_KEY     (runtime, server-only)
 *   3. Set TURNSTILE_SECRET_KEY in Pages dashboard, NOT in wrangler.toml
 *
 * If the secret is unset (local dev, preview without CF env), verification
 * is skipped — callers should still enforce other defenses.
 */

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export interface TurnstileResult {
  ok: boolean;
  reason?: string;
  errorCodes?: string[];
}

export async function verifyTurnstile(
  token: string | null | undefined,
  secret: string | undefined,
  remoteIp: string | null
): Promise<TurnstileResult> {
  if (!secret) {
    // Dev / preview environments without Turnstile configured. Surface
    // a skipped result so logs distinguish it from a real pass.
    return { ok: true, reason: 'turnstile_unconfigured' };
  }
  if (!token) {
    return { ok: false, reason: 'missing_token' };
  }

  const body = new URLSearchParams();
  body.set('secret', secret);
  body.set('response', token);
  if (remoteIp) body.set('remoteip', remoteIp);

  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      body,
      headers: { 'content-type': 'application/x-www-form-urlencoded' }
    });
    if (!res.ok) {
      return { ok: false, reason: 'siteverify_http_error' };
    }
    const data = (await res.json()) as {
      success: boolean;
      'error-codes'?: string[];
    };
    if (data.success) return { ok: true };
    return {
      ok: false,
      reason: 'turnstile_failed',
      errorCodes: data['error-codes']
    };
  } catch {
    return { ok: false, reason: 'siteverify_network_error' };
  }
}
