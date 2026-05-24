import { fail, redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { getDB } from './db';
import { createEntry } from './entries';
import { checkRateLimit } from './ratelimit';
import { verifyTurnstile } from './turnstile';
import {
  HONEYPOT_FIELD,
  MAX_SUBMISSION_BYTES,
  clientIp,
  honeypotTripped,
  ipHash,
  payloadTooLarge
} from './abuse';
import { validateEntrySubmission } from './validation';
import type { Kind } from '$lib/types';

const SUBMISSIONS_PER_HOUR = 5;

export async function handleSubmission(event: RequestEvent, kind: Kind) {
  const { request, platform, getClientAddress } = event;
  const db = getDB(platform);

  if (payloadTooLarge(request, MAX_SUBMISSION_BYTES)) {
    return fail(413, { formError: 'Submission too large.' });
  }

  const form = await request.formData();

  // 1. Honeypot — silent drop. Don't tell the bot anything useful.
  if (honeypotTripped(form.get(HONEYPOT_FIELD))) {
    throw redirect(303, '/submit/thanks');
  }

  // 2. KV rate limit — keyed by HMAC(ip, pepper). IP never persisted.
  const ip = clientIp(getClientAddress);
  const ipKey = await ipHash(ip, platform?.env.IP_HASH_PEPPER);
  if (ipKey && platform?.env.RATELIMIT) {
    const rl = await checkRateLimit(platform.env.RATELIMIT, `sub:${ipKey}`, SUBMISSIONS_PER_HOUR);
    if (!rl.ok) {
      return fail(429, {
        formError:
          'Too many submissions from this connection. Try again in an hour, or call the hotline.'
      });
    }
  }

  // 3. Turnstile (silently passes if not configured — see verifyTurnstile)
  const turnstileToken = (form.get('cf-turnstile-response') as string | null) ?? null;
  const ts = await verifyTurnstile(turnstileToken, platform?.env.TURNSTILE_SECRET_KEY, ip);
  if (!ts.ok) {
    return fail(403, {
      formError: 'Verification failed. Please refresh and try again.'
    });
  }

  // 4. Field validation
  const result = validateEntrySubmission(form, kind);
  if (!result.ok) {
    return fail(400, {
      errors: result.errors,
      values: result.values
    });
  }

  await createEntry(db, result.value);
  throw redirect(303, '/submit/thanks');
}
