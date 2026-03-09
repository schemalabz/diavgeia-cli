import { describe, it, expect } from 'vitest';
import { extractAmount, enrichDecision } from './extract.js';
import type { Decision } from './types.js';

describe('extractAmount', () => {
  it('extracts amountWithVAT (Β.1.3 budget commitment)', () => {
    const result = extractAmount({ amountWithVAT: { amount: 15000.50, currency: 'EUR' } });
    expect(result).toEqual({ amount: 15000.50, currency: 'EUR' });
  });

  it('sums sponsor expenseAmounts (Β.2.2 payments)', () => {
    const result = extractAmount({
      sponsor: [
        { expenseAmount: { amount: 1000, currency: 'EUR' } },
        { expenseAmount: { amount: 2500.75, currency: 'EUR' } },
      ],
    });
    expect(result).toEqual({ amount: 3500.75, currency: 'EUR' });
  });

  it('extracts awardAmount (Δ.1 contract award)', () => {
    const result = extractAmount({ awardAmount: { amount: 50000, currency: 'EUR' } });
    expect(result).toEqual({ amount: 50000, currency: 'EUR' });
  });

  it('extracts estimatedAmount (Δ.2.1 tender)', () => {
    const result = extractAmount({ estimatedAmount: { amount: 120000, currency: 'USD' } });
    expect(result).toEqual({ amount: 120000, currency: 'USD' });
  });

  it('follows priority order — amountWithVAT wins over sponsor', () => {
    const result = extractAmount({
      amountWithVAT: { amount: 100, currency: 'EUR' },
      sponsor: [{ expenseAmount: { amount: 200, currency: 'EUR' } }],
    });
    expect(result).toEqual({ amount: 100, currency: 'EUR' });
  });

  it('returns null when no amount fields present', () => {
    expect(extractAmount({})).toBeNull();
    expect(extractAmount({ someOtherField: 'value' })).toBeNull();
  });

  it('returns null when amountWithVAT has no numeric amount (API stripping)', () => {
    expect(extractAmount({ amountWithVAT: { currency: 'EUR' } })).toBeNull();
  });

  it('returns null for empty sponsor array', () => {
    expect(extractAmount({ sponsor: [] })).toBeNull();
  });

  it('returns null when sponsor entries lack expenseAmount', () => {
    expect(extractAmount({ sponsor: [{ name: 'test' }] })).toBeNull();
  });

  it('defaults currency to EUR when missing', () => {
    const result = extractAmount({ awardAmount: { amount: 5000 } });
    expect(result).toEqual({ amount: 5000, currency: 'EUR' });
  });

  it('sums only sponsors with valid amounts, skipping missing ones', () => {
    const result = extractAmount({
      sponsor: [
        { expenseAmount: { amount: 1000, currency: 'EUR' } },
        { expenseAmount: { currency: 'EUR' } },
        { expenseAmount: { amount: 500, currency: 'EUR' } },
      ],
    });
    expect(result).toEqual({ amount: 1500, currency: 'EUR' });
  });
});

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

describe('enrichDecision', () => {
  it('adds _extracted.amount when extraFieldValues has amount', () => {
    const d = makeDecision({
      extraFieldValues: { awardAmount: { amount: 5000, currency: 'EUR' } },
    });
    const enriched = enrichDecision(d);
    expect(enriched._extracted.amount).toEqual({ amount: 5000, currency: 'EUR' });
  });

  it('sets _extracted.amount to null when no amount present', () => {
    const d = makeDecision();
    const enriched = enrichDecision(d);
    expect(enriched._extracted.amount).toBeNull();
  });

  it('preserves all original decision fields', () => {
    const d = makeDecision({
      extraFieldValues: { awardAmount: { amount: 5000, currency: 'EUR' } },
    });
    const enriched = enrichDecision(d);
    expect(enriched.ada).toBe('ΨΘ82ΩΡΦ-7ΑΙ');
    expect(enriched.subject).toBe('ΕΓΚΡΙΣΗ ΠΡΟΫΠΟΛΟΓΙΣΜΟΥ');
    expect(enriched.extraFieldValues).toEqual({ awardAmount: { amount: 5000, currency: 'EUR' } });
  });

  it('handles missing extraFieldValues gracefully', () => {
    const d = makeDecision({ extraFieldValues: undefined as unknown as Record<string, unknown> });
    const enriched = enrichDecision(d);
    expect(enriched._extracted.amount).toBeNull();
  });
});
