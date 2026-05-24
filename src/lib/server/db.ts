import { error } from '@sveltejs/kit';
import type { D1Database } from '@cloudflare/workers-types';

export function getDB(platform: App.Platform | undefined): D1Database {
  if (!platform?.env?.DB) {
    throw error(500, 'Database binding not available');
  }
  return platform.env.DB;
}

export function now(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Escape user input for FTS5 MATCH so quotes/operators don't blow up the parser.
 * Wraps each whitespace-split token in double quotes and appends '*' for prefix
 * matching. Returns null if there are no usable tokens.
 */
export function buildFtsQuery(raw: string): string | null {
  const tokens = raw
    .trim()
    .split(/\s+/)
    .map((t) => t.replace(/["*]/g, ''))
    .filter((t) => t.length > 0);
  if (tokens.length === 0) return null;
  return tokens.map((t) => `"${t}"*`).join(' ');
}

/** Escape % and _ for safe LIKE. */
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (m) => '\\' + m);
}
