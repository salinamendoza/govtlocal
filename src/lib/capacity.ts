export type CapacityStatus = 'open' | 'limited' | 'full' | 'closed' | 'unknown';

export const CAPACITY_STATUSES: readonly CapacityStatus[] = [
  'open',
  'limited',
  'full',
  'closed',
  'unknown'
];

/** Statuses users can pick from in forms (excludes the system 'unknown' default). */
export const USER_CAPACITY_STATUSES: readonly CapacityStatus[] = [
  'open',
  'limited',
  'full',
  'closed'
];

export const CAPACITY_LABEL: Record<CapacityStatus, string> = {
  open: 'Open',
  limited: 'Near capacity',
  full: 'Full',
  closed: 'Closed',
  unknown: 'Unknown'
};

/**
 * Tailwind classes for the chip background/border/text per state.
 * Kept inline so the JIT picks them up — don't refactor into dynamic
 * class names.
 */
export const CAPACITY_CHIP: Record<CapacityStatus, string> = {
  open: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  limited: 'bg-amber-100 text-amber-900 border-amber-200',
  full: 'bg-red-100 text-red-800 border-red-200',
  closed: 'bg-slate-200 text-slate-700 border-slate-300',
  unknown: 'bg-slate-100 text-slate-600 border-slate-200'
};

export function isValidCapacity(v: unknown): v is CapacityStatus {
  return typeof v === 'string' && (CAPACITY_STATUSES as readonly string[]).includes(v);
}
