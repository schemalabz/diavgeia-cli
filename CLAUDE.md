# CLAUDE.md

## Project

`diavgeia-cli` — TypeScript client library and CLI for the Diavgeia (Greek Government Transparency) API. Dual-purpose: import as a library (`import { Diavgeia } from 'diavgeia-cli'`) or use as a CLI (`diavgeia search --org 6104`).

## Quick reference

```bash
nix develop           # enter dev shell (node, npm)
npm install           # install dependencies
npm run typecheck     # tsc --noEmit
npm test              # vitest (unit tests)
npm run test:smoke    # integration tests against live API
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

## Testing philosophy

- **Smoke tests are the source of truth.** If a smoke test against the live API fails, the code is wrong — fix the code, not the test. Unit tests verify internal logic; smoke tests verify the system actually works.
- **Smoke tests should exercise real code paths.** Use the same functions the CLI uses (e.g., `buildAdvancedQuery`) rather than hand-crafting equivalent queries. This way bugs in shared code are caught.
- **Fix bugs before release, not around them.** When smoke tests reveal a bug (wrong field name, bad query syntax), fix the root cause in the production code. Never paper over it with test workarounds.

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

**Integration smoke tests (`npm run test:smoke`) — run after significant changes:**

| Area | What's covered | Test file |
|------|---------------|-----------|
| Search API | Basic search, JSON round-trip, subject-words, content, amount filters | `cli/smoke.integration.test.ts` |
| Decision API | Fetch detail with all fields, download PDF, skip-existing logic | `cli/smoke.integration.test.ts` |
| Advanced search | Raw Lucene queries against live API | `cli/smoke.integration.test.ts` |
| Pagination | `searchAll()` async iterator across real pages | `cli/smoke.integration.test.ts` |

These tests hit the live Diavgeia API (no mocks) and are skipped by default. Run with `SMOKE=1 npm test` or `npm run test:smoke`.

**Manual verification only (not automatable):**
- TTY progress output (stderr writes gated by `process.stderr.isTTY`)
- Terminal rendering (Greek chars, column alignment, line wrapping)

## API reference

See `docs/api-guide.md` for the full Diavgeia API documentation.
