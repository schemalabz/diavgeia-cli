import { describe, it, expect, vi } from 'vitest';
import { msToDate, msToISODate, normalizeGreek, buildUrl, sleep } from './utils.js';

describe('msToDate', () => {
  it('converts milliseconds to Date', () => {
    const date = msToDate(1734566400000);
    expect(date).toBeInstanceOf(Date);
    expect(date.toISOString()).toBe('2024-12-19T00:00:00.000Z');
  });
});

describe('msToISODate', () => {
  it('converts milliseconds to YYYY-MM-DD string', () => {
    expect(msToISODate(1734566400000)).toBe('2024-12-19');
  });

  it('handles different dates', () => {
    expect(msToISODate(1734652800000)).toBe('2024-12-20');
  });

  it('handles epoch zero', () => {
    expect(msToISODate(0)).toBe('1970-01-01');
  });
});

describe('normalizeGreek', () => {
  it('removes diacritics and lowercases', () => {
    expect(normalizeGreek('ΔΗΜΟΣ')).toBe('δημος');
  });

  it('removes accents from Greek text', () => {
    expect(normalizeGreek('Ζωγράφου')).toBe('ζωγραφου');
  });

  it('handles Latin text', () => {
    expect(normalizeGreek('café')).toBe('cafe');
  });

  it('handles empty string', () => {
    expect(normalizeGreek('')).toBe('');
  });

  it('allows case-insensitive matching', () => {
    const query = normalizeGreek('ζωγράφου');
    const label = normalizeGreek('ΔΗΜΟΣ ΖΩΓΡΑΦΟΥ');
    expect(label.includes(query)).toBe(true);
  });
});

describe('sleep', () => {
  it('resolves after the given delay', async () => {
    vi.useFakeTimers();
    const p = sleep(100);
    vi.advanceTimersByTime(100);
    await p;
    vi.useRealTimers();
  });
});

describe('buildUrl', () => {
  it('appends path to base', () => {
    const url = buildUrl('https://example.com', '/api/test');
    expect(url).toBe('https://example.com/api/test');
  });

  it('appends query parameters', () => {
    const url = buildUrl('https://example.com', '/api/test', {
      page: 0,
      size: 100,
    });
    expect(url).toBe('https://example.com/api/test?page=0&size=100');
  });

  it('omits undefined parameters', () => {
    const url = buildUrl('https://example.com', '/api/test', {
      org: '6104',
      unit: undefined,
    });
    expect(url).toBe('https://example.com/api/test?org=6104');
  });

  it('converts numbers to strings', () => {
    const url = buildUrl('https://example.com', '/api/test', {
      page: 0,
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get('page')).toBe('0');
  });
});
