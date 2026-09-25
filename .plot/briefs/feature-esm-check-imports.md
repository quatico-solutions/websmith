<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — esm-output-check (wave 3: imports)

- **Plan (canonical):** `docs/plans/2026-09-24-esm-output-check.md` on `develop`
- **Approved:** 2026-09-25, Jan Wloka, plan-PR #112 merged (slice re-cut 2026-09-25, in-session)
- **Branch:** `feature/esm-check-imports` (base: `develop`) — **prepared ahead, not yet claimed.** Wave 3 becomes
  eligible when wave 2 (`feature/esm-check-core`) merges; claim it then with `/plot-implement esm-output-check`.
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh`; do not merge
- **Review of the code:** per repo convention; CI green

Parallel to `esm-check-coverage`, `esm-check-cjs-names` and `esm-check-package-type`. This slice adds rules to
`checkEsm` (wave 2) and changes no call site.

### What to build

Rules on **relative** specifiers and JSON imports in emitted JavaScript, keyed on wave 2's module classification:

| Code | Rule | `node` | `bundler` esm | `bundler` auto |
|------|------|--------|---------------|----------------|
| 91010 | relative import without an explicit extension (`./b`) | error | error (`fullySpecified`) | allowed |
| 91011 | relative import of a directory (`./utils` for `utils/index.js`) | error (`ERR_UNSUPPORTED_DIR_IMPORT`) | error | allowed |
| 91012 | relative import that resolves to no written or existing file | error | CLI only | CLI only |
| 91013 | JSON import without `with { type: "json" }` | error (`ERR_IMPORT_ATTRIBUTE_MISSING`) | allowed | allowed |

Specifiers come from static `import … from`, re-exports `export … from`, and dynamic `import()` with a string
literal. Fix hints: 91010 "add the extension: `./b.js`", 91011 "import the file: `./utils/index.js`",
91013 "add `with { type: "json" }`".

### Settled decisions — do not re-derive them

- **Relative specifiers only.** Bare specifiers (`"pkg"`, `"pkg/sub"`) need package resolution, which
  `esm-check-cjs-names` owns in this wave; the default-import rule moved there for that reason. Bare subpaths
  against `exports` maps and tsconfig `paths` aliases are **not in v1** (story `node24-esm-support`).
- **91010 vs 91011 are separate codes.** A directory import is not fixed by appending `.js`; the message must
  name `index.js`.
- **Resolution (91012) is CLI only**, against wave 1's written set plus files on disk. The loader is synchronous
  and webpack resolves every import itself (`loader.ts:21-35`); wave 4 does not run this rule. Under
  `addonEmitOnly`, a sibling that was not written but exists on disk from an earlier build resolves — that is what
  Node would load, so it is not an error.
- **Non-literal `import()` is skipped**, not reported: it cannot be resolved statically.
- **The emitted specifier is what counts.** TypeScript may rewrite `.ts` to `.js`
  (`rewriteRelativeImportExtensions`) or leave it; the rule sees only the output.
- **Classification comes from wave 2**; never re-derive ESM/CommonJS from `tsConfig.module` here.

### Done when

Assertions that exist because a naive implementation would pass without them:

- `import "./b"` where `b/` is a directory with `index.js` → **91011**, not 91010 (catches a single
  "no extension" check).
- `export { x } from "./b"` → 91010 (catches checking only `import` declarations).
- `await import("./b")` → 91010; `await import(name)` → nothing (catches both "ignore dynamic import" and
  "flag any dynamic import").
- `import "./b.js"` under `addonEmitOnly` where `b.js` was not written this run but exists on disk → no 91012
  (catches resolving against the written set only).
- `import "./gone.js"` with no such file → 91012 on the CLI.
- `import data from "./d.json"` → 91013 under `node`, nothing under `bundler`; `import data from "./d.json" with
  { type: "json" }` → nothing (catches ignoring import attributes).
- `bundler` auto: `import "./b"` → nothing (catches a flat strict bundler column).
- `import x from "pkg"` → no rule from this slice fires (catches scope creep into bare specifiers).
- The README code table lists 91010–91013 with their hints; `Release-Notes.md` `[Unreleased]` / Added.
- Repo gates: `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm test:e2e`; tests per `docs/rules/testing.md`.

### Bookkeeping

- Push the first real commit as soon as it exists.
- Open the PR with `plot-open-pr.sh`, then give it a descriptive title (the heading alone reads "Wave 3").
- Append `→ #<number>` to this branch's line in the plan's `## Slices`.

### Scope guard

This branch owns: new rule files under `packages/core/src/compiler/esm/` for 91010–91013, their registration in
`checkEsm`, their tests, the README code table rows and the release note.

Not this branch: bare-specifier resolution and `cjs-module-lexer` (`esm-check-cjs-names`), `package.json` `"type"`
rules (`esm-check-package-type`), call sites and attribution (`esm-check-coverage`), `packages/webpack` (wave 4).
If two wave 3 slices add rows to the same README table, the second to merge resolves the table conflict.

If you find something the plan did not anticipate, report it rather than improvising outside scope.
