import { error, fail, redirect, type Actions, type PageServerLoad } from '@sveltejs/kit';
import { getDB } from '$lib/server/db';
import { getEntry, updateEntry, deleteEntry } from '$lib/server/entries';
import { isValidCategory } from '$lib/categories';
import { isValidCapacity, type CapacityStatus } from '$lib/capacity';
import { isValidService, type ServiceTag } from '$lib/services';
import type { EntryStatus, Kind } from '$lib/types';

export const load: PageServerLoad = async ({ params, platform }) => {
  const db = getDB(platform);
  const entry = await getEntry(db, params.id, { includeUnapproved: true });
  if (!entry) throw error(404, 'Entry not found');
  return { entry };
};

const STATUSES: EntryStatus[] = ['pending', 'approved', 'rejected', 'archived'];

function strOrNull(form: FormData, key: string): string | null {
  const v = form.get(key);
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

export const actions: Actions = {
  save: async ({ params, request, platform }) => {
    const db = getDB(platform);
    const existing = await getEntry(db, params.id!, { includeUnapproved: true });
    if (!existing) throw error(404, 'Entry not found');

    const form = await request.formData();
    const status = form.get('status') as EntryStatus;
    if (!STATUSES.includes(status)) return fail(400, { error: 'Invalid status' });

    const category = (form.get('category') as string) ?? existing.category;
    if (!isValidCategory(existing.kind as Kind, category)) {
      return fail(400, { error: 'Invalid category for this kind' });
    }

    const rawCap = form.get('capacity_status');
    const capacity_status: CapacityStatus = isValidCapacity(rawCap)
      ? (rawCap as CapacityStatus)
      : existing.capacity_status;

    const services: ServiceTag[] = form
      .getAll('services')
      .filter((v): v is string => typeof v === 'string')
      .filter(isValidService);

    await updateEntry(db, params.id!, {
      title: (form.get('title') as string) ?? existing.title,
      description: (form.get('description') as string) ?? existing.description,
      category,
      city: strOrNull(form, 'city'),
      zip: strOrNull(form, 'zip'),
      address: strOrNull(form, 'address'),
      url: strOrNull(form, 'url'),
      phone: strOrNull(form, 'phone'),
      contact_name: strOrNull(form, 'contact_name'),
      contact_email: strOrNull(form, 'contact_email'),
      capacity_status,
      services,
      status
    });

    return { saved: true };
  },
  delete: async ({ params, platform }) => {
    const db = getDB(platform);
    await deleteEntry(db, params.id!);
    throw redirect(303, '/admin');
  }
};
