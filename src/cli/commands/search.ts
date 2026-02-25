import { Command } from 'commander';
import type { Diavgeia } from '../../client.js';
import type { SearchParams, Decision } from '../../types.js';
import { output, formatSearchResults, shouldJson, handleError } from './output.js';
import { msToISODate } from '../../utils.js';

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
    .option('--subject <text>', 'Search by subject text')
    .option('--ada <ada>', 'Search by specific ADA')
    .option('--protocol <number>', 'Search by protocol number')
    .option('--signer <signerId>', 'Filter by signer UID')
    .option('--tag <tag>', 'Thematic category')
    .option('--sort <order>', 'Sort order (recent or relative)')
    .option('--size <n>', 'Results per page (max 500)', '50')
    .option('--page <n>', 'Page number (0-indexed)', '0')
    .option('--all', 'Fetch all pages (streams results)')
    .action(async (opts) => {
      try {
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

        if (opts.all) {
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
          // For advanced search --all, paginate manually
          const size = parseInt(opts.size, 10);
          let page = 0;
          const all: Decision[] = [];

          while (true) {
            const result = await client.searchAdvanced({ q: query, page, size });
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
