import { error, type LayoutServerLoad } from '@sveltejs/kit';

// Defense in depth — hooks.server.ts already redirects unauthed requests
// away from /admin/*. This guards against handler bugs that skip hooks.
export const load: LayoutServerLoad = async ({ locals, url }) => {
  if (!locals.isAdmin && url.pathname !== '/admin/login') {
    throw error(403, 'Forbidden');
  }
  return {};
};
