# GitHub Release Notes Template

Write for someone deciding whether to update their dependency or MCP server. Lead with impact, not implementation.

## Structure

```markdown
## Highlights

<!-- 1-3 sentences: what this release brings, in plain language. -->

## Breaking Changes

<!-- Only if there are breaking changes to the library API, CLI interface, or MCP tool schemas. -->
<!-- What broke, what to do about it. -->
<!-- Omit this section if there are none. -->

## What's New

<!-- New capabilities. Each bullet: what users can now do. -->
<!-- For MCP tools: what questions can they now ask that they couldn't before? -->
<!-- Omit if none. -->

## Improvements

<!-- Enhancements to existing behavior: better results, performance, UX. -->
<!-- Omit if none. -->

## Fixes

<!-- What was broken and how it's fixed. -->
<!-- Omit if none. -->

## Internal

<!-- Refactors, CI, dependencies — one line each, keep brief. -->
<!-- Omit if nothing notable. -->
```

## Rules

- **Group related commits into single bullets** — don't list every commit
- **Lead with user impact**: "Search now finds decisions with Greek word variations" not "Add normalizeGreek to subject tokenizer"
- **Reference PRs/issues** where relevant: `(#123)`
- **Skip trivial changes** (typos, formatting) unless they're the only changes
- **Omit empty sections entirely**
- **Mention MCP changes prominently** — that's the primary interface for most users
