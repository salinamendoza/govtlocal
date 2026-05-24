import { fail, type Actions, type PageServerLoad } from '@sveltejs/kit';
import { getDB } from '$lib/server/db';
import {
  archiveUpdate,
  createUpdate,
  listUpdates,
  unarchiveUpdate,
  UPDATE_SEVERITIES,
  type UpdateSeverity
} from '$lib/server/updates';

export const load: PageServerLoad = async ({ platform }) => {
  const db = getDB(platform);
  const items = await listUpdates(db, true);
  return { items };
};

export const actions: Actions = {
  create: async ({ request, platform }) => {
    const db = getDB(platform);
    const form = await request.formData();
    const headline = ((form.get('headline') as string) ?? '').trim();
    const body = ((form.get('body') as string) ?? '').trim();
    const severity = (form.get('severity') as UpdateSeverity) ?? 'info';
    if (!headline) return fail(400, { error: 'Headline required' });
    if (headline.length > 200) return fail(400, { error: 'Headline too long' });
    if (body.length > 2000) return fail(400, { error: 'Body too long' });
    if (!UPDATE_SEVERITIES.includes(severity)) return fail(400, { error: 'Invalid severity' });
    await createUpdate(db, { headline, body: body || null, severity });
    return { created: true };
  },
  archive: async ({ request, platform }) => {
    const db = getDB(platform);
    const id = (await request.formData()).get('id') as string;
    if (id) await archiveUpdate(db, id);
    return { ok: true };
  },
  unarchive: async ({ request, platform }) => {
    const db = getDB(platform);
    const id = (await request.formData()).get('id') as string;
    if (id) await unarchiveUpdate(db, id);
    return { ok: true };
  }
};
