import { fail, type Actions, type PageServerLoad } from '@sveltejs/kit';
import { getDB } from '$lib/server/db';
import {
  HAZARD_SEVERITIES,
  createHazard,
  listHazards,
  updateHazard,
  type HazardSeverity
} from '$lib/server/hazards';

export const load: PageServerLoad = async ({ platform }) => {
  const db = getDB(platform);
  return { items: await listHazards(db, true) };
};

function validateGeoJson(s: string): { ok: true; value: string } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(s);
    if (!parsed || typeof parsed !== 'object') return { ok: false, error: 'GeoJSON must be an object' };
    return { ok: true, value: JSON.stringify(parsed) };
  } catch {
    return { ok: false, error: 'Invalid JSON' };
  }
}

export const actions: Actions = {
  create: async ({ request, platform }) => {
    const db = getDB(platform);
    const form = await request.formData();
    const severity = (form.get('severity') as HazardSeverity) ?? 'advisory';
    const message = ((form.get('message') as string) ?? '').trim() || null;
    const geojsonRaw = ((form.get('geojson') as string) ?? '').trim();
    if (!HAZARD_SEVERITIES.includes(severity)) return fail(400, { error: 'Invalid severity' });
    const v = validateGeoJson(geojsonRaw);
    if (!v.ok) return fail(400, { error: v.error });
    if (message && message.length > 500) return fail(400, { error: 'Message too long' });
    await createHazard(db, { severity, message, geojson: v.value });
    return { created: true };
  },
  archive: async ({ request, platform }) => {
    const db = getDB(platform);
    const id = (await request.formData()).get('id') as string;
    if (id) await updateHazard(db, id, { archived: true });
    return { ok: true };
  },
  unarchive: async ({ request, platform }) => {
    const db = getDB(platform);
    const id = (await request.formData()).get('id') as string;
    if (id) await updateHazard(db, id, { archived: false });
    return { ok: true };
  }
};
