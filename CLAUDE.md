# CLAUDE.md

## Project

`diavgeia-cli` — TypeScript client library and CLI for the Diavgeia (Greek Government Transparency) API. Dual-purpose: import as a library (`import { Diavgeia } from 'diavgeia-cli'`) or use as a CLI (`diavgeia search --org 6104`).

## Quick reference

```bash
nix develop           # enter dev shell (node, npm)
npm install           # install dependencies
npm run typecheck     # tsc --noEmit
npm test              # vitest (unit tests)
npm run build         # tsup → dist/ (ESM, CJS, types, CLI)
```

**Before committing:** `npm run typecheck && npm test`

## Code conventions

- TypeScript strict mode, ESM (`"type": "module"`)
- **Always use `.js` extensions in imports** (ESM requirement)
- Colocated tests: `foo.ts` → `foo.test.ts`
- Conventional commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`
- **Do NOT add `Co-Authored-By` lines to commits**
- Zero runtime deps for library core (only `commander` for CLI)
- Unit tests stub `fetch` — no live API calls in tests

## Architecture

```
src/
├── index.ts         # Library entry — re-exports client, types, utils
├── client.ts        # Diavgeia class (all API endpoints)
├── types.ts         # All API model interfaces (raw API shapes)
├── paginate.ts      # Async generator for paginated endpoints
├── utils.ts         # msToDate, normalizeGreek, URL builders
├── errors.ts        # DiavgeiaError, DiavgeiaTimeoutError
└── cli/
    ├── index.ts     # CLI entry point (commander)
    └── commands/    # orgs, decisions, search, types, output formatting
```

## Key design decisions

1. **Raw API shapes** — Types match what the API returns exactly (timestamps in ms, not ISO). Utils are opt-in.
2. **Dual base paths** — The API uses `/luminapi/opendata` for structural endpoints and `/opendata` for search. The client routes transparently.
3. **Injectable fetch** — `new Diavgeia({ fetch })` for testing.
4. **AsyncIterable pagination** — `searchAll()` yields decisions via async generator.

## Diavgeia API quirks

- **6-month date range cap** — The search API silently caps results for date ranges longer than ~6 months. The CLI auto-windows into 180-day chunks (disable with `--no-window`).
- **Subject search is exact phrase** — `--subject` does exact phrase matching. Use `--subject-words` for tokenized AND-matching across word variations.
- **Dual base paths** — `/luminapi/opendata` for structural endpoints (orgs, decisions, types) vs `/opendata` for search. The client routes transparently.

## CLI commands reference

### decisions

- `decisions get <ada>` — Fetch a single decision
- `decisions version <versionId>` — Fetch a specific version
- `decisions history <ada>` — Version history
- `decisions download <ada...>` — Download decision PDFs
  - `-o, --output <dir>` — Output directory (default: `.`)
  - `--skip-existing` — Skip if file already exists

### search

- `search query` (default) — Search with named parameters
  - `--subject-words <text>` — Tokenized AND-joined subject search (uses advanced endpoint)
  - `--content <text>` — Search within PDF content
  - `--amount-min <n>` / `--amount-max <n>` — Financial amount range filter
  - `--no-window` — Disable auto-windowing for wide date ranges
  - `--all` — Fetch all pages
- `search advanced <query>` — Raw Lucene query
- `search terms` — List searchable fields

## Testing patterns

- Mock fetch with `vi.fn()`, use `ok(data)` / `notOk(status, text)` response factories
- `makeDecision(overrides)` creates a complete Decision fixture
- `calledUrl()` extracts the URL from the first fetch call for assertions
- Pure functions (`computeWindows`, `buildSubjectWordsQuery`, `buildAdvancedQuery`) are tested directly
- CLI command tests: mock `node:fs`, instantiate commander + client, call `program.parseAsync()`

## What's tested vs what needs manual verification

**Automated (`npm test`) — must pass before every commit:**

| Area | What's covered | Test file |
|------|---------------|-----------|
| Client methods | All API endpoints, `downloadDocument()` happy path + error | `client.test.ts` |
| Pure search functions | `computeWindows`, `buildSubjectWordsQuery`, `buildAdvancedQuery` — all edge cases | `cli/commands/search.test.ts` |
| Output formatters | `formatDecision` extra fields (FEK, amounts, filtering), `formatSearchResults` type column | `cli/commands/output.test.ts` |
| Download CLI | `--output` dir, `--skip-existing`, dir creation (mocked fs) | `cli/commands/decisions.test.ts` |
| Pagination | Async generator across pages | `paginate.test.ts` |
| Utils | Date conversion, Greek normalization, URL building | `utils.test.ts` |

**Manual smoke tests — run after significant changes:**

```bash
# Build first
nix develop --command bash -c 'npm run build'

# 1. Download command — real filesystem + API
node dist/cli/index.js decisions download <known-ada> -o /tmp/test-dl
ls -la /tmp/test-dl/  # verify PDF exists and is non-empty
node dist/cli/index.js decisions download <known-ada> -o /tmp/test-dl --skip-existing  # should skip

# 2. Search with windowing — real API pagination
node dist/cli/index.js search query --org 6104 --from 2023-01-01 --to 2024-12-31 --size 5
# Should show "Searching X to Y..." progress on TTY, multiple windows

# 3. Subject words — advanced endpoint
node dist/cli/index.js search query --subject-words "ΕΓΚΡΙΣΗ ΔΑΠΑΝΗΣ" --org 6104 --size 5

# 4. Content search — PDF full-text
node dist/cli/index.js search query --content "δικαστική" --org 6104 --size 5

# 5. Amount filter
node dist/cli/index.js search query --org 6104 --amount-min 10000 --size 5

# 6. Decision detail with extra fields
node dist/cli/index.js decisions get <known-ada>  # should show Extra fields section

# 7. JSON output
node dist/cli/index.js --json search query --org 6104 --size 2  # valid JSON with decisionTypeId
```

**Not testable automatically (by design):**
- TTY progress output (stderr writes gated by `process.stderr.isTTY`)
- Real API responses, network errors, timeouts
- Actual filesystem I/O (tests mock `node:fs`)
- Terminal rendering (Greek chars, column alignment, line wrapping)
- Lucene query validation (only the real API can reject bad syntax)

## API reference

See `docs/api-guide.md` for the full Diavgeia API documentation.
