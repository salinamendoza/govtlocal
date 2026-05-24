export const RESOURCE_CATEGORIES = [
  'Shelter',
  'Food',
  'Hotline',
  'Grants',
  'Loans',
  'Medical',
  'Supplies',
  'Transportation',
  'Pets',
  'Storage',
  'Admin Support',
  'First Responders',
  'Other'
] as const;

export const DONATION_CATEGORIES = [
  'Volunteer',
  'Donate',
  'Buy',
  'Gofundme',
  'Equipment'
] as const;

export type ResourceCategory = (typeof RESOURCE_CATEGORIES)[number];
export type DonationCategory = (typeof DONATION_CATEGORIES)[number];

export function categoriesFor(kind: 'resource' | 'donation'): readonly string[] {
  return kind === 'resource' ? RESOURCE_CATEGORIES : DONATION_CATEGORIES;
}

export function isValidCategory(
  kind: 'resource' | 'donation',
  value: string
): boolean {
  return (categoriesFor(kind) as readonly string[]).includes(value);
}
