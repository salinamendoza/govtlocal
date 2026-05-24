import { redirect, type RequestHandler } from '@sveltejs/kit';
import { ADMIN_COOKIE } from '$lib/server/adminAuth';

export const POST: RequestHandler = ({ cookies }) => {
  cookies.delete(ADMIN_COOKIE, { path: '/' });
  throw redirect(303, '/admin/login');
};
