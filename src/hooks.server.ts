import { redirect, type Handle } from '@sveltejs/kit';
import { ADMIN_COOKIE, isCookieValid } from '$lib/server/adminAuth';

export const handle: Handle = async ({ event, resolve }) => {
  const { pathname } = event.url;

  if (pathname.startsWith('/admin')) {
    // /admin/login is the only admin path reachable while unauthenticated.
    const isLoginRoute = pathname === '/admin/login';

    const cookieVal = event.cookies.get(ADMIN_COOKIE);
    const adminSecret = event.platform?.env.ADMIN_SECRET;
    const authed = await isCookieValid(cookieVal, adminSecret);
    event.locals.isAdmin = authed;

    if (!authed && !isLoginRoute) {
      throw redirect(303, `/admin/login?next=${encodeURIComponent(pathname)}`);
    }
    if (authed && isLoginRoute) {
      throw redirect(303, '/admin');
    }
  }

  return resolve(event);
};
