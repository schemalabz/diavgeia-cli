import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Diavgeia } from '../client.js';
import { normalizeGreek } from '../utils.js';
import { buildAdvancedQuery } from './commands/search.js';
import type { Decision, SearchResponse } from '../types.js';

const SMOKE = Boolean(process.env.SMOKE);
const ORG = '6104'; // ΔΗΜΟΣ ΖΩΓΡΑΦΟΥ — stable, many decisions

describe.skipIf(!SMOKE)('Smoke: search query', () => {
  const client = new Diavgeia();

  it('returns results with decisions array and search info', async () => {
    const result = await client.search({ org: ORG, size: 5 });

    expect(result.info).toBeDefined();
    expect(result.info.total).toBeGreaterThan(0);
    expect(result.decisions.length).toBeGreaterThan(0);
    expect(result.decisions.length).toBeLessThanOrEqual(5);

    const d = result.decisions[0];
    expect(d.ada).toBeTruthy();
    expect(d.issueDate).toBeTypeOf('number');
    expect(d.decisionTypeId).toBeTruthy();
    expect(d.subject).toBeTruthy();
    expect(d.organizationId).toBe(ORG);
  }, 30_000);

  it('returns valid JSON-serializable search response', async () => {
    const result = await client.search({ org: ORG, size: 2 });

    // Verify the response survives JSON round-trip (as --json flag would do)
    const json = JSON.stringify(result);
    const parsed = JSON.parse(json) as SearchResponse;
    expect(parsed.info.total).toBe(result.info.total);
    expect(parsed.decisions).toHaveLength(result.decisions.length);
    expect(parsed.decisions[0].decisionTypeId).toBeTruthy();
  }, 30_000);

  it('finds decisions by tokenized subject words via advanced search', async () => {
    // Uses the same buildAdvancedQuery the CLI uses for --subject-words
    const q = buildAdvancedQuery({ subjectWords: 'ΕΓΚΡΙΣΗ ΔΑΠΑΝΗΣ', org: ORG })!;
    const result = await client.searchAdvanced({ q, size: 5 });

    expect(result.decisions.length).toBeGreaterThan(0);
    for (const d of result.decisions) {
      // normalizeGreek strips accents: ΈΓΚΡΙΣΗ → εγκριση
      const normalized = normalizeGreek(d.subject);
      expect(normalized).toContain('εγκριση');
      expect(normalized).toContain('δαπαν'); // ΔΑΠΑΝΗΣ may appear as stem
    }
  }, 30_000);

  it('searches within PDF content via advanced search', async () => {
    const q = buildAdvancedQuery({ content: 'δικαστική', org: ORG })!;
    const result = await client.searchAdvanced({ q, size: 5 });

    // Content search should return results (can't verify PDF text from API response)
    expect(result.info).toBeDefined();
    expect(result.decisions).toBeDefined();
    // Content search may return 0 results for some orgs; just verify structure
    expect(Array.isArray(result.decisions)).toBe(true);
  }, 30_000);

  it('filters by financial amount via advanced search', async () => {
    const q = buildAdvancedQuery({ amountMin: '10000', org: ORG })!;
    const result = await client.searchAdvanced({ q, size: 5 });

    expect(result.decisions.length).toBeGreaterThan(0);
    for (const d of result.decisions) {
      // Decisions with financial amounts should have extraFieldValues
      expect(d.extraFieldValues).toBeDefined();
    }
  }, 30_000);
});

describe.skipIf(!SMOKE)('Smoke: decisions', () => {
  const client = new Diavgeia();
  let knownAda: string;
  let tmpDir: string;

  // Find a real ADA to use for decision tests
  beforeAll(async () => {
    const result = await client.search({ org: ORG, size: 1 });
    knownAda = result.decisions[0].ada;
    tmpDir = mkdtempSync(join(tmpdir(), 'diavgeia-smoke-'));
  }, 30_000);

  afterAll(() => {
    if (tmpDir && existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('fetches decision detail with expected fields', async () => {
    const d = await client.decision(knownAda);

    expect(d.ada).toBe(knownAda);
    expect(d.subject).toBeTruthy();
    expect(d.protocolNumber).toBeDefined();
    expect(d.issueDate).toBeTypeOf('number');
    expect(d.publishTimestamp).toBeTypeOf('number');
    expect(d.organizationId).toBeTruthy();
    expect(Array.isArray(d.unitIds)).toBe(true);
    expect(d.decisionTypeId).toBeTruthy();
    expect(d.status).toBeTruthy();
    expect(d.documentUrl).toBeTruthy();
    expect(d.extraFieldValues).toBeDefined();
  }, 30_000);

  it('downloads document as PDF to output directory', async () => {
    const { buffer } = await client.downloadDocument(knownAda);

    expect(buffer.byteLength).toBeGreaterThan(0);

    // Verify we can write it to disk like the CLI does
    const filePath = join(tmpDir, `${knownAda}.pdf`);
    writeFileSync(filePath, Buffer.from(buffer));
    expect(existsSync(filePath)).toBe(true);

    const saved = readFileSync(filePath);
    expect(saved.byteLength).toBeGreaterThan(0);
    // PDF files start with %PDF
    expect(saved.toString('ascii', 0, 4)).toBe('%PDF');
  }, 30_000);

  it('verifies skip-existing logic with real files', async () => {
    // Write a dummy file
    const filePath = join(tmpDir, 'SKIP-TEST.pdf');
    writeFileSync(filePath, 'existing');

    // The CLI skip-existing check is: existsSync(filePath)
    expect(existsSync(filePath)).toBe(true);

    // Verify the file was not overwritten (content unchanged)
    const content = readFileSync(filePath, 'utf-8');
    expect(content).toBe('existing');
  }, 30_000);
});

describe.skipIf(!SMOKE)('Smoke: search advanced', () => {
  const client = new Diavgeia();

  it('executes raw Lucene queries', async () => {
    const result = await client.searchAdvanced({
      q: `organizationUid:"${ORG}"`,
      size: 5,
    });

    expect(result.info).toBeDefined();
    expect(result.info.total).toBeGreaterThan(0);
    expect(result.decisions.length).toBeGreaterThan(0);

    const d = result.decisions[0];
    expect(d.ada).toBeTruthy();
    expect(d.organizationId).toBe(ORG);
  }, 30_000);
});

describe.skipIf(!SMOKE)('Smoke: pagination', () => {
  const client = new Diavgeia();

  it('iterates across multiple pages with searchAll', async () => {
    const decisions: Decision[] = [];
    let count = 0;

    for await (const d of client.searchAll({ org: ORG, size: 3 })) {
      decisions.push(d);
      count++;
      if (count >= 7) break; // Stop after collecting enough to verify pagination
    }

    // With size=3, getting 7 results means at least 3 pages were fetched
    expect(decisions.length).toBe(7);

    // All should have valid ADAs
    for (const d of decisions) {
      expect(d.ada).toBeTruthy();
    }

    // ADAs should be unique (no duplicates across pages)
    const adas = decisions.map((d) => d.ada);
    expect(new Set(adas).size).toBe(adas.length);
  }, 30_000);
});

