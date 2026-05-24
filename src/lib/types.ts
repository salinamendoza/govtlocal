import type { ResourceCategory, DonationCategory } from './categories';

export type Kind = 'resource' | 'donation';
export type EntryStatus = 'pending' | 'approved' | 'rejected' | 'archived';
export type Category = ResourceCategory | DonationCategory;

export interface Entry {
  id: string;
  kind: Kind;
  category: string;
  title: string;
  description: string;
  url: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  zip: string | null;
  contact_name: string | null;
  contact_email: string | null;
  status: EntryStatus;
  created_at: number;
  updated_at: number;
  approved_at: number | null;
}

export type PublicEntry = Entry;

export interface ListEntriesOptions {
  kind: Kind;
  category?: string;
  query?: string;
  status?: EntryStatus | 'all';
  limit?: number;
  cursor?: number | null; // created_at of last item
}

export interface EntryInput {
  kind: Kind;
  category: string;
  title: string;
  description: string;
  url?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  zip?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
}

export interface ListResult {
  items: Entry[];
  nextCursor: number | null;
}
