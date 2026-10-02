<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — tsc-option-parity (slice "tsc defaults")

- **Plan (canonical):** `docs/plans/2026-10-02-tsc-option-parity.md` on `develop` (panel:
  `.plot/panels/2026-10-02-tsc-option-parity/panel.md`)
- **Approved:** 2026-10-02, Jan Wloka, plan-PR #135 merged
- **Branch:** `bug/tsc-default-target-interop` (base: `develop`, at `06e086b5` when this brief was written)
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh` (on `PATH`); never merged by the implementer
- **Review of the code:** independent review plus uncached gates run by the maintainer's session before merge

First slice of the plan; it waits on nothing. Waiting on it: this plan's `bug/option-enum-tables` (also edits the
`Compiler.ts:802` message) and, through that, #144's `bug/typescript-6-own-compilations`, which extends the
`effective-options.ts` module created here and switches `check-esm.ts:100` to `getEffectiveTarget`; #136's
`bug/report-config-option-errors` and `bug/report-file-less-diagnostics` run after this slice because a changed
default `target` can surface new TS5xxx option combinations.

### What to build

websmith pins `target: ES5` and `esModuleInterop: false` for every project that leaves them unset, where `tsc`
derives them from `module`. `packages/core/src/compiler/defaults.ts:9-21` spreads `ts.getDefaultCompilerOptions()`
(`{ target: 1, jsx: 1 }` on 5.7.3) and sets `esModuleInterop: false`; that object is merged first at
`options/options.ts:36`, `:47` and `options/ResolvedCompilerOptions.ts:371`, so the CLI, `transpileOnly` and the
webpack loader all get it. Reproduced on `d7ffdf4` against `tsc` 5.7.3 with `module: nodenext` and no `target`:

- websmith emits `var` and `__awaiter`/`__generator`, no `__importDefault`, declarations `v: any`, `Promise<any>`;
  `tsc` emits `const`, native `async`, `__importDefault`. Same on the `transpileOnly` path. A CommonJS default
  import compiled without interop reads `def.value` as `undefined` at runtime.
- `.d.mts` from `index.mts` with `import("./def.js")` (CJS, `export default def; export const x = 1`): `tsc` emits
  `Promise<{ default: typeof import("./def.js"); x: 1 }>`, websmith `Promise<typeof import("./def.js")>`. Pure
  consequence of the interop default: `tsc --esModuleInterop false` prints websmith's type.
- `module: preserve` loses interop the same way (`tsc` derives `esModuleInterop` true there; target stays ES5).
- `module: commonjs` without `target` is already byte-identical to `tsc`, and explicit values are respected.
- On TypeScript 6 the pinned `esModuleInterop: false` is TS5107 on every project that leaves it unset (#144 row 4).

The change:

1. `tsDefaults`: drop the `...ts.getDefaultCompilerOptions()` spread and `esModuleInterop: false`; add
   `jsx: ts.JsxEmit.Preserve` explicitly with a comment giving the reason below. Leave `strict: false` and the other
   pins alone.
2. New `packages/core/src/compiler/config/effective-options.ts` exporting
   `getEffectiveTarget(options: ts.CompilerOptions): ts.ScriptTarget` — explicit `target`, else `ES2022` for
   `module: Node16`, `ESNext` for `module: NodeNext`, else `ts.getDefaultCompilerOptions().target`. Export it from
   the `config` index.
3. Switch exactly these readers to it, each with a unit test:
   - `Compiler.ts:1208`, `:1215`, `:1285` and `environment/system.ts:73` — today `?? ts.ScriptTarget.Latest`
     (`system.ts` uses `||`); after step 1 they would parse with Latest where `tsc` parses with the effective target.
   - `Compiler.ts:798` — pass `target: getEffectiveTarget(options)` to `getEmittedModuleKind` in `getCheckedEsm`.
   - `Compiler.ts:802` — the message's `target ?? "ES5"` names the effective target instead.
   - `Compiler.ts:983` — the debug line's `target: … ?? 99` prints the effective target, not `99`.
4. compiler-test e2e, webpack-test snapshot updates, `Release-Notes.md` Breaking entry (see Done when).

The plan is canonical; this is orientation.

### Settled decisions — do not re-derive them

- **Remove the two pins; do not compute and set the "right" values.** The panel's tsc-semantics juror deleted the
  spread and `esModuleInterop: false` from a built `develop` and got output trees byte-identical to `tsc` 5.7.3 for
  nodenext, node16, commonjs, esnext+bundler, preserve, no options, node16 with explicit ES5, and `-o`. TypeScript
  derives the effective target and interop during emit; writing derived values into `tsDefaults` would freeze one
  TypeScript version's rules into the options addons see.
- **Websmith-owned helper, not `ts.getEmitScriptTarget` / `ts.getESModuleInterop`.** Both exist at runtime but are
  absent from `typescript.d.ts` (probed on 5.7.3: they would need a cast and add two untyped symbols) and from the
  TypeScript 7 surface. One small helper is the single seam #144 extends for 6.x. Keep it on `ts.CompilerOptions`
  only — no `ts.System`, no host — so it can move with a websmith-owned options type later.
- **Fallback is `ts.getDefaultCompilerOptions().target`, never a literal `ES5`.** It is public API and yields ES5 on
  5.x and ES2025 (12) on 6.x, so websmith follows the installed TypeScript exactly as `tsc` does. #144 relies on
  this to fix its row 14 with no version branch.
- **No interop helper.** No websmith code reads the effective `esModuleInterop`; TypeScript derives it itself.
  Adding `getEffectiveInterop` is scope creep.
- **Only `node16` / `nodenext` in the helper.** `Node18`/`Node20` (6.x) belong to #144's
  `feature/typescript-6-module-kinds`; `preserve` keeps the default target (that is `tsc`'s rule).
- **`jsx: Preserve` stays, explicitly.** Executed by the panel: without it a `.tsx` file compiles to `a.js` containing
  raw `<div />`, exit 0, no diagnostic (today `a.jsx`). The upgrade juror's read claim that the build would fail is
  wrong; silently invalid output is the reason, and the code comment must say so.
- **Audit is bounded to the seven sites above.** `editing/edit-check.ts:21` also uses `tsDefaults` but only passes
  it to `createVersionedFiles` (covered by the `system.ts:73` switch) and the language service (which derives the
  target itself); no change there. `check-esm.ts:100` (`?? ES5` inside `getEmittedModuleKind`) is #144's row 14 —
  on 5.x it already equals the effective target, so leave it. The `Latest` printed for 99 in the `:802` message is
  `bug/option-enum-tables`' fix, not this slice's.
- **`packages/node/src/compiler-options.ts:9` has its own `tsDefaults`** (`target: ESNext`, `esModuleInterop: true`,
  `jsx: React`) for the node wrapper. It is not changed.
- **Breaking, not Fixed.** Emitted JavaScript changes silently with exit 0; 0.10.0 listed behaviour changes the same
  way (`Release-Notes.md:76,79,101`). All three jurors agreed. Release is 0.11.0.
- **webpack-test snapshot changes ship in this PR** as part of the breaking surface; they are not a follow-up.

Rules carried over: tests must not assert version-dependent defaults (#144 runs a 6.0.3 cell): where an expectation
used to be `target: 1` / `esModuleInterop: false` for an unset value, assert the option is absent, or compare with
`ts.getDefaultCompilerOptions().target`, never a literal. Absent is not false: `esModuleInterop` unset must stay
`undefined`, not become `false` again through a spread somewhere else.

### Done when

The plan's slice line is the specification. Assertions a naive implementation would pass without:

- **e2e must reach `tsDefaults`.** In compiler-test, run websmith through `compile(files, { websmith: { … } })` from
  `@quatico/websmith-node` (it builds core's `Compiler`, which merges `tsDefaults` at
  `ResolvedCompilerOptions.ts:371`) or the bundled CLI, with options that leave `target` and `esModuleInterop`
  unset. Do not reuse `compile-websmith.test.ts`'s `tsDefaults` object (it sets `target: ESNext`, `module: ESNext`),
  and never call the `tsc` side as `compile(files)` without `tsConfig`: websmith-node then substitutes its own
  `tsDefaults` (ESNext, interop on, `jsx: React`) and the expectation is wrong. Each case must fail on `develop`.
- node16, nodenext and preserve fixtures without `target`/`esModuleInterop` give the same JS **and** declarations as
  `tsc` on the Program path and with `transpileOnly: true` (catches fixing only one path); commonjs without `target`
  is unchanged (catches over-reach).
- The `.d.mts` dynamic-import fixture (item 3) emits `tsc`'s `Promise<{ default: …; x: 1 }>` (catches an interop
  default set somewhere other than `tsDefaults`).
- A class with fields under nodenext emits `tsc`'s `useDefineForClassFields` shape (catches a target that only looks
  right in `const`/`async`).
- A `.tsx` fixture without `jsx` still emits `.jsx` (catches dropping `jsx` along with the spread).
- Unit, `getEffectiveTarget`: explicit target wins (also explicit ES5 with nodenext), node16 → ES2022, nodenext →
  ESNext, other `module` (incl. preserve, commonjs, unset) → `ts.getDefaultCompilerOptions().target`.
- Unit, resolved options (`options.spec.ts`, `ResolvedCompilerOptions.spec.ts`): unset `target`/`esModuleInterop`
  stay `undefined`, explicit values are kept, `jsx` is `Preserve`.
- Unit, `getCheckedEsm`: an `esm` profile with `module` and `target` unset still classifies as CommonJS (skipped)
  and the message names the effective target (`ES5` on 5.x via the helper, not the literal fallback).
- Unit for the `:1208`/`:1215`/`:1285`/`system.ts:73` parses: with `module: nodenext` and no `target` the source file
  is created with ESNext, with nothing set with the default target — not `Latest`.
- webpack-test: run the suites and update snapshots with `-u` only after reading each diff; every hunk must be ES5 →
  newer syntax or interop helpers. Anything else: stop and report.
- `Release-Notes.md` `## [Unreleased]` / `### Changed`: replace `- TBA` with the `**Breaking:**` entry worded as the
  plan's Changelog (affected `module` values node16, nodenext, preserve; ES2022/ESNext output, default `lib`,
  `useDefineForClassFields`; `__importDefault`/`__importStar`, `allowSyntheticDefaultImports`, `.d.mts`; other
  `module` values unaffected; migration via `"target": "ES5"`, `"esModuleInterop": false`,
  `"useDefineForClassFields": false` in `tsconfig.json` or a profile `tsConfig`; unset options follow the installed
  TypeScript). No README change is required (`README.md:191` is an example config).
- Gates, in this order: `pnpm lint`, `pnpm build`, `pnpm test --skip-nx-cache`, `pnpm test:e2e --skip-nx-cache`
  (e2e runs the built output, so build first). Tests per `docs/rules/testing.md` (`testObj`, `actual`, AAA, no
  shared `testObj`); new files get the license header (`pnpm license:add`).

Environment: use pnpm 10 from `$HOME/.nvm/versions/node/v22.17.0/bin` (Homebrew's pnpm 11 fails with E401);
installs `--offline` (the Artifactory login in `~/.npmrc` is expired; never edit `~/.npmrc`; if a registry package
is needed, use an empty `NPM_CONFIG_USERCONFIG` file plus `--config.registry=https://registry.npmjs.org/`); Node 24
for runtime checks is `$HOME/.nvm/versions/node/v24.21.0/bin/node`; `tsc` for comparisons is
`node_modules/.bin/tsc` (5.7.3). Commits in Arlo's notation without colon (e.g. `B Stops pinning ES5 and
esModuleInterop false in tsDefaults`); `trash`, never `rm`.

### Bookkeeping

- Push the first real commit as soon as it exists.
- Open the PR with `plot-open-pr.sh` (never `gh pr create`); give it a descriptive title if the generated one is
  only the slice heading.
- When the PR exists, append `→ #<number>` to the `bug/tsc-default-target-interop` line in the plan's `## Slices`,
  committed and pushed on this branch.

### Scope guard

This branch owns: `packages/core/src/compiler/defaults.ts`, `config/effective-options.ts` (new) and its spec, the
`config` index export, the listed lines of `Compiler.ts` and `environment/system.ts`, the specs asserting the old
defaults (`options.spec.ts`, `ResolvedCompilerOptions.spec.ts`, `Compiler.spec.ts`, `parsed-command-line.spec.ts`,
`check-esm.spec.ts` where they expect `target: 1` / `esModuleInterop: false`), new compiler-test fixtures and tests,
`packages/webpack-test/tests/__snapshots__/`, `Release-Notes.md`, and the plan's slice line.

Not this branch: `scriptTargetToString`, `TARGET_MAP`, the 6046 constant (`bug/option-enum-tables`); `lib` conversion
and `convertEnumOptions` (`bug/profile-lib-names`, #134); `check-esm.ts`, `strict: false`, `Node18`/`Node20`
(#144); `packages/node`.

Starting at the same time (checked against their plans on `develop`):

- `bug/cli-project-directory` (#136): edits `ResolvedCompilerOptions.ts` (`resolvePathsWithRules`),
  `parsed-command-line.spec.ts`, `ResolvedCompilerOptions.spec.ts`, `command.spec.ts`, `bin.test.ts` and
  `Release-Notes.md`. Real collisions: both spec files and `Release-Notes.md`. Do not touch
  `ResolvedCompilerOptions.ts` itself; whichever merges second rebases.
- `bug/esm-check-false-positives` (#137): `esm/` scanners and their specs, `bin.test.ts`,
  `webpack-test/tests/webpack-esm-check.test.ts`, `Release-Notes.md`, `packages/compiler/README.md`. Collision:
  `Release-Notes.md` (different subsections, textual conflict likely on `- TBA`). Its webpack e2e has no snapshot
  file today; if it adds one, the snapshot directory overlaps.
- `infra/typescript-6-toolchain` (#144): package `tsconfig.json`s, `package.json`s, `pnpm-lock.yaml`,
  `packages/compiler/webpack.config.js`, `packages/testing/src/fusion-fs.ts`, lint toolchain. No file overlap; its
  typescript-eslint bump can flag new lint findings in this branch's code after a rebase.
- `infra/esm-bench-watchdog` (#134): `packages/webpack-test/perf/esm-watch-bench.cjs` only. No overlap.
- `infra/dependabot-config` (#133): `.github/dependabot.yml` and the claude-review workflow. No overlap.

If you find something the plan did not anticipate (another reader of `compilerOptions.target`, a snapshot diff that
is not ES5 → newer output, a `module` that arrives as a string at `:798`), report it rather than improvising outside
scope.
