import type { EntryInput, Kind } from '$lib/types';
import { categoriesFor, isValidCategory } from '$lib/categories';

const MODEL = '@cf/meta/llama-3.1-8b-instruct';

export interface QuickAddResult {
  ok: true;
  entry: EntryInput;
}
export interface QuickAddFailure {
  ok: false;
  error: string;
}

function systemPrompt(kind: Kind): string {
  const cats = categoriesFor(kind).join(', ');
  return [
    'You extract a single structured emergency resource directory entry from free text.',
    'Return ONLY a JSON object — no markdown, no commentary, no code fences.',
    '',
    'Fields:',
    '  title         short name, 3-160 chars (required)',
    '  description   one or two sentences, 10-2000 chars (required)',
    `  category      one of exactly: [${cats}] (required)`,
    '  city          city name or null',
    '  zip           postal code or null',
    '  address       street address or null',
    '  phone         phone number or null',
    '  url           http(s) url or null',
    '  contact_name  person name or null',
    '  contact_email email address or null',
    '',
    `Pick the single best category from the list. If the text says "day shelter not overnight", that's still Shelter.`,
    'If a field is not present in the text, return null for it (not an empty string).',
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
  text: string
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
        { role: 'system', content: systemPrompt(kind) },
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

  return {
    ok: true,
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
      contact_email: strOrNull(parsed.contact_email, 200)
    }
  };
}
