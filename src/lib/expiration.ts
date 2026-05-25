/**
 * Expiration helpers. Dates are stored as 'YYYY-MM-DD' strings so
 * comparison is timezone-free.
 */

export function todayISO(): string {
  // Server-side: uses UTC. Client-side: uses local. Close enough for
  // emergency timing — being off by a few hours at day boundary is
  // acceptable vs the complexity of full timezone handling.
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isValidDateString(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function isExpired(date: string | null | undefined, today?: string): boolean {
  if (!date) return false;
  return date < (today ?? todayISO());
}

export function daysUntil(date: string, today?: string): number {
  const t = new Date(`${today ?? todayISO()}T00:00:00Z`);
  const d = new Date(`${date}T00:00:00Z`);
  return Math.round((d.getTime() - t.getTime()) / 86_400_000);
}

/** "Expires today" / "Expires Mon" / "Expires May 26" / "Expired" */
export function expirationLabel(date: string | null | undefined): string | null {
  if (!date) return null;
  const days = daysUntil(date);
  if (days < 0) return 'Expired';
  if (days === 0) return 'Expires today';
  if (days === 1) return 'Expires tomorrow';
  if (days <= 6) {
    const weekday = new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
      weekday: 'short',
      timeZone: 'UTC'
    });
    return `Expires ${weekday}`;
  }
  const md = new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC'
  });
  return `Expires ${md}`;
}
