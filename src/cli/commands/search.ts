import { Command } from 'commander';
import type { Diavgeia } from '../../client.js';
import type { SearchParams, Decision } from '../../types.js';
import { output, formatSearchResults, shouldJson, handleError } from './output.js';
import { msToISODate } from '../../utils.js';

/**
 * Split a date range into non-overlapping windows of at most maxDays.
 * Input dates are YYYY-MM-DD strings.
 */
export function computeWindows(from: string, to: string, maxDays = 180): Array<{ from: string; to: string }> {
  const start = new Date(from + 'T00:00:00Z');
  const end = new Date(to + 'T00:00:00Z');

  if (end <= start) {
    return [{ from, to }];
  }

  const windows: Array<{ from: string; to: string }> = [];
  let current = start;

  while (current <= end) {
    const windowEnd = new Date(current.getTime() + maxDays * 24 * 60 * 60 * 1000);
    const actualEnd = windowEnd < end ? windowEnd : end;

    windows.push({
      from: current.toISOString().split('T')[0],
      to: actualEnd.toISOString().split('T')[0],
    });

    current = new Date(actualEnd.getTime() + 24 * 60 * 60 * 1000); // next day after window end
  }

  return windows;
}

/**
 * Build a Lucene query for tokenized subject matching.
 * Each word is AND-joined: "word1 word2" → "subject:word1 AND subject:word2"
 */
export function buildSubjectWordsQuery(text: string): string {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  if (words.length === 1) return `subject:"${words[0]}"`;
  return words.map((w) => `subject:"${w}"`).join(' AND ');
}

export interface AdvancedQueryOpts {
  subjectWords?: string;
  content?: string;
  amountMin?: string;
  amountMax?: string;
  org?: string;
  type?: string;
  from?: string;
  to?: string;
  status?: string;
}

/**
 * Build a Lucene query from convenience flags.
 * Returns null if no advanced flags are present.
 */
export function buildAdvancedQuery(opts: AdvancedQueryOpts): string | null {
  const parts: string[] = [];

  if (opts.subjectWords) {
    const q = buildSubjectWordsQuery(opts.subjectWords);
    if (q) parts.push(q);
  }

  if (opts.content) {
    parts.push(`content:"${opts.content}"`);
  }

  if (opts.amountMin != null && opts.amountMax != null) {
    parts.push(`amount:[${opts.amountMin} TO ${opts.amountMax}]`);
  } else if (opts.amountMin != null) {
    parts.push(`amount:[${opts.amountMin} TO 999999999]`);
  } else if (opts.amountMax != null) {
    parts.push(`amount:[0 TO ${opts.amountMax}]`);
  }

  // If no advanced-specific flags were used, return null
  if (parts.length === 0) return null;

  // Translate common flags to Lucene equivalents
  if (opts.org) parts.push(`organizationUid:"${opts.org}"`);
  if (opts.type) parts.push(`decisionTypeUid:"${opts.type}"`);
  if (opts.from && opts.to) {
    parts.push(`issueDate:[${opts.from} TO ${opts.to}]`);
  } else if (opts.from) {
    parts.push(`issueDate:[${opts.from} TO *]`);
  } else if (opts.to) {
    parts.push(`issueDate:[* TO ${opts.to}]`);
  }
  if (opts.status) parts.push(`status:"${opts.status}"`);

  return parts.join(' AND ');
}

function daysBetween(from: string, to: string): number {
  const start = new Date(from + 'T00:00:00Z');
  const end = new Date(to + 'T00:00:00Z');
  return Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

export function registerSearchCommand(program: Command, client: Diavgeia): void {
  const search = program
    .command('search')
    .description('Search decisions');

  search
    .command('query', { isDefault: true })
    .description('Search with named parameters')
    .option('--org <orgId>', 'Organization UID')
    .option('--unit <unitId>', 'Unit UID')
    .option('--from <date>', 'Start issue date (YYYY-MM-DD)')
    .option('--to <date>', 'End issue date (YYYY-MM-DD)')
    .option('--status <status>', 'Decision status (e.g. PUBLISHED)')
    .option('--type <typeId>', 'Decision type UID')
    .option('--query <text>', 'Free-text keyword search')
    .option('--subject <text>', 'Search by subject text (exact phrase)')
    .option('--subject-words <text>', 'Search by subject words (AND-joined, tokenized)')
    .option('--content <text>', 'Search within document content (PDF text)')
    .option('--amount-min <n>', 'Minimum financial amount')
    .option('--amount-max <n>', 'Maximum financial amount')
    .option('--ada <ada>', 'Search by specific ADA')
    .option('--protocol <number>', 'Search by protocol number')
    .option('--signer <signerId>', 'Filter by signer UID')
    .option('--tag <tag>', 'Thematic category')
    .option('--sort <order>', 'Sort order (recent or relative)')
    .option('--size <n>', 'Results per page (max 500)', '50')
    .option('--page <n>', 'Page number (0-indexed)', '0')
    .option('--all', 'Fetch all pages (streams results)')
    .option('--no-window', 'Disable auto-windowing for wide date ranges')
    .action(async (opts) => {
      try {
        if (opts.subject && opts.subjectWords) {
          console.error('Error: --subject and --subject-words cannot be used together');
          process.exit(1);
        }

        // Check if any advanced flags trigger Lucene mode
        const advancedQuery = buildAdvancedQuery({
          subjectWords: opts.subjectWords,
          content: opts.content,
          amountMin: opts.amountMin,
          amountMax: opts.amountMax,
          org: opts.org,
          type: opts.type,
          from: opts.from,
          to: opts.to,
          status: opts.status,
        });

        if (advancedQuery) {
          const size = parseInt(opts.size, 10);
          const page = parseInt(opts.page, 10);

          if (opts.all) {
            await streamAdvancedAll(client, advancedQuery, size);
          } else {
            const result = await client.searchAdvanced({ q: advancedQuery, page, size });
            output(result, (data) => {
              const r = data as typeof result;
              return formatSearchResults(r.decisions, r.info.total, r.info.page);
            });
          }
          return;
        }

        const params: SearchParams = {
          org: opts.org,
          unit: opts.unit,
          from_issue_date: opts.from,
          to_issue_date: opts.to,
          status: opts.status,
          type: opts.type,
          q: opts.query,
          subject: opts.subject,
          ada: opts.ada,
          protocol: opts.protocol,
          signer: opts.signer,
          tag: opts.tag,
          sort: opts.sort,
          size: parseInt(opts.size, 10),
          page: parseInt(opts.page, 10),
        };

        const needsWindowing = opts.window && opts.from && opts.to && daysBetween(opts.from, opts.to) > 180;

        if (needsWindowing) {
          const windows = computeWindows(opts.from, opts.to);
          const all: Decision[] = [];

          for (const win of windows) {
            if (process.stderr.isTTY) {
              process.stderr.write(`Searching ${win.from} to ${win.to}...`);
            }

            const windowParams = { ...params, from_issue_date: win.from, to_issue_date: win.to };

            if (opts.all) {
              const { page: _, ...rest } = windowParams;
              for await (const decision of client.searchAll(rest)) {
                all.push(decision);
              }
            } else {
              const result = await client.search(windowParams);
              all.push(...result.decisions);
            }

            if (process.stderr.isTTY) {
              process.stderr.write(` (${all.length} results so far)\n`);
            }
          }

          if (shouldJson()) {
            console.log(JSON.stringify(all, null, 2));
          } else {
            for (const d of all) {
              console.log(`${d.ada.padEnd(16)} ${msToISODate(d.issueDate)}  ${d.subject.substring(0, 80)}`);
            }
            console.log(`\n${all.length} total results`);
          }
        } else if (opts.all) {
          await streamAll(client, params);
        } else {
          const result = await client.search(params);
          output(result, (data) => {
            const r = data as typeof result;
            return formatSearchResults(r.decisions, r.info.total, r.info.page);
          });
        }
      } catch (err) {
        handleError(err);
      }
    });

  search
    .command('advanced <query>')
    .description('Advanced search with Lucene query syntax')
    .option('--size <n>', 'Results per page', '50')
    .option('--page <n>', 'Page number', '0')
    .option('--all', 'Fetch all pages')
    .action(async (query: string, opts) => {
      try {
        if (opts.all) {
          await streamAdvancedAll(client, query, parseInt(opts.size, 10));
        } else {
          const result = await client.searchAdvanced({
            q: query,
            page: parseInt(opts.page, 10),
            size: parseInt(opts.size, 10),
          });
          output(result, (data) => {
            const r = data as typeof result;
            return formatSearchResults(r.decisions, r.info.total, r.info.page);
          });
        }
      } catch (err) {
        handleError(err);
      }
    });

  search
    .command('terms')
    .description('List searchable fields')
    .option('--common', 'Show only common fields')
    .action(async (opts) => {
      try {
        const { formatTerms } = await import('./output.js');
        const terms = opts.common
          ? await client.searchTermsCommon()
          : await client.searchTerms();
        output(terms, (data) => formatTerms(data as typeof terms));
      } catch (err) {
        handleError(err);
      }
    });
}

async function streamAdvancedAll(client: Diavgeia, q: string, size: number): Promise<void> {
  let page = 0;
  const all: Decision[] = [];

  while (true) {
    const result = await client.searchAdvanced({ q, page, size });
    all.push(...result.decisions);
    const totalPages = Math.ceil(result.info.total / size);
    if (page >= totalPages - 1 || result.decisions.length === 0) break;
    page++;
  }

  if (shouldJson()) {
    console.log(JSON.stringify(all, null, 2));
  } else {
    for (const d of all) {
      console.log(`${d.ada.padEnd(16)} ${msToISODate(d.issueDate)}  ${d.subject.substring(0, 80)}`);
    }
    console.log(`\n${all.length} total results`);
  }
}

async function streamAll(client: Diavgeia, params: SearchParams): Promise<void> {
  const { page: _, ...rest } = params;
  const all: Decision[] = [];

  for await (const decision of client.searchAll(rest)) {
    all.push(decision);
  }

  if (shouldJson()) {
    console.log(JSON.stringify(all, null, 2));
  } else {
    for (const d of all) {
      console.log(`${d.ada.padEnd(16)} ${msToISODate(d.issueDate)}  ${d.subject.substring(0, 80)}`);
    }
    console.log(`\n${all.length} total results`);
  }
}
