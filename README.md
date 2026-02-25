# diavgeia-cli

TypeScript client and CLI for the [Diavgeia](https://diavgeia.gov.gr) (Greek Government Transparency) API. Access 71+ million government decisions from every Greek institution since 2010.

- **Library**: Zero-dependency TypeScript client with full type coverage
- **CLI**: Search, browse organizations, look up decisions — from your terminal
- **Pagination**: Async generators for streaming through large result sets
- **Dual format**: Ships ESM + CJS with TypeScript declarations

## Install

```bash
npm install diavgeia-cli
```

Or use directly with npx:

```bash
npx diavgeia-cli search query --org 6104 --from 2024-12-01 --to 2024-12-31
```

## Library usage

```typescript
import { Diavgeia, msToISODate } from 'diavgeia-cli';

const client = new Diavgeia();

// List all municipalities
const orgs = await client.organizations({ category: 'MUNICIPALITY' });

// Search decisions
const results = await client.search({
  org: '6104',
  unit: '81689',
  from_issue_date: '2024-12-01',
  to_issue_date: '2024-12-31',
  status: 'PUBLISHED',
});

for (const d of results.decisions) {
  console.log(`${d.ada} ${msToISODate(d.issueDate)} ${d.subject}`);
}

// Stream all results with async iteration
for await (const decision of client.searchAll({ org: '6104', status: 'PUBLISHED' })) {
  console.log(decision.ada);
}

// Look up a single decision by ADA
const decision = await client.decision('ΨΘ82ΩΡΦ-7ΑΙ');

// Get organization details with units, signers, positions
const details = await client.organizationDetails('6104');
```

### Constructor options

```typescript
const client = new Diavgeia({
  baseUrl: 'https://test3.diavgeia.gov.gr',  // default: production
  timeout: 60000,                              // default: 30000ms
  fetch: customFetch,                          // default: globalThis.fetch
});
```

### Error handling

```typescript
import { Diavgeia, DiavgeiaError, DiavgeiaTimeoutError } from 'diavgeia-cli';

try {
  await client.decision('INVALID');
} catch (err) {
  if (err instanceof DiavgeiaError) {
    console.error(`API error ${err.status}: ${err.message}`);
  } else if (err instanceof DiavgeiaTimeoutError) {
    console.error('Request timed out');
  }
}
```

## CLI usage

```bash
diavgeia <command> [options]
```

**Global options**: `--json` (force JSON output), `--base-url <url>`, `--timeout <ms>`, `--version`, `--help`

Output is JSON when piped or `--json` is passed. Human-readable tables on TTY.

### Organizations

```bash
# List all municipalities
diavgeia orgs list --category MUNICIPALITY

# Get a specific organization
diavgeia orgs get 6104

# List units (departments) for an organization
diavgeia orgs units 6104

# List all signers for an organization
diavgeia orgs signers 6104
```

### Decisions

```bash
# Look up a decision by ADA
diavgeia decisions get ΨΘ82ΩΡΦ-7ΑΙ

# Get a specific version
diavgeia decisions version <version-uuid>

# View version/correction history
diavgeia decisions history ΨΘ82ΩΡΦ-7ΑΙ
```

### Search

```bash
# Search by organization, unit, and date range
diavgeia search query --org 6104 --unit 81689 --from 2024-12-01 --to 2024-12-31

# Free-text search
diavgeia search query --query "προϋπολογισμού" --org 6104

# Fetch ALL results (paginates automatically)
diavgeia search query --org 6104 --from 2024-01-01 --to 2024-12-31 --all

# Advanced search with Lucene syntax
diavgeia search advanced 'organizationUid:"6104" AND issueDate:[DT(2024-01-01T00:00:00) TO DT(2024-12-31T23:59:59)]'

# List searchable fields
diavgeia search terms
diavgeia search terms --common
```

### Reference data

```bash
# Decision type taxonomy
diavgeia types

# Details for a specific type (including extra field schema)
diavgeia types get Β.1.1

# List all dictionaries
diavgeia dictionaries

# Get items in a dictionary
diavgeia dictionaries get ORG_CATEGORY

# All position types
diavgeia positions

# Direct lookups
diavgeia units get 81689
diavgeia signers get 100009559
```

## API methods

| Method | Description |
|--------|-------------|
| `organizations(params?)` | List/filter organizations |
| `organization(orgId)` | Get single organization |
| `organizationDetails(orgId)` | Organization with units, signers, positions |
| `units(orgId, params?)` | List units for organization |
| `signers(orgId)` | List signers for organization |
| `orgPositions(orgId)` | List positions for organization |
| `unit(unitId)` | Get unit by ID |
| `signer(signerId)` | Get signer by ID |
| `decision(ada)` | Get decision by ADA |
| `decisionVersion(versionId)` | Get specific version |
| `versionLog(ada)` | Decision version history |
| `search(params)` | Search with named parameters |
| `searchAdvanced(params)` | Search with Lucene syntax |
| `searchAll(params)` | Async iterable over all pages |
| `searchTerms()` | List all searchable fields |
| `searchTermsCommon()` | List common searchable fields |
| `decisionTypes()` | Decision type taxonomy |
| `decisionTypeDetails(typeId)` | Type with extra field schema |
| `dictionaries()` | List all dictionaries |
| `dictionary(name)` | Get dictionary items |
| `positions()` | All position types |

## Key concepts

- **ADA** — Unique decision identifier (Greek letters + numbers, e.g., `ΨΘ82ΩΡΦ-7ΑΙ`)
- **Organization** — Government body (e.g., municipality). Identified by numeric UID.
- **Unit** — Department within an organization (e.g., Municipal Council)
- **Timestamps** — The API returns milliseconds since epoch. Use `msToISODate()` to convert.
- **Dual base paths** — The API uses `/luminapi/opendata` for structural data and `/opendata` for search. The client handles this transparently.

## Documentation

- [API Guide](docs/api-guide.md) — Complete Diavgeia API reference
- [Examples](docs/examples.md) — Practical recipes and patterns

## License

MIT
