/**
 * Convert millisecond timestamp to Date object.
 */
export function msToDate(ms: number): Date {
  return new Date(ms);
}

/**
 * Convert millisecond timestamp to ISO date string (YYYY-MM-DD).
 */
export function msToISODate(ms: number): string {
  return new Date(ms).toISOString().split('T')[0];
}

/**
 * Normalize Greek text for searching: remove diacritics and lowercase.
 */
export function normalizeGreek(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/**
 * Build a URL with query parameters, omitting undefined/null values.
 */
export function buildUrl(base: string, path: string, params?: Record<string, string | number | undefined>): string {
  const url = new URL(path, base);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}
