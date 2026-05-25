import type { EntryInput, Kind } from '$lib/types';
import { categoriesFor, isValidCategory } from '$lib/categories';
import { CAPACITY_STATUSES, isValidCapacity, type CapacityStatus } from '$lib/capacity';
import { SERVICE_TAGS, isValidService, type ServiceTag } from '$lib/services';
import { isValidDateString, todayISO } from '$lib/expiration';

const MODEL = '@cf/meta/llama-3.1-8b-instruct';

export interface ExistingEntryHint {
  id: string;
  title: string;
  city: string | null;
}

export interface QuickAddResult {
  ok: true;
  entry: EntryInput;
  /** Set when the AI matched the paste to an existing entry. */
  updateId?: string;
}
export interface QuickAddFailure {
  ok: false;
  error: string;
}

function systemPrompt(kind: Kind, existing: ExistingEntryHint[]): string {
  const cats = categoriesFor(kind).join(', ');
  const caps = CAPACITY_STATUSES.join(', ');
  const services = SERVICE_TAGS.join(', ');
  const today = todayISO();
  const existingBlock =
    existing.length === 0
      ? 'No existing entries — this is always a new entry.'
      : [
          'Existing entries you might be UPDATING instead of creating a new one:',
          ...existing.map(
            (e) => `  ${e.id} | ${e.title}${e.city ? ` (${e.city})` : ''}`
          ),
          '',
          'If the user\'s text clearly refers to one of these (by name and location), set updateId to that entry\'s id. Otherwise set updateId to null and treat it as a new entry.'
        ].join('\n');
  return [
    `Today is ${today}.`,
    'You extract a single structured emergency resource directory entry from free text, OR identify it as an update to an existing one.',
    'Return ONLY a JSON object — no markdown, no commentary, no code fences.',
    '',
    existingBlock,
    '',
    'Fields:',
    '  updateId        id of the existing entry being updated, or null. Must be one of the ids listed above, exactly.',
    '  title           short name, 3-160 chars (required)',
    '  description     one or two sentences, 10-2000 chars (required). Do NOT repeat the address, phone, capacity, or services in this — those have their own fields. BUT YOU MUST PRESERVE: promo codes, voucher codes, redemption codes, coupon codes, expiration dates, deadlines, eligibility rules ("residents only", "ID required"), hours, limits ("2 per person"), and any redemption instructions ("show at counter", "use code at checkout"). These have no other field and are critical — never drop them.',
    `  category        one of exactly: [${cats}] (required)`,
    `  capacity_status one of exactly: [${caps}]. Default to "open" if not stated. Use "limited" for phrases like "near capacity" / "nearing capacity" / "filling up". Use "full" for "full" / "at capacity" / "no more room". Use "closed" for "closed" / "shut down". Use "unknown" only if truly unclear.`,
    `  services        ARRAY of zero or more from exactly: [${services}]. Pick every tag that applies. Empty array if none mentioned. Use "Beds (overnight)" only for overnight, "Day shelter" for day-only. Translate phrases: "shower trailer" -> "Showers", "hot meals" / "food" -> "Meals", "drinking water" -> "Water", "pets welcome" / "pet friendly" -> "Pets allowed", "wheelchair accessible" -> "ADA accessible", "se habla español" -> "Spanish-speaking".`,
    `  expires_at      String in "YYYY-MM-DD" format, or null. The LAST DAY the offer is valid. Resolve relative dates against today (${today}). Return null if no expiration is mentioned.`,
    '  city            city name or null',
    '  zip             postal code or null',
    '  address         street address or null',
    '  phone           phone number or null',
    '  url             http(s) url or null',
    '  contact_name    person name or null',
    '  contact_email   email address or null',
    '',
    `Pick the single best category from the list. If the text says "day shelter not overnight", that's still Shelter as the category, with "Day shelter" in services.`,
    'If a string field is not present in the text, return null (not an empty string).',
    'If no services are mentioned, return services: [].',
    'Output JSON only. No explanation.'
  ].join('\n');
}

function stripCodeFence(s: string): string {
  // Some models wrap in ```json ... ``` despite instructions
  return s
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
}

function extractJsonObject(s: string): string | null {
  const cleaned = stripCodeFence(s);
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first === -1 || last === -1 || last < first) return null;
  return cleaned.slice(first, last + 1);
}

function strOrNull(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

export async function quickAdd(
  ai: NonNullable<App.Platform['env']['AI']>,
  kind: Kind,
  text: string,
  existing: ExistingEntryHint[] = []
): Promise<QuickAddResult | QuickAddFailure> {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: 'Paste something to parse.' };
  if (trimmed.length > 4000) {
    return { ok: false, error: 'Too long — keep under 4000 characters.' };
  }

  let raw: string;
  try {
    const response = (await ai.run(MODEL, {
      messages: [
        { role: 'system', content: systemPrompt(kind, existing) },
        { role: 'user', content: trimmed }
      ],
      max_tokens: 512,
      temperature: 0.1
    })) as { response?: string } | string;

    raw =
      typeof response === 'string'
        ? response
        : typeof response?.response === 'string'
          ? response.response
          : JSON.stringify(response);
  } catch (e) {
    return {
      ok: false,
      error: `AI call failed: ${e instanceof Error ? e.message : 'unknown'}`
    };
  }

  const jsonStr = extractJsonObject(raw);
  if (!jsonStr) {
    return { ok: false, error: 'Could not find JSON in the model response.' };
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonStr) as Record<string, unknown>;
  } catch {
    return { ok: false, error: 'Model returned invalid JSON.' };
  }

  const title = strOrNull(parsed.title, 160);
  const description = strOrNull(parsed.description, 2000);
  const category = strOrNull(parsed.category, 80);

  if (!title) return { ok: false, error: 'Model did not produce a title.' };
  if (!description || description.length < 10) {
    return { ok: false, error: 'Model did not produce a useful description.' };
  }
  if (!category || !isValidCategory(kind, category)) {
    return {
      ok: false,
      error: `Model picked an invalid category${category ? ` ("${category}")` : ''}. Try again or use the full form.`
    };
  }

  const rawCap = typeof parsed.capacity_status === 'string' ? parsed.capacity_status : 'open';
  const capacity_status: CapacityStatus = isValidCapacity(rawCap) ? rawCap : 'unknown';

  const services: ServiceTag[] = Array.isArray(parsed.services)
    ? parsed.services.filter(isValidService)
    : [];

  const expires_at = isValidDateString(parsed.expires_at) ? parsed.expires_at : null;

  // updateId must be one of the ids we passed in — protect against
  // the model inventing one.
  const validIds = new Set(existing.map((e) => e.id));
  const rawId = typeof parsed.updateId === 'string' ? parsed.updateId : null;
  const updateId = rawId && validIds.has(rawId) ? rawId : undefined;

  return {
    ok: true,
    updateId,
    entry: {
      kind,
      title,
      description,
      category,
      city: strOrNull(parsed.city, 80),
      zip: strOrNull(parsed.zip, 16),
      address: strOrNull(parsed.address, 200),
      phone: strOrNull(parsed.phone, 40),
      url: strOrNull(parsed.url, 500),
      contact_name: strOrNull(parsed.contact_name, 120),
      contact_email: strOrNull(parsed.contact_email, 200),
      capacity_status,
      services,
      expires_at
    }
  };
}
