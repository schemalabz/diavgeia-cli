import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Diavgeia } from './client.js';
import { DiavgeiaError, DiavgeiaTimeoutError } from './errors.js';
import type { Decision, SearchResponse } from './types.js';

function makeDecision(overrides: Partial<Decision> = {}): Decision {
  return {
    ada: 'ΨΘ82ΩΡΦ-7ΑΙ',
    subject: 'ΕΓΚΡΙΣΗ ΠΡΟΫΠΟΛΟΓΙΣΜΟΥ',
    protocolNumber: '258/2024',
    issueDate: 1734566400000,
    publishTimestamp: 1734652800000,
    submissionTimestamp: 1734652800000,
    organizationId: '6104',
    unitIds: ['81689'],
    signerIds: ['100009559'],
    decisionTypeId: 'Β.1.1',
    thematicCategoryIds: ['16'],
    extraFieldValues: {},
    status: 'PUBLISHED',
    versionId: 'v1',
    correctedVersionId: null,
    documentUrl: 'https://diavgeia.gov.gr/doc/ΨΘ82ΩΡΦ-7ΑΙ',
    documentChecksum: null,
    url: 'https://diavgeia.gov.gr/luminapi/api/decisions/ΨΘ82ΩΡΦ-7ΑΙ',
    attachments: [],
    privateData: false,
    ...overrides,
  };
}

function makeSearchResponse(decisions: Decision[] = [makeDecision()], total?: number): SearchResponse {
  return {
    info: {
      total: total ?? decisions.length,
      page: 0,
      size: 100,
      actualSize: decisions.length,
      query: '',
    },
    decisions,
  };
}

function ok(data: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve(data),
  } as Response);
}

function notOk(status: number, statusText: string) {
  return Promise.resolve({
    ok: false,
    status,
    statusText,
    json: () => Promise.resolve({}),
  } as Response);
}

describe('Diavgeia client', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let client: Diavgeia;

  beforeEach(() => {
    fetchMock = vi.fn();
    client = new Diavgeia({ fetch: fetchMock as unknown as typeof fetch });
  });

  function calledUrl(): URL {
    return new URL(fetchMock.mock.calls[0][0] as string);
  }

  // --- Organizations ---

  describe('organizations', () => {
    it('fetches from /luminapi/opendata/organizations.json', async () => {
      fetchMock.mockReturnValueOnce(ok({ organizations: [] }));
      await client.organizations();
      expect(calledUrl().pathname).toBe('/luminapi/opendata/organizations.json');
    });

    it('passes status and category params', async () => {
      fetchMock.mockReturnValueOnce(ok({ organizations: [] }));
      await client.organizations({ status: 'active', category: 'MUNICIPALITY' });
      const url = calledUrl();
      expect(url.searchParams.get('status')).toBe('active');
      expect(url.searchParams.get('category')).toBe('MUNICIPALITY');
    });

    it('returns organizations array', async () => {
      fetchMock.mockReturnValueOnce(ok({
        organizations: [{ uid: '6104', label: 'ΔΗΜΟΣ ΖΩΓΡΑΦΟΥ' }],
      }));
      const orgs = await client.organizations();
      expect(orgs).toHaveLength(1);
      expect(orgs[0].uid).toBe('6104');
    });
  });

  describe('organization', () => {
    it('fetches single org by ID', async () => {
      fetchMock.mockReturnValueOnce(ok({ uid: '6104', label: 'ΔΗΜΟΣ ΖΩΓΡΑΦΟΥ' }));
      const org = await client.organization('6104');
      expect(calledUrl().pathname).toBe('/luminapi/opendata/organizations/6104.json');
      expect(org.uid).toBe('6104');
    });
  });

  describe('organizationDetails', () => {
    it('fetches org details', async () => {
      fetchMock.mockReturnValueOnce(ok({ uid: '6104', units: [], signers: [] }));
      await client.organizationDetails('6104');
      expect(calledUrl().pathname).toBe('/luminapi/opendata/organizations/6104/details.json');
    });
  });

  describe('units', () => {
    it('fetches units for org', async () => {
      fetchMock.mockReturnValueOnce(ok({ units: [{ uid: '81689', label: 'ΔΗΜΟΤΙΚΟ ΣΥΜΒΟΥΛΙΟ' }] }));
      const units = await client.units('6104');
      expect(calledUrl().pathname).toBe('/luminapi/opendata/organizations/6104/units.json');
      expect(units).toHaveLength(1);
    });

    it('passes descendants param', async () => {
      fetchMock.mockReturnValueOnce(ok({ units: [] }));
      await client.units('6104', { descendants: 'all' });
      expect(calledUrl().searchParams.get('descendants')).toBe('all');
    });
  });

  describe('signers', () => {
    it('fetches signers for org', async () => {
      fetchMock.mockReturnValueOnce(ok({ signers: [] }));
      await client.signers('6104');
      expect(calledUrl().pathname).toBe('/luminapi/opendata/organizations/6104/signers.json');
    });
  });

  describe('orgPositions', () => {
    it('fetches positions for org', async () => {
      fetchMock.mockReturnValueOnce(ok({ positions: [] }));
      await client.orgPositions('6104');
      expect(calledUrl().pathname).toBe('/luminapi/opendata/organizations/6104/positions.json');
    });
  });

  // --- Direct lookups ---

  describe('unit', () => {
    it('fetches unit by ID', async () => {
      fetchMock.mockReturnValueOnce(ok({ uid: '81689', label: 'ΔΗΜΟΤΙΚΟ ΣΥΜΒΟΥΛΙΟ' }));
      const unit = await client.unit('81689');
      expect(calledUrl().pathname).toBe('/luminapi/opendata/units/81689.json');
      expect(unit.uid).toBe('81689');
    });
  });

  describe('signer', () => {
    it('fetches signer by ID', async () => {
      fetchMock.mockReturnValueOnce(ok({ uid: '100009559', firstName: 'Test' }));
      await client.signer('100009559');
      expect(calledUrl().pathname).toBe('/luminapi/opendata/signers/100009559.json');
    });
  });

  // --- Decisions ---

  describe('decision', () => {
    it('fetches decision by ADA', async () => {
      fetchMock.mockReturnValueOnce(ok(makeDecision()));
      const decision = await client.decision('ΨΘ82ΩΡΦ-7ΑΙ');
      expect(calledUrl().pathname).toContain('/decisions/');
      expect(decision.ada).toBe('ΨΘ82ΩΡΦ-7ΑΙ');
    });
  });

  describe('decisionVersion', () => {
    it('fetches decision by version ID', async () => {
      fetchMock.mockReturnValueOnce(ok(makeDecision()));
      await client.decisionVersion('some-uuid');
      expect(calledUrl().pathname).toBe('/luminapi/opendata/decisions/v/some-uuid.json');
    });
  });

  describe('versionLog', () => {
    it('fetches version log for ADA', async () => {
      fetchMock.mockReturnValueOnce(ok({ versions: [{ versionId: 'v1', status: 'PUBLISHED' }] }));
      const log = await client.versionLog('ΨΘ82ΩΡΦ-7ΑΙ');
      expect(log).toHaveLength(1);
    });
  });

  // --- Download ---

  describe('downloadDocument', () => {
    it('fetches decision then downloads documentUrl', async () => {
      const decision = makeDecision({ documentUrl: 'https://diavgeia.gov.gr/doc/TEST-ADA', documentChecksum: 'abc123' });
      const docBuffer = new ArrayBuffer(8);
      fetchMock
        .mockReturnValueOnce(ok(decision))
        .mockReturnValueOnce(Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          arrayBuffer: () => Promise.resolve(docBuffer),
        } as Response));

      const result = await client.downloadDocument('TEST-ADA');
      expect(result.buffer).toBe(docBuffer);
      expect(result.checksum).toBe('abc123');
      expect(fetchMock.mock.calls[1][0]).toBe('https://diavgeia.gov.gr/doc/TEST-ADA');
    });

    it('throws on non-OK download response', async () => {
      fetchMock
        .mockReturnValueOnce(ok(makeDecision()))
        .mockReturnValueOnce(Promise.resolve({
          ok: false,
          status: 404,
          statusText: 'Not Found',
        } as Response));

      await expect(client.downloadDocument('TEST-ADA')).rejects.toThrow(DiavgeiaError);
    });
  });

  // --- Search ---

  describe('search', () => {
    it('uses /opendata base path', async () => {
      fetchMock.mockReturnValueOnce(ok(makeSearchResponse([])));
      await client.search({ org: '6104' });
      expect(calledUrl().pathname).toBe('/opendata/search.json');
    });

    it('passes all search parameters', async () => {
      fetchMock.mockReturnValueOnce(ok(makeSearchResponse([])));
      await client.search({
        org: '6104',
        unit: '81689',
        from_issue_date: '2024-12-01',
        to_issue_date: '2024-12-31',
        status: 'PUBLISHED',
        type: 'Β.1.1',
        page: 0,
        size: 100,
      });

      const url = calledUrl();
      expect(url.searchParams.get('org')).toBe('6104');
      expect(url.searchParams.get('unit')).toBe('81689');
      expect(url.searchParams.get('from_issue_date')).toBe('2024-12-01');
      expect(url.searchParams.get('to_issue_date')).toBe('2024-12-31');
      expect(url.searchParams.get('status')).toBe('PUBLISHED');
      expect(url.searchParams.get('type')).toBe('Β.1.1');
      expect(url.searchParams.get('page')).toBe('0');
      expect(url.searchParams.get('size')).toBe('100');
    });

    it('omits undefined parameters', async () => {
      fetchMock.mockReturnValueOnce(ok(makeSearchResponse([])));
      await client.search({ org: '6104' });
      const url = calledUrl();
      expect(url.searchParams.has('unit')).toBe(false);
      expect(url.searchParams.has('type')).toBe(false);
    });

    it('returns search response with info and decisions', async () => {
      fetchMock.mockReturnValueOnce(ok(makeSearchResponse([makeDecision()], 42)));
      const result = await client.search({ org: '6104' });
      expect(result.info.total).toBe(42);
      expect(result.decisions).toHaveLength(1);
    });
  });

  describe('searchAdvanced', () => {
    it('passes lucene query', async () => {
      fetchMock.mockReturnValueOnce(ok(makeSearchResponse([])));
      await client.searchAdvanced({ q: 'organizationUid:"6104"' });
      const url = calledUrl();
      expect(url.pathname).toBe('/opendata/search/advanced.json');
      expect(url.searchParams.get('q')).toBe('organizationUid:"6104"');
    });
  });

  describe('searchAll', () => {
    it('yields all decisions across pages', async () => {
      fetchMock
        .mockReturnValueOnce(ok(makeSearchResponse(
          [makeDecision({ ada: 'A' }), makeDecision({ ada: 'B' })], 3,
        )))
        .mockReturnValueOnce(ok({
          info: { total: 3, page: 1, size: 2, actualSize: 1, query: '' },
          decisions: [makeDecision({ ada: 'C' })],
        }));

      const results: string[] = [];
      for await (const d of client.searchAll({ org: '6104', size: 2 })) {
        results.push(d.ada);
      }

      expect(results).toEqual(['A', 'B', 'C']);
    });
  });

  describe('searchTerms', () => {
    it('fetches search terms', async () => {
      fetchMock.mockReturnValueOnce(ok({ terms: [{ term: 'org', label: 'Organization' }] }));
      const terms = await client.searchTerms();
      expect(calledUrl().pathname).toBe('/opendata/search/terms.json');
      expect(terms).toHaveLength(1);
    });
  });

  describe('searchTermsCommon', () => {
    it('fetches common search terms', async () => {
      fetchMock.mockReturnValueOnce(ok({ terms: [] }));
      await client.searchTermsCommon();
      expect(calledUrl().pathname).toBe('/opendata/search/terms/common.json');
    });
  });

  // --- Reference data ---

  describe('decisionTypes', () => {
    it('fetches decision types', async () => {
      fetchMock.mockReturnValueOnce(ok({ decisionTypes: [] }));
      await client.decisionTypes();
      expect(calledUrl().pathname).toBe('/luminapi/opendata/types.json');
    });
  });

  describe('decisionTypeDetails', () => {
    it('fetches type details', async () => {
      fetchMock.mockReturnValueOnce(ok({ uid: 'Β.1.1', label: 'Test', extraFields: [] }));
      await client.decisionTypeDetails('Β.1.1');
      expect(calledUrl().pathname).toContain('/types/');
      expect(calledUrl().pathname).toContain('/details.json');
    });
  });

  describe('dictionaries', () => {
    it('fetches dictionary list', async () => {
      fetchMock.mockReturnValueOnce(ok({ dictionaries: [{ uid: 'ORG_CATEGORY' }] }));
      const dicts = await client.dictionaries();
      expect(calledUrl().pathname).toBe('/luminapi/opendata/dictionaries.json');
      expect(dicts).toHaveLength(1);
    });
  });

  describe('dictionary', () => {
    it('fetches dictionary items', async () => {
      fetchMock.mockReturnValueOnce(ok({ items: [{ uid: 'MUNICIPALITY', label: 'Δήμος' }] }));
      const items = await client.dictionary('ORG_CATEGORY');
      expect(calledUrl().pathname).toBe('/luminapi/opendata/dictionaries/ORG_CATEGORY.json');
      expect(items).toHaveLength(1);
    });
  });

  describe('positions', () => {
    it('fetches all positions', async () => {
      fetchMock.mockReturnValueOnce(ok({ positions: [] }));
      await client.positions();
      expect(calledUrl().pathname).toBe('/luminapi/opendata/positions.json');
    });
  });

  // --- Error handling ---

  describe('error handling', () => {
    it('throws DiavgeiaError on non-OK response', async () => {
      fetchMock.mockReturnValueOnce(notOk(404, 'Not Found'));
      await expect(client.organizations()).rejects.toThrow(DiavgeiaError);
    });

    it('includes status code in error', async () => {
      fetchMock.mockReturnValueOnce(notOk(500, 'Internal Server Error'));
      try {
        await client.organizations();
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(DiavgeiaError);
        expect((err as DiavgeiaError).status).toBe(500);
      }
    });

    it('throws DiavgeiaTimeoutError on timeout', async () => {
      const timeoutErr = new DOMException('The operation was aborted.', 'TimeoutError');
      fetchMock.mockRejectedValueOnce(timeoutErr);
      await expect(client.organizations()).rejects.toThrow(DiavgeiaTimeoutError);
    });

    it('re-throws other errors', async () => {
      fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
      await expect(client.organizations()).rejects.toThrow(TypeError);
    });
  });

  // --- Config ---

  describe('config', () => {
    it('uses default base URL', async () => {
      fetchMock.mockReturnValueOnce(ok({ organizations: [] }));
      await client.organizations();
      expect(calledUrl().origin).toBe('https://diavgeia.gov.gr');
    });

    it('allows custom base URL', async () => {
      const custom = new Diavgeia({ baseUrl: 'https://test3.diavgeia.gov.gr', fetch: fetchMock as unknown as typeof fetch });
      fetchMock.mockReturnValueOnce(ok({ organizations: [] }));
      await custom.organizations();
      expect(calledUrl().origin).toBe('https://test3.diavgeia.gov.gr');
    });
  });
});
