import { describe, it, expect, vi, beforeEach } from 'vitest';
import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { Diavgeia } from '../../client.js';

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

function makeDecision(overrides: Record<string, unknown> = {}) {
  return {
    ada: 'TEST-ADA',
    subject: 'Test',
    protocolNumber: '1/2024',
    issueDate: 1734566400000,
    publishTimestamp: 1734652800000,
    submissionTimestamp: 1734652800000,
    organizationId: '6104',
    unitIds: [],
    signerIds: [],
    decisionTypeId: 'Β.1.1',
    thematicCategoryIds: [],
    extraFieldValues: {},
    status: 'PUBLISHED',
    versionId: 'v1',
    correctedVersionId: null,
    documentUrl: 'https://diavgeia.gov.gr/doc/TEST-ADA',
    documentChecksum: null,
    url: 'https://diavgeia.gov.gr/luminapi/api/decisions/TEST-ADA',
    attachments: [],
    privateData: false,
    ...overrides,
  };
}

describe('decisions download', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let client: Diavgeia;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn();
    client = new Diavgeia({ fetch: fetchMock as unknown as typeof fetch });
  });

  it('downloads document and saves to file', async () => {
    const buffer = new ArrayBuffer(4);
    fetchMock
      .mockReturnValueOnce(Promise.resolve({
        ok: true, status: 200, statusText: 'OK',
        json: () => Promise.resolve(makeDecision()),
      } as Response))
      .mockReturnValueOnce(Promise.resolve({
        ok: true, status: 200, statusText: 'OK',
        arrayBuffer: () => Promise.resolve(buffer),
      } as Response));

    vi.mocked(existsSync).mockReturnValue(true); // dir exists

    const { registerDecisionsCommand } = await import('./decisions.js');
    const { Command } = await import('commander');
    const program = new Command();
    registerDecisionsCommand(program, client);

    await program.parseAsync(['node', 'test', 'decisions', 'download', 'TEST-ADA', '-o', '/tmp/test']);

    expect(writeFileSync).toHaveBeenCalledWith(
      '/tmp/test/TEST-ADA.pdf',
      expect.any(Buffer),
    );
  });

  it('skips existing files with --skip-existing', async () => {
    vi.mocked(existsSync).mockReturnValue(true); // both dir and file exist

    const { registerDecisionsCommand } = await import('./decisions.js');
    const { Command } = await import('commander');
    const program = new Command();
    registerDecisionsCommand(program, client);

    await program.parseAsync(['node', 'test', 'decisions', 'download', 'TEST-ADA', '--skip-existing']);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(writeFileSync).not.toHaveBeenCalled();
  });

  it('creates output directory if it does not exist', async () => {
    const buffer = new ArrayBuffer(4);
    fetchMock
      .mockReturnValueOnce(Promise.resolve({
        ok: true, status: 200, statusText: 'OK',
        json: () => Promise.resolve(makeDecision()),
      } as Response))
      .mockReturnValueOnce(Promise.resolve({
        ok: true, status: 200, statusText: 'OK',
        arrayBuffer: () => Promise.resolve(buffer),
      } as Response));

    vi.mocked(existsSync).mockReturnValueOnce(false) // dir doesn't exist
      .mockReturnValue(false); // file doesn't exist

    const { registerDecisionsCommand } = await import('./decisions.js');
    const { Command } = await import('commander');
    const program = new Command();
    registerDecisionsCommand(program, client);

    await program.parseAsync(['node', 'test', 'decisions', 'download', 'TEST-ADA', '-o', '/tmp/newdir']);

    expect(mkdirSync).toHaveBeenCalledWith('/tmp/newdir', { recursive: true });
  });
});
