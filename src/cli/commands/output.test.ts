import { describe, it, expect } from 'vitest';
import { formatDecision, formatSearchResults } from './output.js';
import type { Decision } from '../../types.js';

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

describe('formatDecision', () => {
  it('shows basic fields', () => {
    const result = formatDecision(makeDecision());
    expect(result).toContain('ΨΘ82ΩΡΦ-7ΑΙ');
    expect(result).toContain('Β.1.1');
    expect(result).toContain('ΕΓΚΡΙΣΗ ΠΡΟΫΠΟΛΟΓΙΣΜΟΥ');
  });

  it('shows FEK info from extraFieldValues', () => {
    const result = formatDecision(makeDecision({
      extraFieldValues: {
        fek: { aa: '42', issue: 'Β', issueyear: '2024' },
      },
    }));
    expect(result).toContain('Extra fields:');
    expect(result).toContain('FEK:        42/Β/2024');
  });

  it('shows financial amount formatted', () => {
    const result = formatDecision(makeDecision({
      extraFieldValues: {
        financialAmount: 15000.5,
      },
    }));
    expect(result).toContain('Extra fields:');
    expect(result).toMatch(/Amount:\s+15/);
  });

  it('shows no extra section when extraFieldValues is empty', () => {
    const result = formatDecision(makeDecision({ extraFieldValues: {} }));
    expect(result).not.toContain('Extra fields:');
  });

  it('shows other extra fields as key-value pairs', () => {
    const result = formatDecision(makeDecision({
      extraFieldValues: {
        relatedDecisions: 'ΑΒΓ-123',
      },
    }));
    expect(result).toContain('relatedDecisions: ΑΒΓ-123');
  });

  it('skips null/empty extra field values', () => {
    const result = formatDecision(makeDecision({
      extraFieldValues: {
        emptyStr: '',
        nullVal: null,
        emptyArr: [],
        emptyObj: {},
        financialAmount: 100,
      },
    }));
    expect(result).not.toContain('emptyStr');
    expect(result).not.toContain('nullVal');
    expect(result).not.toContain('emptyArr');
    expect(result).not.toContain('emptyObj');
    expect(result).toContain('Amount:');
  });
});

describe('formatSearchResults', () => {
  it('includes decisionTypeId column', () => {
    const result = formatSearchResults([makeDecision()], 1, 0);
    expect(result).toContain('Β.1.1');
  });

  it('shows header with empty decisions', () => {
    const result = formatSearchResults([], 0, 0);
    expect(result).toContain('0 results (page 0)');
  });

  it('includes ADA and date', () => {
    const result = formatSearchResults([makeDecision()], 1, 0);
    expect(result).toContain('ΨΘ82ΩΡΦ-7ΑΙ');
    expect(result).toContain('2024-12-19');
  });
});
