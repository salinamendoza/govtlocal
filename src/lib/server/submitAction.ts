import { fail, redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { getDB } from './db';
import { createEntry } from './entries';
import { checkRateLimit } from './ratelimit';
import { verifyTurnstile } from './turnstile';
import {
  HONEYPOT_FIELD,
  MAX_PENDING_PER_IP,
  MAX_SUBMISSION_BYTES,
  clientIp,
  honeypotTripped,
  payloadTooLarge,
  pendingCountByIp
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

  const ip = clientIp(getClientAddress);

  // 2. KV rate limit
  if (ip && platform?.env.RATELIMIT) {
    const rl = await checkRateLimit(platform.env.RATELIMIT, `sub:${ip}`, SUBMISSIONS_PER_HOUR);
    if (!rl.ok) {
      return fail(429, {
        formError:
          'Too many submissions from this address. Try again in an hour, or call the hotline.'
      });
    }
  }

  // 3. Pending queue cap per IP
  if (ip) {
    const pending = await pendingCountByIp(db, ip);
    if (pending >= MAX_PENDING_PER_IP) {
      return fail(429, {
        formError: `You already have ${pending} submission(s) waiting for review. Please wait until those are processed.`
      });
    }
  }

  // 4. Turnstile (silently passes if not configured — see verifyTurnstile)
  const turnstileToken =
    (form.get('cf-turnstile-response') as string | null) ?? null;
  const ts = await verifyTurnstile(turnstileToken, platform?.env.TURNSTILE_SECRET_KEY, ip);
  if (!ts.ok) {
    return fail(403, {
      formError: 'Verification failed. Please refresh and try again.'
    });
  }

  // 5. Field validation
  const result = validateEntrySubmission(form, kind);
  if (!result.ok) {
    return fail(400, {
      errors: result.errors,
      values: result.values
    });
  }

  // Entry is created as pending — not visible publicly until admin
  // approval, which is where the snapshot version bumps from.
  await createEntry(db, result.value, ip);

  throw redirect(303, '/submit/thanks');
}
