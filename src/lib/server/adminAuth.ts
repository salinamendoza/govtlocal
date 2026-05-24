/**
 * Single-admin auth using an env-var shared secret.
 *
 * Wire flow:
 *   1. Admin POSTs password to /admin/login
 *   2. Server compares against ADMIN_SECRET
 *   3. On match, set HttpOnly+Secure+SameSite=Strict cookie containing
 *      sha256(secret) — never the secret itself
 *   4. Every /admin/* request: rehash secret, compare via constant-time
 *      to cookie. Mismatch → redirect to /admin/login
 *
 * If ADMIN_SECRET is unset the admin surface is closed entirely — this
 * prevents an accidentally deployed open admin.
 */

export const ADMIN_COOKIE = 'erd_admin';
const COOKIE_MAX_AGE = 60 * 60 * 12; // 12 hours

export async function hashSecret(secret: string): Promise<string> {
  const enc = new TextEncoder().encode(secret);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function isCookieValid(
  cookieValue: string | undefined,
  adminSecret: string | undefined
): Promise<boolean> {
  if (!cookieValue || !adminSecret) return false;
  const expected = await hashSecret(adminSecret);
  return timingSafeEqual(cookieValue, expected);
}

export interface CookieOptions {
  path: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'strict';
  maxAge: number;
}

export function cookieOptions(): CookieOptions {
  return {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: COOKIE_MAX_AGE
  };
}
