<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — tsc-option-parity (slice "Option constants")

- **Plan (canonical):** `docs/plans/2026-10-02-tsc-option-parity.md` on `develop` (panel:
  `.plot/panels/2026-10-02-tsc-option-parity/panel.md`, verdicts `tsc-semantics.md`, `ts7-roadmap.md`)
- **Approved:** 2026-10-02, Jan Wloka, plan-PR #135 merged
- **Branch:** `bug/option-enum-tables` (base: `develop`, at `c59594fc` when this brief was written)
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh` (on `PATH`); never merged by the implementer
- **Review of the code:** independent review plus uncached gates run by the maintainer's session before merge

Second slice of the plan. It waited on `bug/tsc-default-target-interop`, merged as #161 (read
`packages/core/src/compiler/config/effective-options.ts` and `defaults.ts` first: `getEffectiveTarget` exists and is
already used at the `getCheckedEsm` site). Waiting on this slice: #144's `bug/typescript-6-own-compilations`
(`<!-- waits: bug/option-enum-tables -->`). This plan's `bug/profile-lib-names` waits on #134's
`bug/loader-tsconfig-enum-options`, not on this slice, but uses the 6046 constant this slice exports.

### What to build

A pure refactor with one latent bug. Line numbers below are `develop` at `c59594fc`; the plan's are from before #161.

1. **`TARGET_MAP`** (`packages/core/src/compiler/Compiler.ts:59-74`) maps every `ts.ScriptTarget` number to itself
   (0..11, 99, 100; verified identity). Its only use is the branch in `normalizeCompilerOptions` (`:1013-1017`). Remove
   both. After that `normalizeCompilerOptions` only shallow-copies (`{}` for `undefined`); keep the copy semantics at
   its two callers (`:442` and `createProgram`, `:1024`), either by keeping the function with an honest doc comment
   or by inlining `{ ...(x ?? {}) }`. Drop the "numeric enum values" comments that no longer describe anything.
2. **`scriptTargetToString`** (`config/parsed-command-line.ts:157-176`) is a hand-copied table. Replace it by a lookup
   derived from `ts.ScriptTarget` (`ts.ScriptTarget[value]?.toLowerCase()`, falling back to `String(value)` as today)
   with explicit entries that win over the reverse map: `12` → `es2025`, `99` → `esnext`, `100` → `json`. Export it
   (and from `config/index.ts`) so `Compiler.ts` can use it.
3. **The `getCheckedEsm` message** (`Compiler.ts:805`, `targetName = … ts.ScriptTarget[target] …`) names the target
   through `scriptTargetToString` instead. `target` there is already `getEffectiveTarget(...)` (a number), so the
   `typeof target === "number"` guard can go.
4. **6046** is defined twice: `TS_ERROR_CODE_INVALID_CLI_OPTION` (`Compiler.ts:78`, used `:1410`, mentioned in the
   comment at `:1405`) and `TS_ERROR_CODE_INVALID_OPTION_VALUE` (`config/resolve-compiler-config.ts:75`, used `:88`).
   Keep one exported constant directly above `convertEnumOptions` in `resolve-compiler-config.ts` (keep the name
   `TS_ERROR_CODE_INVALID_OPTION_VALUE` and its comment), export it from `config/index.ts`, and use it at `:1410`.
   Keeping it adjacent to `convertEnumOptions` is deliberate: #134's `bug/loader-tsconfig-enum-options` moves that
   function into an exported core module and should move the constant with it.
5. **`moduleKindToString`** (`parsed-command-line.ts:183`) keeps its reverse lookup; it only gets real tests.
6. **Last commit:** update `docs/stories/ts7-rearchitecture/STORY-ts7-rearchitecture.md:57-62` ("Candidate slice
   independent of the strategy"): mark the `esModuleInterop: false` default, the implied `target: ES5` default (#161)
   and the hand-copied ES3/ES5 target tables (this PR) done under `tsc-option-parity`; the remaining hits point to
   #144's ownership table in `docs/plans/2026-10-02-typescript-6-support.md`.

The latent bug item 2 must not introduce, measured on 5.7.3 in this checkout: `ts.ScriptTarget[99]` is `"Latest"`
(declared after `ESNext`, so the reverse map wins) and `ts.parseCommandLine(["--target", "latest"])` is rejected
(6046); `ts.parseCommandLine(["--target", "json"])` is rejected too, but `json` is today's output for 100 and stays.
On 6.0.3 `ts.ScriptTarget[12]` is `"LatestStandard"` (#144 row 10), so 12 also needs its explicit entry; on 5.7.3
`ts.ScriptTarget` has no 12 at all and the entry is what turns today's `"12"` into `es2025`. All `ts.ModuleKind`
values on 5.7.3 reverse-map to names `--module` accepts (None, CommonJS, AMD, UMD, System, ES2015, ES2020, ES2022,
ESNext, Node16, NodeNext, Preserve; probed), so `moduleKindToString` needs no fix today; the tests guard 6.x.

The plan is canonical; this is orientation.

### Settled decisions — do not re-derive them

- **Derive from `ts.ScriptTarget`, plus explicit 12/99/100 entries; no hand-copied table.** A plain reverse map
  (what the plan's first draft said, "like `moduleKindToString`") emits `latest` for ESNext, which `--target`
  rejects; both the tsc-semantics and ts7-roadmap jurors probed this on 5.7.3. A full hand table is what the slice
  removes: it already missed 12 for 6.x (#144 row 10).
- **`TARGET_MAP` goes without replacement.** It is verified identity for every key; no behaviour change.
- **One 6046 constant, next to `convertEnumOptions`, in `resolve-compiler-config.ts`.** #134's
  `bug/loader-tsconfig-enum-options` has not started, so its new module does not exist yet; do not create it here.
- **The message uses `scriptTargetToString`, so `ES5` becomes `es5`.** With `module` unset the message only fires for
  targets below ES2015 (`getEmittedModuleKind`, `esm/check-esm.ts:95-101`), so in practice it prints `es3`/`es5`;
  the `Latest` the plan mentions cannot reach this message on 5.x. One function names targets everywhere in core.
- **No Release-Notes entry.** The plan's Changelog lists none for this slice (it calls it non-breaking); the only
  visible change is the case of the target name in the ESM message. Do not touch `Release-Notes.md`.
- **Leave for #144** (`docs/plans/2026-10-02-typescript-6-support.md`, ownership table at `:160-175`):
  - `check-esm.ts:100` (`?? ts.ScriptTarget.ES5`, row 14) and `SCRIPT_TARGETS` in `check-esm.ts` (name → enum, the
    other direction): `bug/typescript-6-own-compilations`.
  - `packages/node/src/compiler-options.ts:31-33` (websmith-node's own `ts.ScriptTarget[value]` with a 99 special
    case, row 16): `bug/node-tsc-ignore-config`, duplicated deliberately because node must not import core.
  - `ES2025`, `Node18`, `Node20` in `@quatico/websmith-api` types and `getEffectiveTarget` for `Node18`/`Node20`:
    `feature/typescript-6-module-kinds`.
  - This slice gives #144 exactly: `scriptTargetToString(12) === "es2025"` (and 99/100) in core, and the exported
    6046 constant. Do not add a 6.x version branch anywhere.
- **Tests must not assume 5.7.3's enum.** `ts.ScriptTarget.ES2025` does not exist in 5.7.3's typings (compile error);
  write `12 as ts.ScriptTarget`. Iterate `ts.ScriptTarget` / `ts.ModuleKind` values instead of listing them, so the
  #144 6.0.3 cell checks its own enum.

### Done when

The plan's slice line is the specification. Assertions a naive implementation would pass without:

- **Round-trip, not tautology.** The existing test at `parsed-command-line.spec.ts:749-756` asserts
  `createArgs({ module })` equals `ts.ModuleKind[module].toLowerCase()`, the same expression as the code, so it can
  never fail. Replace it, and add the target counterpart, with a round trip through TypeScript's own parser: for every
  numeric `ts.ModuleKind` value, `ts.parseCommandLine(createArgs({ module }))` has no errors and `options.module`
  equals the input; same for every numeric `ts.ScriptTarget` value except `JSON` (100), via `createArgs({ target })`.
  The target case must fail against a plain reverse map (99 → `latest`).
- **Explicit literals for the entries the reverse map gets wrong:** `createArgs({ target: 99 })` →
  `["--target", "esnext"]`, `100` → `json`, `12 as ts.ScriptTarget` → `es2025` (on 5.7.3 `ts.ScriptTarget[12]` is
  `undefined`, so this fails before), and an unknown number such as `42` → `"42"` (today's fallback, kept). String
  values (`createArgs({ target: "es2020" })`) still pass through unchanged.
- **`scriptTargetToString` unit tests** for every value 0..12, 99 and 100 (directly, now that it is exported).
- **`getCheckedEsm` message:** update `Compiler.spec.ts:4063` to the `scriptTargetToString` name of
  `ts.getDefaultCompilerOptions().target` (not a literal `es5`, see #161's rule on version-dependent defaults), and add
  a case with an explicit `target: ES3` naming `es3`.
- **`TARGET_MAP` removal:** a `Compiler.spec.ts` case where a profile `tsConfig` sets `target` (e.g. ESNext, 99) and
  the program the profile builds is created with that target, plus the existing suites green. No behaviour change.
- **6046:** `grep -rn "6046" packages/*/src` shows one definition; the transpile filter at `:1410` and
  `convertEnumOptions` both use it; their existing tests stay green.
- **e2e (compiler-test), as the slice line says:** `--target esnext` through the CLI args path reaches `tsc` as
  `esnext`, i.e. the emitted JS equals `node_modules/.bin/tsc --target esnext` on the same fixture (pick one where
  ESNext output differs from ES5, e.g. `const`/native `async`; `tsc-defaults.test.ts` from #161 shows the harness).
  Be aware: a CLI `--target esnext` arrives as a string and `convertValueToString` passes strings through, so this
  case alone does not reach `scriptTargetToString`. Also run it with a profile `tsConfig` `"target": "ESNext"` in
  `websmith.config.json` (converted to 99 by `convertEnumOptions`, then through the `:442` normalize path that loses
  `TARGET_MAP`). Before committing, swap in a naive `ts.ScriptTarget[value].toLowerCase()` once and note in the PR
  which tests turn red; the numeric path into `createArgs` today is the webpack loader's `tsConfig` option
  (`webpack/src/options.ts:18` → `parsedCommandLine` → `createArgs`). If no e2e turns red, say so in the PR rather
  than adding a webpack-test case outside the slice; the round-trip unit test is the fail-before.
- **Story:** the `ts7-rearchitecture` edit is the last commit (a `d` commit).
- Gates, in this order: `pnpm lint`, `pnpm build`, `pnpm test --skip-nx-cache`, `pnpm test:e2e --skip-nx-cache`
  (e2e runs the built output, so build first). Tests per `docs/rules/testing.md` (`testObj`, `actual`, AAA, no shared
  `testObj`); new files, if any, get the license header (`pnpm license:add`). No README change (no CLI flag, config
  key or addon API changes).

Environment: use pnpm 10 from `$HOME/.nvm/versions/node/v22.17.0/bin` (Homebrew's pnpm 11 fails with E401);
installs `--offline` (the Artifactory login in `~/.npmrc` is expired; never edit `~/.npmrc`; if a registry package
is needed, use an empty `NPM_CONFIG_USERCONFIG` file plus `--config.registry=https://registry.npmjs.org/`); Node 24
for runtime checks is `$HOME/.nvm/versions/node/v24.21.0/bin/node`; `tsc` for comparisons is
`node_modules/.bin/tsc` (5.7.3). Commits in Arlo's notation without colon (e.g. `R Removes the identity
TARGET_MAP`, `B Names ESNext as esnext in derived target arguments`, `d Marks the target tables done in the
ts7-rearchitecture story`); `trash`, never `rm`.

### Bookkeeping

- Push the first real commit as soon as it exists.
- Open the PR with `plot-open-pr.sh` (never `gh pr create`); give it a descriptive title if the generated one is
  only the slice heading.
- When the PR exists, append `→ #<number>` to the `bug/option-enum-tables` line in the plan's `## Slices`, committed
  and pushed on this branch.

### Scope guard

This branch owns: `Compiler.ts` (`TARGET_MAP`, `normalizeCompilerOptions`, the 6046 constant and its use, the
`getCheckedEsm` target name), `config/parsed-command-line.ts` (`scriptTargetToString`, `moduleKindToString` untouched
except tests), `config/resolve-compiler-config.ts` (the constant only), `config/index.ts` exports, their specs
(`Compiler.spec.ts`, `parsed-command-line.spec.ts`), compiler-test e2e, the story file, and the plan's slice line.

Not this branch: `defaults.ts`, `effective-options.ts` (#161, done); `convertEnumOptions` logic and `lib`
(`bug/profile-lib-names`, #134); `esm/check-esm.ts`, `packages/node`, `packages/api` types (#144);
`Release-Notes.md`.

In flight now (checked with `gh pr diff` and the plans on `develop`):

- `bug/esm-check-attribution` (docs/plans/2026-10-02-esm-check-precision.md, starting now): a `Compiler`-held
  registry for nested-compile ESM checks, `CompilationContext.ts`, `Compiler.spec.ts`, `bin.test.ts`,
  `packages/compiler/README.md`, `Release-Notes.md`. **Real collision:** `Compiler.ts` and `Compiler.spec.ts` around
  the ESM check; your edit at `:805` sits inside `getCheckedEsm`, which that branch is likely to touch. Keep the
  `:805` change to the one expression; whichever merges second rebases.
- `bug/loader-resolve-options-once` (#165): `Compiler.ts` (new methods at `:341`), `Compiler.spec.ts`,
  `ResolvedCompilerOptions.ts`, `webpack/src/*` incl. `loader-options.ts` and `options.ts`' callers. Overlap:
  `Compiler.ts` / `Compiler.spec.ts`, disjoint hunks; expect a clean rebase. It changes the loader path that carries
  numeric targets into `createArgs`; do not edit `packages/webpack`.
- `bug/cli-config-parse-and-addons-dir` (#163): `resolve-compiler-config.ts` (new `formatPosition`/`formatReason` at
  `:146` and a JSON `try` at `:177`) and its spec. Overlap: `resolve-compiler-config.ts`, disjoint from `:75`; do not
  reorder that file.
- `bug/trim-runtime-dependencies` (#164): `package.json`s, `pnpm-lock.yaml`, `browser-system.ts`. No overlap.
- `infra/typescript-6-toolchain` (#144): repo and package `tsconfig*.json`, `package.json`s, `pnpm-lock.yaml`,
  `packages/compiler/webpack.config.js`, `fusion-fs.ts`. No file overlap; its typescript-eslint/ts-jest bump can
  flag new lint or type findings in this branch's code after a rebase.

If you find something the plan did not anticipate (another hand-copied target or module table in core, a caller
that relies on `normalizeCompilerOptions` mutating or not copying, a `--module` name that does not round-trip),
report it rather than improvising outside scope.
