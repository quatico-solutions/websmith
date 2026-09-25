<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — esm-output-check (wave 3: CommonJS names)

- **Plan (canonical):** `docs/plans/2026-09-24-esm-output-check.md` on `develop`
- **Approved:** 2026-09-25, Jan Wloka, plan-PR #112 merged (slice scope amended 2026-09-25, in-session)
- **Branch:** `feature/esm-check-cjs-names` (base: `develop`) — **prepared ahead, not yet claimed.** Wave 3 becomes
  eligible when wave 2 (`feature/esm-check-core`) merges; claim it then with `/plot-implement esm-output-check`.
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh`; do not merge
- **Review of the code:** per repo convention; CI green

Parallel to `esm-check-coverage`, `esm-check-imports` and `esm-check-package-type`. This slice adds rules and a
resolver to `packages/core/src/compiler/esm/`; it changes no call site. Wave 4 (`esm-check-webpack`) registers every
`package.json` and entry file this resolver reads with `this.addDependency` / `this.addMissingDependency`; they
reach it through `EsmCheckContext.onDependency` (see below).

### What to build

Two rules on **bare** specifiers (`"pkg"`, `"pkg/sub"`) in ESM output, when the specifier resolves to a
**CommonJS** entry:

| Code | Rule | `node` | `bundler` esm | `bundler` auto |
|------|------|--------|---------------|----------------|
| 91020 | named import the CommonJS module does not export (`import { a } from "pkg"`) | error | allowed | allowed |
| 91021 | default import from a CommonJS module that sets `__esModule` | error | error | allowed |

Measured by the panel (Node 24.21, webpack 5.97.1, `esm-semantics.md`):
- `import { named } from "tscjs"` works for TypeScript-emitted `exports.named = …`, but
  `module.exports = Object.assign({}, { a: 1 })` fails with *Named export 'a' not found*.
- `import def from "tscjs"` (a TypeScript-compiled package with `__esModule` and `exports.default`) yields
  `typeof def === "object"` under Node and strict webpack and `"function"` under webpack auto — a silent break.

Pieces:

1. **Resolver** — from the importing file: walk up `node_modules/<name>` directories; read its `package.json`;
   resolve the subpath through `"exports"` with conditions `["node", "import", "default"]` using `resolve.exports`;
   without `"exports"`, `main`, then `index.js`. Classify the resolved file with wave 2's classification; an ESM
   entry is not checked.
2. **Export detection** — run `cjs-module-lexer` (`init()` then `parse(source)`) on the CommonJS entry. Follow
   `reexports` recursively the way Node does (resolve each re-exported specifier from that file), with a depth
   limit and cycle guard. Result: a set of export names, whether `__esModule` is among them, and whether the
   result is complete.
3. **Rules** — for each `import { a, b as c } from "pkg"` / `export { a } from "pkg"`: names not in the set →
   91020 (`default` is always available). For `import def from "pkg"` / `import def, { … } from "pkg"`: the set
   contains `__esModule` → 91021, hint "use `import pkg from "pkg"; pkg.default` or a named import".
4. **Dependencies:** add `cjs-module-lexer` ^2 and `resolve.exports` ^2 to `packages/core/package.json`
   `dependencies`; lockfile updated with pnpm (if `pnpm install` fails with E401 from a stale user token, use an
   empty `npm_config_userconfig`; never edit `~/.npmrc`).

### Settled decisions — do not re-derive them

- **Lexer, not `"type"` or `"exports"` heuristics.** Judging CommonJS-ness by `package.json` alone would flag
  nearly every TypeScript-compiled dependency, which Node imports by name without trouble. Only the lexer sees
  what Node sees.
- **Lexer major 2** matches what Node 22 (the `engines` floor) bundles: 2.1.0. Node 24 does not report its lexer
  version; parity there is unverified — do not claim it.
- **ESM resolution, not `require.resolve`.** A dual package's `"import"` condition often points at an ESM entry;
  `require.resolve` would pick the CommonJS one and check the wrong file.
- **Unknown is silent.** An unresolvable specifier, a missing entry, a re-export the resolver cannot follow, or a
  lexer that reports an incomplete result produces **no** diagnostic; list it in `--debug`.
- **Relative specifiers are not this slice's** (`esm-check-imports`); subpaths blocked by an `"exports"` map and
  tsconfig `paths` aliases are not in v1.
- **Cache per build** by resolved entry path: many files import the same package.

### Carried over from the wave 2 review and the wave 3/4 briefs (amended 2026-09-25)

- **The loader runs these rules** (settled for wave 4), with a per-compilation memo and every file read registered
  with webpack. So the resolver must:
  - read only through `context.system` (never `fs` or `require.resolve`);
  - report every file it reads, found or not, through wave 2's `EsmCheckContext.onDependency(fileName, exists)`:
    each `node_modules/<name>/package.json` probed, the resolved entry, and each re-export target;
  - on a **cache hit, replay** the dependencies recorded for that entry. Otherwise the second importer in a build
    never registers them, and editing the package does not re-check it in watch mode.
- **Cache per build, injectable.** Key the resolution memo by (importer directory, specifier) and the lexer cache by
  resolved entry path. Hold both in an object the caller can pass in and drop, so wave 4 can reset them per
  compilation. The CLI creates one per `compile()`.
- **Node's conditions, not webpack's.** The resolver keeps `["node", "import", "default"]` in the loader too. Wave 4
  documents the possible mismatch; do not add webpack conditions here.
- **Three module kinds under `bundler`.** Wave 2 now classifies `.cjs` files, and `.js` files under
  `"type": "commonjs"`, as kind `dynamic` (webpack's `javascript/dynamic`). Only ESM-classified importing files are checked. When classifying the
  resolved entry, use the node-runtime classification (it is loaded by Node's rules) or the bundler one, matching
  the profile's runtime.
- **Wave 2's non-ESM guard** skips profiles whose effective `module` is not ESM before any rule runs; add no second
  guard. `esm.ignore` and `check: "warn"`/`"off"` are applied by `checkEsm`, so do not reimplement them in the rule.

### Done when

Assertions that exist because a naive implementation would pass without them:

- A TypeScript-compiled CommonJS package with `exports.named = …`: `import { named }` → **no** 91020 (catches
  "CommonJS package → error").
- `module.exports = Object.assign({}, { a: 1 })`: `import { a }` → 91020 (catches trusting the package type).
- A package whose entry re-exports another via `__exportStar(require("./inner"))`: `import { fromInner }` → no
  91020 (catches not following re-exports).
- A dual package whose `"exports"` `"import"` condition points at an `.mjs` entry and `"require"` at a CommonJS
  one: `import { onlyInEsm }` → nothing (catches `require.resolve`-style resolution).
- `import def from "tscjs"` (`__esModule` + `exports.default`): 91021 under `node` and `bundler` esm, nothing under
  `bundler` auto (catches a single bundler column).
- `import def from "plaincjs"` (no `__esModule`): no 91021.
- An unresolvable `import { x } from "not-installed"` → no diagnostic, listed in `--debug`.
- Fixtures are real directories on disk (a `node_modules` tree under a temp project), not mocks of the lexer.
- README code table rows for 91020/91021; `Release-Notes.md` `[Unreleased]` / Added.
- Repo gates: `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm test:e2e`; tests per `docs/rules/testing.md`.

### Bookkeeping

- Push the first real commit as soon as it exists.
- Open the PR with `plot-open-pr.sh`, then give it a descriptive title (the heading alone reads "Wave 3").
- Append `→ #<number>` to this branch's line in the plan's `## Slices`.

### Scope guard

This branch owns: the resolver and lexer-based detection under `packages/core/src/compiler/esm/`, rules
91020/91021 and their registration in `checkEsm`, `packages/core/package.json` dependencies, `pnpm-lock.yaml`,
tests and fixtures, README rows, release note.

Not this branch: relative specifiers (`esm-check-imports`), `package.json` `"type"` rules for the *emitted* files
(`esm-check-package-type`), call sites and attribution (`esm-check-coverage`), `packages/webpack` (wave 4). If two
wave 3 slices add rows to the README code table, the second to merge resolves the conflict.

If you find something the plan did not anticipate, report it rather than improvising outside scope.
