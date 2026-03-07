import { describe, it, expect } from 'vitest';
import { computeWindows, buildSubjectWordsQuery, buildAdvancedQuery } from './search.js';

describe('computeWindows', () => {
  it('returns single window for exactly 180 days', () => {
    const windows = computeWindows('2024-01-01', '2024-06-29');
    expect(windows).toHaveLength(1);
    expect(windows[0]).toEqual({ from: '2024-01-01', to: '2024-06-29' });
  });

  it('returns two windows for 181 days', () => {
    // 2024-01-01 to 2024-06-30 = 181 days
    const windows = computeWindows('2024-01-01', '2024-06-30');
    expect(windows).toHaveLength(2);
    expect(windows[0].from).toBe('2024-01-01');
    expect(windows[1].to).toBe('2024-06-30');
  });

  it('handles multi-year range', () => {
    const windows = computeWindows('2022-01-01', '2024-12-31');
    expect(windows.length).toBeGreaterThan(2);
    // First window starts at the beginning
    expect(windows[0].from).toBe('2022-01-01');
    // Last window ends at the end
    expect(windows[windows.length - 1].to).toBe('2024-12-31');
  });

  it('covers full range without gaps', () => {
    const windows = computeWindows('2024-01-01', '2024-12-31');

    // Check no gaps: each window's from should be one day after previous window's to
    for (let i = 1; i < windows.length; i++) {
      const prevEnd = new Date(windows[i - 1].to + 'T00:00:00Z');
      const currStart = new Date(windows[i].from + 'T00:00:00Z');
      const gap = (currStart.getTime() - prevEnd.getTime()) / (24 * 60 * 60 * 1000);
      expect(gap).toBe(1);
    }

    // First starts at the beginning, last ends at the end
    expect(windows[0].from).toBe('2024-01-01');
    expect(windows[windows.length - 1].to).toBe('2024-12-31');
  });

  it('handles same date for from and to', () => {
    const windows = computeWindows('2024-06-15', '2024-06-15');
    expect(windows).toHaveLength(1);
    expect(windows[0]).toEqual({ from: '2024-06-15', to: '2024-06-15' });
  });

  it('handles from after to', () => {
    const windows = computeWindows('2024-12-31', '2024-01-01');
    expect(windows).toHaveLength(1);
  });

  it('respects custom maxDays', () => {
    // 30-day windows over 90 days = 3 windows
    const windows = computeWindows('2024-01-01', '2024-03-31', 30);
    expect(windows).toHaveLength(3);
  });
});

describe('buildSubjectWordsQuery', () => {
  it('single word returns subject:word', () => {
    expect(buildSubjectWordsQuery('ΕΓΚΡΙΣΗ')).toBe('subject:ΕΓΚΡΙΣΗ');
  });

  it('multiple words are AND-joined', () => {
    expect(buildSubjectWordsQuery('ΕΓΚΡΙΣΗ ΠΡΟΫΠΟΛΟΓΙΣΜΟΥ')).toBe(
      'subject:ΕΓΚΡΙΣΗ AND subject:ΠΡΟΫΠΟΛΟΓΙΣΜΟΥ',
    );
  });

  it('extra whitespace is trimmed and filtered', () => {
    expect(buildSubjectWordsQuery('  ΕΓΚΡΙΣΗ   ΠΡΟΫΠΟΛΟΓΙΣΜΟΥ  ')).toBe(
      'subject:ΕΓΚΡΙΣΗ AND subject:ΠΡΟΫΠΟΛΟΓΙΣΜΟΥ',
    );
  });

  it('empty string returns empty', () => {
    expect(buildSubjectWordsQuery('')).toBe('');
    expect(buildSubjectWordsQuery('   ')).toBe('');
  });
});

describe('buildAdvancedQuery', () => {
  it('returns null with no advanced flags', () => {
    expect(buildAdvancedQuery({})).toBeNull();
    expect(buildAdvancedQuery({ org: '6104', from: '2024-01-01' })).toBeNull();
  });

  it('builds content query', () => {
    expect(buildAdvancedQuery({ content: 'δικαστική απόφαση' })).toBe(
      'content:"δικαστική απόφαση"',
    );
  });

  it('builds amount range with both min and max', () => {
    const q = buildAdvancedQuery({ amountMin: '1000', amountMax: '5000' });
    expect(q).toBe('financialAmount:[1000 TO 5000]');
  });

  it('builds amount range with min only', () => {
    const q = buildAdvancedQuery({ amountMin: '1000' });
    expect(q).toBe('financialAmount:[1000 TO *]');
  });

  it('builds amount range with max only', () => {
    const q = buildAdvancedQuery({ amountMax: '5000' });
    expect(q).toBe('financialAmount:[* TO 5000]');
  });

  it('combines multiple advanced flags with AND', () => {
    const q = buildAdvancedQuery({
      subjectWords: 'ΕΓΚΡΙΣΗ ΔΑΠΑΝΗΣ',
      content: 'δικαστική',
      amountMin: '1000',
    });
    expect(q).toContain('subject:ΕΓΚΡΙΣΗ AND subject:ΔΑΠΑΝΗΣ');
    expect(q).toContain('content:"δικαστική"');
    expect(q).toContain('financialAmount:[1000 TO *]');
    // All parts joined with AND
    expect(q!.split(' AND ').length).toBe(4);
  });

  it('includes common flags as Lucene equivalents when advanced flags present', () => {
    const q = buildAdvancedQuery({
      content: 'test',
      org: '6104',
      type: 'Β.1.1',
      from: '2024-01-01',
      to: '2024-06-30',
      status: 'PUBLISHED',
    });
    expect(q).toContain('content:"test"');
    expect(q).toContain('organizationUid:"6104"');
    expect(q).toContain('decisionTypeUid:"Β.1.1"');
    expect(q).toContain('issueDate:[2024-01-01 TO 2024-06-30]');
    expect(q).toContain('status:"PUBLISHED"');
  });

  it('handles date range with only from', () => {
    const q = buildAdvancedQuery({ content: 'test', from: '2024-01-01' });
    expect(q).toContain('issueDate:[2024-01-01 TO *]');
  });

  it('handles date range with only to', () => {
    const q = buildAdvancedQuery({ content: 'test', to: '2024-06-30' });
    expect(q).toContain('issueDate:[* TO 2024-06-30]');
  });
});
