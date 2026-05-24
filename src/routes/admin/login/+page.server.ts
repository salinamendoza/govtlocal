import { fail, redirect, type Actions, type PageServerLoad } from '@sveltejs/kit';
import { ADMIN_COOKIE, cookieOptions, hashSecret, timingSafeEqual } from '$lib/server/adminAuth';

export const load: PageServerLoad = ({ url }) => {
  return { next: url.searchParams.get('next') ?? '/admin' };
};

export const actions: Actions = {
  default: async ({ request, cookies, platform, url }) => {
    const form = await request.formData();
    const password = (form.get('password') as string | null) ?? '';
    const next = (form.get('next') as string | null) ?? '/admin';

    const adminSecret = platform?.env.ADMIN_SECRET;
    if (!adminSecret) {
      return fail(503, { error: 'Admin not configured on this deployment.' });
    }

    // Constant-time compare on the raw secret. We hash for the cookie
    // value, not for the comparison.
    if (!timingSafeEqual(password, adminSecret)) {
      return fail(401, { error: 'Wrong password.' });
    }

    const cookieValue = await hashSecret(adminSecret);
    cookies.set(ADMIN_COOKIE, cookieValue, cookieOptions());

    // Only redirect to internal paths to avoid open-redirect.
    const target = next.startsWith('/') && !next.startsWith('//') ? next : '/admin';
    throw redirect(303, target);
  }
};
