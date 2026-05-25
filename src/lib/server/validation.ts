import type { EntryInput, Kind } from '$lib/types';
import { isValidCategory } from '$lib/categories';
import { CAPACITY_STATUSES, isValidCapacity, type CapacityStatus } from '$lib/capacity';
import { isValidService, type ServiceTag } from '$lib/services';
import { isValidDateString } from '$lib/expiration';

export interface FieldErrors {
  [field: string]: string;
}

/** Form re-population values; services is multi-valued. */
export type FormValues = Record<string, string | string[]>;

export interface ValidatedEntry {
  ok: true;
  value: EntryInput;
}

export interface InvalidEntry {
  ok: false;
  errors: FieldErrors;
  values: FormValues;
}

const LIMITS = {
  title: [3, 160],
  description: [10, 2000],
  city: [0, 80],
  zip: [0, 16],
  url: [0, 500],
  phone: [0, 40],
  address: [0, 200],
  contact_name: [0, 120],
  contact_email: [0, 200]
} as const;

function s(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === 'string' ? v.trim() : '';
}

function bounded(value: string, [min, max]: readonly [number, number]): string | null {
  if (value.length < min) return `Must be at least ${min} characters`;
  if (value.length > max) return `Must be ${max} characters or fewer`;
  return null;
}

function validUrl(s: string): boolean {
  if (!s) return true;
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function validEmail(s: string): boolean {
  if (!s) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function validPhone(s: string): boolean {
  if (!s) return true;
  // permissive: digits, spaces, dashes, parens, plus, dot
  return /^[+()\d\s.\-]{7,40}$/.test(s);
}

export function validateEntrySubmission(form: FormData, kind: Kind): ValidatedEntry | InvalidEntry {
  const rawCapacity = s(form, 'capacity_status');
  const capacity_status: CapacityStatus = isValidCapacity(rawCapacity) ? rawCapacity : 'unknown';

  const rawServices = form
    .getAll('services')
    .filter((v): v is string => typeof v === 'string');
  const services: ServiceTag[] = rawServices.filter(isValidService);

  const rawExpires = s(form, 'expires_at');
  const expires_at: string | null = isValidDateString(rawExpires) ? rawExpires : null;

  const values: FormValues = {
    title: s(form, 'title'),
    description: s(form, 'description'),
    category: s(form, 'category'),
    city: s(form, 'city'),
    zip: s(form, 'zip'),
    url: s(form, 'url'),
    phone: s(form, 'phone'),
    address: s(form, 'address'),
    contact_name: s(form, 'contact_name'),
    contact_email: s(form, 'contact_email'),
    capacity_status,
    services,
    expires_at: expires_at ?? ''
  };

  const title = values.title as string;
  const description = values.description as string;
  const category = values.category as string;
  const city = values.city as string;
  const zip = values.zip as string;
  const url = values.url as string;
  const phone = values.phone as string;
  const address = values.address as string;
  const contact_name = values.contact_name as string;
  const contact_email = values.contact_email as string;

  const errors: FieldErrors = {};

  const titleErr = bounded(title, LIMITS.title);
  if (titleErr) errors.title = titleErr;

  const descErr = bounded(description, LIMITS.description);
  if (descErr) errors.description = descErr;

  if (!category) {
    errors.category = 'Pick a category';
  } else if (!isValidCategory(kind, category)) {
    errors.category = 'Invalid category';
  }

  if (!(CAPACITY_STATUSES as readonly string[]).includes(capacity_status)) {
    errors.capacity_status = 'Invalid capacity status';
  }

  // Unknown service tags are silently dropped — the UI only exposes
  // the fixed SERVICE_TAGS list, so any rejected value here means a
  // tampered request, not a user error.

  if (city) {
    const e = bounded(city, LIMITS.city);
    if (e) errors.city = e;
  }
  if (zip) {
    const e = bounded(zip, LIMITS.zip);
    if (e) errors.zip = e;
  }
  if (url && !validUrl(url)) errors.url = 'Must be a valid http(s) URL';
  if (phone && !validPhone(phone)) errors.phone = 'Phone looks invalid';
  if (address) {
    const e = bounded(address, LIMITS.address);
    if (e) errors.address = e;
  }
  if (contact_name) {
    const e = bounded(contact_name, LIMITS.contact_name);
    if (e) errors.contact_name = e;
  }
  if (contact_email && !validEmail(contact_email)) {
    errors.contact_email = 'Email looks invalid';
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors, values };
  }

  return {
    ok: true,
    value: {
      kind,
      category,
      title,
      description,
      city: city || null,
      zip: zip || null,
      url: url || null,
      phone: phone || null,
      address: address || null,
      contact_name: contact_name || null,
      contact_email: contact_email || null,
      capacity_status,
      services,
      expires_at
    }
  };
}
