import { describe, it, expect, vi } from 'vitest';
import { paginate } from './paginate.js';
import type { Decision, SearchResponse } from './types.js';

function makeDecision(ada: string): Decision {
  return {
    ada,
    subject: 'Test',
    protocolNumber: '1/2024',
    issueDate: 1734566400000,
    publishTimestamp: 1734652800000,
    submissionTimestamp: 1734652800000,
    organizationId: '6104',
    unitIds: ['81689'],
    signerIds: [],
    decisionTypeId: 'Β.1.1',
    thematicCategoryIds: [],
    extraFieldValues: {},
    status: 'PUBLISHED',
    versionId: 'v1',
    correctedVersionId: null,
    documentUrl: 'https://example.com/doc',
    documentChecksum: null,
    url: 'https://example.com/api',
    attachments: [],
    privateData: false,
  };
}

function makeSearchResponse(decisions: Decision[], total: number, page: number, size: number): SearchResponse {
  return {
    info: { total, page, size, actualSize: decisions.length, query: '' },
    decisions,
  };
}

describe('paginate', () => {
  it('yields all decisions from a single page', async () => {
    const fetchPage = vi.fn().mockResolvedValueOnce(
      makeSearchResponse([makeDecision('A'), makeDecision('B')], 2, 0, 10),
    );

    const results: Decision[] = [];
    for await (const d of paginate(fetchPage, 10)) {
      results.push(d);
    }

    expect(results).toHaveLength(2);
    expect(results[0].ada).toBe('A');
    expect(results[1].ada).toBe('B');
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(fetchPage).toHaveBeenCalledWith(0);
  });

  it('paginates through multiple pages', async () => {
    const fetchPage = vi.fn()
      .mockResolvedValueOnce(
        makeSearchResponse([makeDecision('A'), makeDecision('B')], 3, 0, 2),
      )
      .mockResolvedValueOnce(
        makeSearchResponse([makeDecision('C')], 3, 1, 2),
      );

    const results: Decision[] = [];
    for await (const d of paginate(fetchPage, 2)) {
      results.push(d);
    }

    expect(results).toHaveLength(3);
    expect(results.map(d => d.ada)).toEqual(['A', 'B', 'C']);
    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(fetchPage).toHaveBeenCalledWith(0);
    expect(fetchPage).toHaveBeenCalledWith(1);
  });

  it('handles empty results', async () => {
    const fetchPage = vi.fn().mockResolvedValueOnce(
      makeSearchResponse([], 0, 0, 10),
    );

    const results: Decision[] = [];
    for await (const d of paginate(fetchPage, 10)) {
      results.push(d);
    }

    expect(results).toHaveLength(0);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('stops when no more pages', async () => {
    const page0 = Array.from({ length: 500 }, (_, i) => makeDecision(`D-${i}`));
    const fetchPage = vi.fn()
      .mockResolvedValueOnce(makeSearchResponse(page0, 501, 0, 500))
      .mockResolvedValueOnce(makeSearchResponse([makeDecision('D-500')], 501, 1, 500));

    const results: Decision[] = [];
    for await (const d of paginate(fetchPage, 500)) {
      results.push(d);
    }

    expect(results).toHaveLength(501);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it('can be broken out of early', async () => {
    const fetchPage = vi.fn().mockResolvedValueOnce(
      makeSearchResponse([makeDecision('A'), makeDecision('B'), makeDecision('C')], 100, 0, 3),
    );

    const results: Decision[] = [];
    for await (const d of paginate(fetchPage, 3)) {
      results.push(d);
      if (results.length === 1) break;
    }

    expect(results).toHaveLength(1);
    expect(results[0].ada).toBe('A');
  });
});
