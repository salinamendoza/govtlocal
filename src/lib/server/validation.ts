import type { EntryInput, Kind } from '$lib/types';
import { isValidCategory } from '$lib/categories';

export interface FieldErrors {
  [field: string]: string;
}

export interface ValidatedEntry {
  ok: true;
  value: EntryInput;
}

export interface InvalidEntry {
  ok: false;
  errors: FieldErrors;
  values: Record<string, string>;
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
  const values = {
    title: s(form, 'title'),
    description: s(form, 'description'),
    category: s(form, 'category'),
    city: s(form, 'city'),
    zip: s(form, 'zip'),
    url: s(form, 'url'),
    phone: s(form, 'phone'),
    address: s(form, 'address'),
    contact_name: s(form, 'contact_name'),
    contact_email: s(form, 'contact_email')
  };

  const errors: FieldErrors = {};

  const titleErr = bounded(values.title, LIMITS.title);
  if (titleErr) errors.title = titleErr;

  const descErr = bounded(values.description, LIMITS.description);
  if (descErr) errors.description = descErr;

  if (!values.category) {
    errors.category = 'Pick a category';
  } else if (!isValidCategory(kind, values.category)) {
    errors.category = 'Invalid category';
  }

  if (values.city) {
    const e = bounded(values.city, LIMITS.city);
    if (e) errors.city = e;
  }
  if (values.zip) {
    const e = bounded(values.zip, LIMITS.zip);
    if (e) errors.zip = e;
  }
  if (values.url) {
    if (!validUrl(values.url)) errors.url = 'Must be a valid http(s) URL';
  }
  if (values.phone && !validPhone(values.phone)) errors.phone = 'Phone looks invalid';
  if (values.address) {
    const e = bounded(values.address, LIMITS.address);
    if (e) errors.address = e;
  }
  if (values.contact_name) {
    const e = bounded(values.contact_name, LIMITS.contact_name);
    if (e) errors.contact_name = e;
  }
  if (values.contact_email && !validEmail(values.contact_email)) {
    errors.contact_email = 'Email looks invalid';
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors, values };
  }

  return {
    ok: true,
    value: {
      kind,
      category: values.category,
      title: values.title,
      description: values.description,
      city: values.city || null,
      zip: values.zip || null,
      url: values.url || null,
      phone: values.phone || null,
      address: values.address || null,
      contact_name: values.contact_name || null,
      contact_email: values.contact_email || null
    }
  };
}
