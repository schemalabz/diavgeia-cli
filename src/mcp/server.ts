import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { Diavgeia } from '../client.js';
import { msToISODate, normalizeGreek } from '../utils.js';
import { enrichDecision } from '../extract.js';
import { buildAdvancedQuery, computeWindows } from '../cli/commands/search.js';
import type { Decision, Organization, SearchParams } from '../types.js';

const MAX_RESULTS = 2000;
const client = new Diavgeia();

function formatDecisionForAgent(d: Decision & { _extracted?: { amount: { amount: number; currency: string } | null } }): Record<string, unknown> {
  return {
    ada: d.ada,
    subject: d.subject,
    protocolNumber: d.protocolNumber,
    issueDate: msToISODate(d.issueDate),
    publishDate: msToISODate(d.publishTimestamp),
    organizationId: d.organizationId,
    decisionTypeId: d.decisionTypeId,
    status: d.status,
    documentUrl: d.documentUrl,
    diavgeiaUrl: `https://diavgeia.gov.gr/decision/view/${d.ada}`,
    amount: d._extracted?.amount ?? null,
    extraFields: d.extraFieldValues,
  };
}

function errorResult(msg: string) {
  return { content: [{ type: 'text' as const, text: `Error: ${msg}` }], isError: true as const };
}

export function createServer(): McpServer {
  const server = new McpServer({
    name: 'diavgeia',
    version: '0.1.0',
  });

  // --- Tool 1: search_organizations ---
  server.tool(
    'search_organizations',
    `Search Greek government organizations (municipalities, ministries, etc.) by name.
Returns organization UID (needed for search_decisions), label, category, and status.
Use this to find the org ID before searching decisions.
Example: search for "Χαλανδρίου" to find ΔΗΜΟΣ ΧΑΛΑΝΔΡΙΟΥ (uid: 6314).`,
    {
      query: z.string().describe('Name or part of name to search for (Greek text). Example: "��αλανδρίου", "Παιδείας"'),
      category: z.string().optional().describe('Filter by category. Common values: MUNICIPALITY, MINISTRY, UNIVERSITY, REGION, INDEPENDENT_AUTHORITY'),
    },
    async ({ query, category }) => {
      try {
        const orgs = await client.organizations({ category, status: 'active' });
        const needle = normalizeGreek(query);
        const matches = orgs.filter((o: Organization) =>
          normalizeGreek(o.label).includes(needle) ||
          normalizeGreek(o.abbreviation || '').includes(needle)
        );

        if (matches.length === 0) {
          return {
            content: [{ type: 'text', text: `No organizations found matching "${query}". Try a shorter or different term.` }],
          };
        }

        const results = matches.slice(0, 20).map((o: Organization) => ({
          uid: o.uid,
          label: o.label,
          abbreviation: o.abbreviation,
          category: o.category,
        }));

        return {
          content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
        };
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // --- Tool 2: search_decisions ---
  server.tool(
    'search_decisions',
    `Search Greek government decisions on Diavgeia (transparency portal). 71+ million decisions since 2010.
Supports: organization filter, date ranges, subject keywords, financial amount ranges, PDF content search.

IMPORTANT NOTES:
- Use "subject_words" for topic search (tokenized AND-matching, finds word variations). NOT exact match.
- Date ranges over 6 months are automatically split into windows (API limitation).
- Use org_id from search_organizations tool. Common: 6314=Χαλανδρίου, 6104=Ζωγράφου.
- Results are sorted by most recent first.
- Returns max 50 results per call. Use "page" for pagination or "fetch_all" for everything (max 2000 results).
- Financial amounts are in EUR. Use amount_min/amount_max to find contracts/spending above thresholds.
- Use "unit_id" to narrow to a specific department (get IDs from get_organization_units tool).
- Use "decision_type" to filter by type (use list_decision_types tool to find valid IDs).`,
    {
      org_id: z.string().optional().describe('Organization UID (numeric string). Get this from search_organizations first.'),
      unit_id: z.string().optional().describe('Unit/department UID within an org. Get this from get_organization_units tool.'),
      subject_words: z.string().optional().describe('Subject keyword search (tokenized, AND-joined). Example: "κυλικείο δημοτικό" finds decisions with both words in subject.'),
      from_date: z.string().optional().describe('Start date YYYY-MM-DD. Example: "2026-03-01"'),
      to_date: z.string().optional().describe('End date YYYY-MM-DD. Example: "2026-03-31"'),
      amount_min: z.number().optional().describe('Minimum financial amount in EUR. Example: 10000'),
      amount_max: z.number().optional().describe('Maximum financial amount in EUR. Example: 50000'),
      content: z.string().optional().describe('Search within PDF content (full text). Slower than subject search.'),
      decision_type: z.string().optional().describe('Decision type ID. Use list_decision_types to find valid IDs. Example: "Β.1.3" for budget commitments, "Δ.1" for contract awards.'),
      free_text: z.string().optional().describe('General keyword search across all fields. Cannot combine with subject_words/content/amount filters.'),
      page: z.number().optional().describe('Page number (0-indexed). Each page has 50 results.'),
      fetch_all: z.boolean().optional().describe('Fetch ALL results (max 2000). Use for comprehensive queries with narrow filters.'),
    },
    async ({ org_id, unit_id, subject_words, from_date, to_date, amount_min, amount_max, content, decision_type, free_text, page, fetch_all }) => {
      try {
        const amountMinStr = amount_min != null ? String(amount_min) : undefined;
        const amountMaxStr = amount_max != null ? String(amount_max) : undefined;

        // Determine if we need advanced search (subject_words, content, or amount filters)
        // Note: status is NOT passed to advanced Lucene queries — the field isn't reliably
        // indexed. The simple search path uses the status query param instead.
        const advancedQuery = buildAdvancedQuery({
          subjectWords: subject_words,
          content: content,
          amountMin: amountMinStr,
          amountMax: amountMaxStr,
          org: org_id,
          type: decision_type,
          from: from_date,
          to: to_date,
        });

        let decisions: Decision[] = [];
        let total = 0;
        let truncated = false;

        if (advancedQuery) {
          // Incorporate unit_id into the advanced query
          const fullQuery = unit_id ? `${advancedQuery} AND unitUid:"${unit_id}"` : advancedQuery;

          // Advanced search path
          const needsWindowing = from_date && to_date && daysBetween(from_date, to_date) > 180;

          if (needsWindowing && fetch_all) {
            const baseQuery = buildAdvancedQuery({
              subjectWords: subject_words,
              content: content,
              amountMin: amountMinStr,
              amountMax: amountMaxStr,
              org: org_id,
              type: decision_type,
            })!;
            const baseWithUnit = unit_id ? `${baseQuery} AND unitUid:"${unit_id}"` : baseQuery;
            const windows = computeWindows(from_date!, to_date!);

            for (const win of windows) {
              if (decisions.length >= MAX_RESULTS) { truncated = true; break; }
              const windowQuery = `${baseWithUnit} AND issueDate:[DT(${win.from}T00:00:00) TO DT(${win.to}T23:59:59)]`;
              let windowPage = 0;
              while (true) {
                const result = await client.searchAdvanced({ q: windowQuery, page: windowPage, size: 500 });
                decisions.push(...result.decisions);
                if (decisions.length >= MAX_RESULTS) { truncated = true; break; }
                if (windowPage >= Math.ceil(result.info.total / 500) - 1 || result.decisions.length === 0) break;
                windowPage++;
              }
            }
            total = decisions.length;
          } else if (fetch_all) {
            let p = 0;
            while (true) {
              const result = await client.searchAdvanced({ q: fullQuery, page: p, size: 500 });
              decisions.push(...result.decisions);
              total = result.info.total;
              if (decisions.length >= MAX_RESULTS) { truncated = true; break; }
              if (p >= Math.ceil(result.info.total / 500) - 1 || result.decisions.length === 0) break;
              p++;
            }
          } else {
            const result = await client.searchAdvanced({ q: fullQuery, page: page ?? 0, size: 50 });
            decisions = result.decisions;
            total = result.info.total;
          }
        } else {
          // Simple search path
          const params: SearchParams = {
            org: org_id,
            unit: unit_id,
            from_issue_date: from_date,
            to_issue_date: to_date,
            type: decision_type,
            q: free_text,
            status: 'PUBLISHED',
            page: page ?? 0,
            size: 50,
          };

          if (fetch_all) {
            for await (const d of client.searchAll(params)) {
              decisions.push(d);
              if (decisions.length >= MAX_RESULTS) { truncated = true; break; }
            }
            total = decisions.length;
          } else {
            const result = await client.search(params);
            decisions = result.decisions;
            total = result.info.total;
          }
        }

        if (truncated) {
          decisions = decisions.slice(0, MAX_RESULTS);
        }

        const enriched = decisions.map((d) => formatDecisionForAgent(enrichDecision(d)));

        let summary = `Found ${total} total results. Showing ${enriched.length}.`;
        if (truncated) {
          summary += ` (Truncated at ${MAX_RESULTS} — narrow your date range or add filters for complete results.)`;
        }
        return {
          content: [{ type: 'text', text: `${summary}\n\n${JSON.stringify(enriched, null, 2)}` }],
        };
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // --- Tool 3: get_decision ---
  server.tool(
    'get_decision',
    `Get full details of a specific Greek government decision by its ADA (unique identifier).
ADA format: Greek letters + numbers, e.g. "9Β3ΘΩΗΔ-ΚΝΑ".
Returns: subject, dates, organization, type, financial amounts, document URL, extra metadata fields.`,
    {
      ada: z.string().describe('The ADA (Αριθμός Διαδικτυακής Ανάρτ��σης) of the decision. Example: "9Β3ΘΩΗΔ-ΚΝΑ"'),
    },
    async ({ ada }) => {
      try {
        const decision = await client.decision(ada);
        const enriched = formatDecisionForAgent(enrichDecision(decision));
        return {
          content: [{ type: 'text', text: JSON.stringify(enriched, null, 2) }],
        };
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // --- Tool 4: get_organization_units ---
  server.tool(
    'get_organization_units',
    `List departments/units within a Greek government organization.
Useful to narrow searches to a specific unit (e.g. "ΔΗΜΟΤΙΚΟ ΣΥΜΒΟΥΛΙΟ" for municipal council decisions).
Returns unit UID that you can pass as "unit_id" to search_decisions.`,
    {
      org_id: z.string().describe('Organization UID (from search_organizations). Example: "6314"'),
    },
    async ({ org_id }) => {
      try {
        const units = await client.units(org_id);
        const results = units.map((u) => ({
          uid: u.uid,
          label: u.label,
          active: u.active,
          category: u.category,
        }));
        return {
          content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
        };
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // --- Tool 5: list_decision_types ---
  server.tool(
    'list_decision_types',
    `List all decision type categories in Diavgeia. Useful to understand what types of decisions exist
and to filter searches by type.
Common types:
- Β.1.3 = Budget commitment (ΑΝΑΛΗΨΗ ΥΠΟΧΡΕΩΣΗΣ)
- Β.2.1 = Expenditure approval (ΕΓΚΡΙΣΗ ΔΑΠΑΝΗΣ)
- Β.2.2 = Payment order (ΟΡΙΣΤΙΚΟΠΟΙΗΣΗ ΠΛΗΡΩΜΗΣ)
- Δ.1 = Contract award (ΑΝΑΘΕΣΗ ΕΡΓΩΝ / ΠΡΟΜΗΘΕΙΩΝ)
- Δ.2.1 = Tender notice (ΠΡΟΚΗΡΥΞΗ)
- 2.4.7.1 = Regulatory act (ΚΑΝΟΝΙΣΤΙΚΗ ΠΡΑΞΗ)`,
    {},
    async () => {
      try {
        const types = await client.decisionTypes();

        function flatten(items: typeof types, depth = 0): Array<{ uid: string; label: string; depth: number }> {
          const result: Array<{ uid: string; label: string; depth: number }> = [];
          for (const t of items) {
            result.push({ uid: t.uid, label: t.label, depth });
            if (t.children?.length) {
              result.push(...flatten(t.children, depth + 1));
            }
          }
          return result;
        }

        const flat = flatten(types);
        return {
          content: [{ type: 'text', text: JSON.stringify(flat, null, 2) }],
        };
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // --- Tool 6: get_document_url ---
  server.tool(
    'get_document_url',
    `Get the PDF document URL and web page URL for a decision.
Use this when the user wants to read or download the actual decision document.`,
    {
      ada: z.string().describe('The ADA of the decision. Example: "9Β3ΘΩΗΔ-ΚΝΑ"'),
    },
    async ({ ada }) => {
      try {
        const decision = await client.decision(ada);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              ada: decision.ada,
              subject: decision.subject,
              documentUrl: decision.documentUrl,
              webPageUrl: `https://diavgeia.gov.gr/decision/view/${decision.ada}`,
            }, null, 2),
          }],
        };
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );

  return server;
}

function daysBetween(from: string, to: string): number {
  const start = new Date(from + 'T00:00:00Z');
  const end = new Date(to + 'T00:00:00Z');
  return Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}
