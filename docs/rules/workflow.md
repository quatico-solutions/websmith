<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# Workflow Rules

Commands, CI, code style, license headers and commit conventions for the websmith monorepo.

## CRITICAL: CI Must Pass Before a Task Is Done

**The Rule:** Run the same steps as CI before pushing. A task is not complete until all of them pass.

**Why?** `.github/workflows/pull-request.yml` runs these on every PR (Node 20, pnpm 9). A green local build with
a skipped step is still a red PR.

### Wrong

```bash
# ❌ Only the package you touched, only unit tests
cd packages/core && pnpm test
```

### Correct

```bash
# ✅ Mirror CI
pnpm install --frozen-lockfile
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

## Monorepo Standards

- **Package manager:** pnpm. `preinstall` runs `npx only-allow pnpm`; npm and yarn are rejected.
- **Build tool:** nx. Root scripts are `nx run-many --target=<target>` over all packages.
- **Node:** 20 (`.nvmrc`).
- **TypeScript:** strict mode.
- **Testing:** Jest (see `testing.md`).
- **Linting:** ESLint (flat config, `eslint.config.js`) with the TypeScript plugin, Prettier.
- **License:** MIT, headers injected automatically.

### Wrong

```bash
# ❌ Breaks the workspace protocol and the lockfile
npm install some-lib
```

### Correct

```bash
# ✅ Add to a specific package
pnpm --filter @quatico/websmith-core add some-lib
```

## Command Reference

```bash
pnpm build                  # build all packages
pnpm typecheck              # type-check all packages
pnpm lint / pnpm lint:fix   # lint / auto-fix
pnpm test                   # unit + integration tests
pnpm test:e2e               # compiler-test + webpack-test
pnpm test:update-snapshots  # update Jest snapshots
pnpm watch / watch:test     # watch builds / tests (parallel)
pnpm dist                   # dist targets + e2e
pnpm clean                  # remove build output, coverage, test-output
pnpm license:check          # verify license headers
pnpm license:add            # add missing license headers
```

The husky `pre-commit` hook runs `npm run lint`. Do not bypass it with `--no-verify`.

## CRITICAL: License Header on Every Source File

**The Rule:** Every `.ts`, `.tsx`, `.js`, `.jsx`, `.scss`, `.md` and `.mdx` file (except the ignores in
`license-config.json`) starts with the MIT header from `license-header.txt`.

**Why?** The repository is published under MIT. `pnpm license:check` is not part of CI and currently reports a few
pre-existing files; do not add to that list.

### Wrong

```typescript
// ❌ New file without header
import { type AddonContext } from "@quatico/websmith-api";
```

### Correct

✅ The header comes first, before any import:

```typescript
/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type AddonContext } from "@quatico/websmith-api";
```

Markdown files get the same text inside `<!-- -->`. Run `pnpm license:add` instead of typing it.

## Code Style

Enforced by `eslint.config.js`, `.prettierrc` and `.editorconfig`:

| Rule | Setting | Why |
|------|---------|-----|
| `no-console` | error (off in tests) | diagnostics go through the `Reporter` |
| `@typescript-eslint/consistent-type-imports` | error, inline | type-only imports are erased cleanly |
| `@typescript-eslint/no-unused-vars` | error, `_` prefix ignored | mark intentionally unused names with `_` |
| `curly` | error | no brace-less `if` bodies |
| `arrow-parens` | as-needed | matches Prettier `arrowParens: avoid` |
| `unicorn/prefer-node-protocol` | error | `node:` imports for built-ins |
| `unicorn/import-style` | error | consistent module import style |
| `max-len` | warn 150 (off in tests) | matches Prettier `printWidth: 150` |
| Indentation | 4 spaces, LF, UTF-8 | `.editorconfig` |
| Trailing commas | `es5` | Prettier |

### Wrong

```typescript
// ❌ Mixed value/type import, bare built-in, brace-less if, console
import { AddonContext } from "@quatico/websmith-api";
import path from "path";
if (!file) return;
console.warn("missing file");
```

### Correct

```typescript
// ✅
import { type AddonContext, WarnMessage } from "@quatico/websmith-api";
import path from "node:path";
if (!file) {
    ctx.getReporter().reportDiagnostic(new WarnMessage("missing file"));
    return;
}
```

## Commits

Commit messages follow Arlo's commit notation (Quatico variant, see the `commit-notation` skill), as used
throughout `git log`: an intent letter whose case signals risk, then a short imperative summary.

| Letter | Intent |
|--------|--------|
| `F` | feature |
| `B` | bug fix |
| `R` | refactoring |
| `D` | documentation |
| `E` | environment / build / release (e.g. `E Updates Release version to 0.9.0`) |
| `t` | test-only change |
| `a` | automated change (formatting, generated code) |

Risk: lowercase = provably safe (e.g. `r` for an automated refactoring), uppercase = tested, `!` suffix =
risky / untested (e.g. `R!`).

### Wrong

```text
❌ fixed stuff
```

### Correct

```text
✅ f: add addonEmitOnly transformer detection for Case 4 (language service path)
```


## Pull Requests

- Work on feature branches and merge through pull requests (`protect-stable.yml` also runs CI on pushes to
  `develop` and `main`).
- CI (`pull-request.yml`) must be green; `claude-code-review.yml` adds an automated review.
- Add user-visible changes under `## [Unreleased]` in `Release-Notes.md` (keep-a-changelog format).

## Documentation

- User-facing docs: `README.md` (root) and `packages/*/README.md`. Update them when CLI flags, config keys or the
  addon API change.
- Terminology: `docs/language-glossar.md`. Use its terms (Compilation Profile, Addon Activator, ...) in code and
  docs.
- Demos of features: `docs/demos/`.

**Related:** `testing.md` (test rules), `architecture.md` (package boundaries).
