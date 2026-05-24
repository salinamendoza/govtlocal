/**
 * Fixed service tag list. Resident-facing chips on every entry card.
 * Derived from LA-fires response experience — different shelters offer
 * very different services, residents need to scan for the specific
 * thing they need (showers, pets allowed, ADA, etc.).
 */
export const SERVICE_TAGS = [
  'Meals',
  'Water',
  'Showers',
  'Beds (overnight)',
  'Day shelter',
  'Medical',
  'Mental health',
  'Pets allowed',
  'Childcare',
  'Supplies',
  'Clothing',
  'Charging',
  'WiFi',
  'ADA accessible',
  'Spanish-speaking',
  'Transportation'
] as const;

export type ServiceTag = (typeof SERVICE_TAGS)[number];

const TAG_SET = new Set<string>(SERVICE_TAGS);

export function isValidService(v: unknown): v is ServiceTag {
  return typeof v === 'string' && TAG_SET.has(v);
}

/**
 * Parse the JSON-string column from D1 into a typed array. Invalid
 * entries are silently dropped — we'd rather render a partial list
 * than blow up the card.
 */
export function parseServices(json: string | null | undefined): ServiceTag[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) return [];
    return arr.filter(isValidService);
  } catch {
    return [];
  }
}

/**
 * Validate a list of incoming tags, dedupe, and serialize for storage.
 * Caller decides whether unknown tags are an error (validation) or a
 * silent drop (snapshot hydration).
 */
export function serializeServices(tags: readonly string[]): string {
  const valid: ServiceTag[] = [];
  const seen = new Set<string>();
  for (const t of tags) {
    if (isValidService(t) && !seen.has(t)) {
      valid.push(t);
      seen.add(t);
    }
  }
  return JSON.stringify(valid);
}
