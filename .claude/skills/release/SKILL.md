---
name: release
description: Bump version, build, publish to npm, tag, and create a GitHub release with notes.
argument-hint: "[dry-run] [patch|minor|major] | <ref>..<ref>"
---

# Release

Bump the package version, publish to npm, tag the release, and create a GitHub release. Single-branch workflow — tags go directly on main.

## Arguments

- `$ARGUMENTS` — optional, space-separated tokens:
  - `dry-run` — generate release notes and show what would happen, without publishing
  - `patch` / `minor` / `major` — semver bump type (default: `patch`)
  - `<ref>..<ref>` — generate content for an arbitrary git range. Implies dry-run. Examples:
    - `v0.1.0..v0.2.0` — between two tags
    - `v0.2.0..HEAD` — from a tag to current HEAD
  - *(empty)* — full release: bump patch, build, publish, tag, GitHub release

Tokens can appear in any order.

## Argument Parsing

1. If `$ARGUMENTS` contains `..`, treat it as an **explicit range**. Validate both refs exist. Set `DRY_RUN=true`.

2. If `$ARGUMENTS` contains `dry-run`, set `DRY_RUN=true`.

3. Extract bump type: `patch`, `minor`, or `major`. Default to `patch` if not specified.

4. If `$ARGUMENTS` is empty, set `DRY_RUN=false`, bump type `patch`.

For non-explicit ranges, `RANGE` is determined after finding the last tag in Step 2.

## Step 1: Pre-flight Checks

Skip if an explicit range was given.

Determine the upstream remote:

```bash
git remote | grep -q upstream && REMOTE=upstream || REMOTE=origin
```

Verify clean state and sync:

```bash
git status --porcelain
git fetch $REMOTE

# Must be on main, in sync with remote
git rev-parse --abbrev-ref HEAD  # should be main
git log --oneline $REMOTE/main..HEAD  # should be empty (nothing unpushed)
git log --oneline HEAD..$REMOTE/main  # should be empty (nothing unpulled)
```

If there are unpushed or unpulled commits, stop and tell the user.

Run the full quality gate:

```bash
nix develop --command bash -c 'npm run typecheck && npm test'
```

If typecheck or tests fail, stop — do not release broken code.

## Step 2: Gather Context

Find the last release tag and set the range:

```bash
LAST_TAG=$(git tag --list 'v*' --sort=-version:refname | head -1)
echo "Last release: ${LAST_TAG:-none}"
```

If no explicit range was given, set `RANGE="${LAST_TAG}..HEAD"`. If there is no previous tag, use `$(git rev-list --max-parents=0 HEAD)..HEAD`.

Check there are changes to release:

```bash
git log --oneline $RANGE
```

If there are no commits in the range, stop — nothing to release.

Collect the raw material:

```bash
git log --format="%H %s" $RANGE
git diff --stat $RANGE
git diff --name-only $RANGE
git diff $RANGE
```

**Important**: Commit messages are a signal, not the source of truth. Always cross-reference messages against the actual diff to understand what really changed.

## Step 3: Determine Version

Read the current version from `package.json`, then apply the bump:

```bash
CURRENT=$(node -e "console.log(require('./package.json').version)")
```

Apply semver bump:
- `patch`: 0.1.0 → 0.1.1
- `minor`: 0.1.0 → 0.2.0
- `major`: 0.1.0 → 1.0.0

Set `NEXT_VERSION` to the bumped version and `TAG="v${NEXT_VERSION}"`.

Present: "Releasing v{CURRENT} → v{NEXT_VERSION}" and confirm with the user.

## Step 4: Analyze and Generate

Analyze the changes — group by impact, not by commit type. Write for someone deciding whether to update.

Generate GitHub Release notes following the template — read [templates/github-release.md](templates/github-release.md) before generating.

Present the output to the user for review before proceeding.

## Step 5: Publish

**Skip this step if `DRY_RUN=true`.**

After the user approves:

1. **Bump version** in package.json:
   ```bash
   nix develop --command npm version $NEXT_VERSION --no-git-tag-version
   ```

2. **Build** the package:
   ```bash
   nix develop --command npm run build
   ```

3. **Commit the version bump**:
   ```bash
   git add package.json package-lock.json
   git commit -m "chore: release v$NEXT_VERSION"
   ```

4. **Tag the release**:
   ```bash
   git tag -a "v$NEXT_VERSION" -m "Release v$NEXT_VERSION"
   ```

5. **Push commit and tag**:
   ```bash
   git push $REMOTE main
   git push $REMOTE "v$NEXT_VERSION"
   ```

6. **Publish to npm**:
   ```bash
   nix develop --command npm publish --access public
   ```

7. **Create the GitHub release**:
   ```bash
   gh release create "v$NEXT_VERSION" --target main --title "v$NEXT_VERSION" --notes-file <release-notes-file>
   ```

**Always confirm with the user before pushing, publishing to npm, and creating the GitHub release.** These are public-facing, non-reversible actions.

## Post-publish verification

After publishing, verify the package is available:

```bash
npm view @schemalabs/diavgeia-cli version
```

Remind the user to verify MCP installation works:
```bash
npx -y -p @schemalabs/diavgeia-cli diavgeia-mcp
```

## Notes

- If the commit history is messy, focus on the diff rather than the messages.
- **Omit empty sections** in all outputs.
- Group related commits into single bullets — don't list every commit.
- The `nix develop` prefix is required for all npm/node commands — this machine doesn't have Node globally installed.
- The flake.nix `npmDepsHash` will need updating after the package-lock.json changes. If the nix build is part of CI, note this for the user.
