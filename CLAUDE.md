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

## API reference

See `docs/api-guide.md` for the full Diavgeia API documentation.
