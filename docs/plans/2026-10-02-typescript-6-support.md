<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# Support TypeScript 6 and measure the TypeScript 7.1 API

> Make websmith run on TypeScript 6.x as well as 5.x (peer range `5.x || 6.x`) without deprecation errors and
> without changing the addon API, and measure the TypeScript 7.1 nightly API (IPC cost, transformer support) to
> decide when to revisit a 7.x backend.

## Status

- **State:** Draft
- **Type:** feature
- **Story:** ts7-rearchitecture
- **Review:** pr
- **Impl:** own branches
<!-- Transition records — written by the workflow commands, not by hand:
- **Approved:** <date>, <who>, <channel>
- **Started:** <date>, <who>, <branch>   (one line per started branch)
-->

## Changelog

- Added: TypeScript 6 support. `@quatico/websmith-api`, `-core`, `-node`, `-testing` and the CLI accept
  `typescript` `5.x || 6.x`.
- Fixed: on TypeScript 6, websmith no longer fails with deprecation errors (TS5107) for options it sets itself:
  `moduleResolution` `classic`/`node10` when it compiles addons (CLI and webpack loader), and `target: ES5` /
  `node10` in `@quatico/websmith-testing`.
- Fixed: `@quatico/websmith-node` works with TypeScript 6's `tsc`, which rejects file arguments next to a
  `tsconfig.json` (TS5112).
- Added: the typed compiler options in `@quatico/websmith-api` know `ignoreDeprecations`, target `ES2025` and the
  module kinds `Node18`, `Node20` and `Preserve`; `--ignoreDeprecations` is accepted on the CLI.
- **Breaking (TypeScript 6 only):** if open point 3 is accepted, websmith no longer pins `strict: false`; an unset
  `strict` follows the installed TypeScript (off on 5.x as before, on with 6.x, as `tsc` does). Set
  `"strict": false` in `tsconfig.json` to keep the old behaviour.
- Addon authors: no change. `AddonContext` and the `ts.*` types it exposes stay as they are; addons run on the
  TypeScript version the project installs. TypeScript 7 is not supported; websmith reports a clear error when
  it finds a 7.x `typescript` (see the README for running websmith next to TypeScript 7).

## Motivation

The `ts7-rearchitecture` story mapped the TypeScript 7 API gap (analysis-ts7-api-gap.md). On 2026-10-02 Jan Wloka
chose **strategy A plus a 7.1 spike**: stay on TypeScript 6.x, keep the addon API unchanged, and measure the 7.1
nightly so that the result decides when to revisit strategies B (dual backend) and D (7.x only). TypeScript 7 is
`latest` on npm (7.0.2), 6.0.3 is the last 6.x; websmith's peer range is `5.x`, so a consumer who moves to 6.x
leaves it behind today.

TypeScript 6.0 has the same JS API as 5.7.3 (analysis 3), but turns deprecated options into errors and changes
defaults. Measured on `origin/develop` at `cfb284cc` with `typescript` overridden to 6.0.3 (Notes, "Probe"):

| # | What breaks on 6.0.3 | Where (develop) | Measured |
|---|---|---|---|
| 1 | Repo tsconfigs: `moduleResolution: "node"` (TS5107), `downlevelIteration` (TS5101), no `rootDir` next to `outDir` (TS5011, new 6.0 default) | `tsconfig.json:19`, `:48`; `packages/api/tsconfig.json:6`, `packages/core/tsconfig.json:8`, `packages/testing/tsconfig.json:6`; every package `tsconfig.json` with `outDir` | `pnpm build` fails in the first project (`websmith-api`) |
| 2 | The CLI bundle: ts-loader 9.5.2 passes `rootDir: undefined` to `transpileModule`, so every bundled file reports TS5011; with ts-loader 9.6.2 the `rootDir` must also cover `../core/src` (TS6059) | `packages/compiler/webpack.config.js:35-39` | 81 errors; green with ts-loader 9.6.2 plus `compilerOptions.rootDir` = `packages/` |
| 3 | One type error: Node's `StatWatcher` not assignable to memfs's | `packages/testing/src/fusion-fs.ts:182` | TS2740; green with a cast |
| 4 | websmith's own default `esModuleInterop: false` → TS5107 on every project that leaves it unset, Program and `transpileOnly` path alike | `packages/core/src/compiler/defaults.ts:16` | websmith exits 1 where `tsc` 6.0.3 passes; 31 e2e and most unit failures |
| 5 | Default `target` from `ts.getDefaultCompilerOptions()` is `12` (ES2025) on 6.0.3, `1` (ES5) on 5.7.3 | `defaults.ts:10` | 16+ unit assertions expect `target: 1`; default lib becomes `lib.es2025.full.d.ts` |
| 6 | Addon compilation in the webpack loader uses `moduleResolution: Node10` | `packages/webpack/src/WebpackAddonService.ts:297` | TS5107 in the loader suites |
| 7 | Test environment compiles with `target: ES5`, `moduleResolution: Node10` | `packages/testing/src/compilation/environment.ts:394-396` | TS5107; addons silently not loaded (`compilationEnv#addons` gets `[]`) |
| 8 | `@quatico/websmith-node` spawns `tsc <files>` in a directory with a `tsconfig.json` | `packages/node/src/websmith/Compiler.ts:86` | TS5112 "Use '--ignoreConfig'"; 4 node suites fail |
| 9 | Addon compilation in the CLI uses `moduleResolution: Classic` | `packages/core/src/compiler/addons/AddonRegistry.ts:602` | no failure observed: a generator addon loaded and ran on 6.0.3. Still deprecated, gone in 7.0 |
| 10 | `scriptTargetToString` has no entry for `12`; `ts.ScriptTarget[12]` is `"LatestStandard"`, not `"ES2025"` | `packages/core/src/compiler/config/parsed-command-line.ts:155-174` | read, not reproduced: a `target` of ES2025 would reach `tsc` args as `"12"` |
| 11 | Fixtures and tests use `ModuleResolutionKind.Node10` | `packages/compiler-test/tests/compile-tsc.test.ts:16`, `compile-websmith.test.ts:60,100,149,187` | TS5107 in compiler-test e2e |
| 12 | The CLI flag `--outFile` | `packages/compiler/src/command.ts:57` | read: TypeScript reports its own deprecation error; websmith only passes it on |
| 13 | `ts.ImportsNotUsedAsValues` | `packages/node/src/compiler-options.ts:22` | read: still in 6.0.3 typings, builds; removed in 7.0 |
| 14 | ESM check assumes an unset `module` emits CommonJS below ES2015 (`target ?? ES5`); 6.0 defaults `module` to `esnext` (analysis 3) | `packages/core/src/compiler/esm/check-esm.ts:100`, message at `Compiler.ts:802` | read, not reproduced |

Totals on 6.0.3 with only the repo-level workarounds of rows 1-3 applied: `pnpm build` green, `pnpm lint` exit 0
(typescript-eslint 8.22 is outside its supported range), `pnpm test` 65 failures in 5 of 6 projects,
`pnpm test:e2e` at least 124 failures (37 compiler-test, 30 compiler, 57 loader-test; the counts of the other
suites were not recorded). Almost all trace to rows 4-8 and 11.

`ts.transpileModule` on 6.0.3 with `reportDiagnostics` reports TS5107 for deprecated options (checked with
`esModuleInterop: false`, `Classic`, `ES5`): the story's open question "does `transpileModule` raise the
deprecation errors" is answered yes.

## Design

### Approach

- **Strategy A, nothing more.** websmith keeps calling the classic `typescript` API in process. No adapter layer,
  no websmith-owned AST, no change to `AddonContext` or the `ts.*` types it exposes. Additive optional members in
  the typed option records of `packages/api` are allowed (open point 5).
- **Supported range:** peer `typescript` `5.x || 6.x` in every package that declares one (`api`, `core`, `node`,
  `testing`, `example-addons`). TypeScript 7 is out of range. Because a 7.x `typescript` has no `main`, websmith
  checks `ts.version` at its entry points and reports "websmith needs TypeScript 5.x or 6.x, found 7.x" instead of a
  module-resolution crash.
- **Pinned dev version: move to 6.0.3, keep 5.7.3 in CI** (open point 1). Analysis:
  - For 6.0.3: the deprecation errors catch any new use of deprecated options at build time in the repo itself,
    not only in a CI leg; 6.x is the line strategy A stays on; the exported API is identical to 5.7.3 (analysis 3:
    533 function names, empty diff), so compiling against 6.0.3 types rarely admits 6-only API, and the 5.7.3 leg
    catches the rest (`libReplacement`, `erasableSyntaxOnly`, `ScriptTarget.ES2025`).
  - For staying on 5.7.3: no toolchain bump (ts-jest 29.2.5 declares `<6`, typescript-eslint 8.22 `<5.8`), and
    the floor users have today is what developers see. Cost: deprecations show up only in the 6.x CI leg.
  - Either way both versions run in CI, so tests must not assert version-dependent defaults (row 5).
  - The pin moves in the last product slice, after the 6.x leg is green; earlier slices check 6.0.3 through a
    workspace override (below).
- **The CLI's own `typescript`** is a `dependency` pinned to 5.7.3 (`packages/compiler/package.json:49`), so CLI
  users get 5.7.3 whatever their project installs. Proposed: make it a peer `5.x || 6.x` like the other packages,
  so the CLI compiles with the project's TypeScript, as the loader already does (open point 2).
- **Running a slice on 6.0.3 before the matrix exists:** add `"pnpm": { "overrides": { "typescript": "6.0.3" } }`
  to the root `package.json` in a scratch copy and run `pnpm install` (the probe's method). The CI matrix
  (slice 4) does the same in its 6.x leg, so the lockfile stays on the pinned version.
- **Deprecation hits, owner per hit.** Overlap with the draft plan `tsc-option-parity` (#135):

  | Hit | Owner |
  |---|---|
  | `esModuleInterop: false` default (row 4) | #135 slice 2 `bug/tsc-default-target-interop` |
  | `target: ES5` from `getDefaultCompilerOptions()` (row 5) | #135 slice 2 |
  | `TARGET_MAP` ES3/ES5 rows, `scriptTargetToString` (row 10) | #135 slice 3 `bug/option-enum-tables`; this plan asks it to cover `12` (ES2025) |
  | `strict: false` default | this plan, slice 2 (open point 3) |
  | `Classic` / `Node10` in websmith's own compilations (rows 6, 7, 9) | this plan, slice 2 |
  | Test fixtures with `Node10` (row 11) | this plan, slice 2 |
  | ESM check's module default (row 14) | this plan, slice 2 |
  | Repo tsconfigs, `downlevelIteration`, `rootDir`, ts-loader (rows 1-3) | this plan, slice 1 |
  | `--outFile` CLI flag (row 12) | this plan, slice 2 (README note only, open point 6) |
  | websmith-node `tsc` spawn (row 8) | this plan, slice 3 |
  | `ImportsNotUsedAsValues` (row 13) | not here: builds on 6.x; a 7.x concern |

  Slice 2 starts after #135's slices 2 and 3 are merged. If #135 is not approved by then, slice 2 takes rows 4, 5
  and 10 over, without #135's other changes.
- **Findings carried over from #135's panel** (`ts7-roadmap` juror): `ts.getEmitScriptTarget` and
  `ts.getESModuleInterop` exist at runtime but are not in `typescript.d.ts`, so neither this plan nor #135 calls
  them; the effective-target logic lives in one websmith helper (#135 finding 1), and slice 2 extends that helper
  for 6.x defaults (row 14) instead of adding a second one. `ts.ScriptTarget[99]` is `"Latest"`, and on 6.0.3
  `ts.ScriptTarget[12]` is `"LatestStandard"` (measured): reverse enum lookups need explicit entries for 12, 99
  and 100. `Compiler.ts:802` builds a message with `ts.ScriptTarget[target]` and has the same exposure.
- **Replacement for `Classic` / `Node10` (rows 6, 7, 9).** The CLI's addon compilation sets `noResolve: true`, so
  its `moduleResolution` has no effect: drop it. The loader's addon compilation resolves imports; with
  `module: CommonJS`, 5.7 accepts neither `Bundler` nor `Node16` resolution without changing `module`, which would
  change the emitted format for addons in `"type": "module"` packages (see the delivered
  `fix-ts-addons-esm-projects`). Slice 2 picks per installed major (`Node10` on 5.x, `Bundler` on 6.x, which
  allows `Bundler` with CommonJS per the 6.0 release notes — verify) or drops the option; the existing ESM-addon
  e2e cases decide.
- **CI matrix (slice 4):** `typescript: ["5.7.3", "6.0.3"]` next to `node-version: [22, 24]`. The 5.7.3 leg runs
  the lockfile as is; the 6.0.3 leg applies the override and `pnpm install --no-frozen-lockfile` before the
  Definition of Done steps. Size: 4 jobs, or 3 if 5.7.3 runs on Node 22 only (open point 8).
- **Toolchain (slice 1):** ts-loader `^9.6.2` (respects `rootDir` in `transpileOnly` mode), ts-jest `^29.4`
  (peer `>=4.3 <7`), typescript-eslint and `@typescript-eslint/*` to a release whose peer range includes 6.0
  (8.71.0 declares `<6.1.0`). The dependency-updates plan (#133) explicitly leaves the lint toolchain out, so no
  overlap in intent; both touch `pnpm-lock.yaml`, and whichever merges second rebases.
- **Repo tsconfigs (slice 1):** remove `downlevelIteration` (target is ESNext), set `rootDir` next to every
  `outDir`, replace `moduleResolution: "node"` with a value valid on 5.7 and 6.0 for CommonJS packages (`node16`
  with `module: node16`, or omitting it), and pass `rootDir` = `packages/` to ts-loader in the CLI's webpack
  config. No `ignoreDeprecations`: the repo must build clean on 6.x so that it will on 7.x tooling later.
- **Tests per slice** (Definition of Done): unit tests in the touched packages (assemble / act / assert,
  `testObj`, `actual`); slices 2 and 3 add e2e cases in `packages/compiler-test` and `packages/webpack-test` that
  compile a fixture without the options websmith used to pin and assert no TS5107 on 6.x and unchanged output on
  5.x. Assertions on version-dependent defaults (row 5) compare against `ts.getDefaultCompilerOptions()` or the
  installed major instead of literals.
- **Spike (slice 5)** writes no product code. It produces a dated report
  `docs/stories/ts7-rearchitecture/analysis-ts71-measurement.md` and a recommendation recorded in the story:
  - Versions: an exact `typescript@7.1.0-dev.*` nightly (pinned and named), against in-process 5.7.3 and 6.0.3.
  - Workloads (webpack-like): (a) cold start, i.e. spawn plus first `transpileModule`; (b) per-file
    `transpileModule` for 200 and 1,000 modules, one call per module as the loader does in `transpileOnly`;
    (c) one `createProgram` plus `getJavaScriptEmit` per file for the same sets (the type-checked loader path);
    (d) the same three in process on 5.7.3 and 6.0.3. Inputs: the `webpack-test` fixtures and a generated corpus
    of realistic module sizes.
  - Metrics: wall time total, per-file median and p95, startup, peak RSS of client and server; 5 runs, machine and
    Node version recorded. The harness sits beside `packages/webpack-test/perf/esm-watch-bench.cjs` (existing
    precedent) and is not part of any suite.
  - Status checks on the same date: roadmap item 3C (custom transformers) in microsoft/TypeScript#63875, its
    phase (after JS emit or `before`), whether the nightly's typings have any transformer parameter, and the state
    of ts-loader's migration (TypeStrong/ts-loader#1704).
  - Output: per workload, the ratio of 7.1 IPC to 6.x in process; a recommendation with the trigger for
    revisiting B or D (open point 9 sets the threshold), recorded as a dated row in the story's Decisions table.

### Open Points

- [ ] **1. Pinned dev version.** Recommended: move to 6.0.3 in slice 4, keep 5.7.3 as a CI leg. Alternative: stay
      on 5.7.3 and run 6.0.3 only in CI. Which?
- [ ] **2. The CLI's `typescript`.** Recommended: peer `5.x || 6.x` (the CLI uses the project's TypeScript, like
      the loader; npm 7+ and pnpm install peers). Alternatives: dependency `6.0.x` (CLI users move to 6.0 defaults
      on upgrade: `strict`, `types: []`, `rootDir`), or keep `5.7.3` (the CLI does not get TypeScript 6).
- [ ] **3. `strict: false` default** (`defaults.ts:20`). Recommended: drop the pin, as #135 does for `target` and
      `esModuleInterop`: no change on 5.x, matches `tsc` on 6.x, Breaking entry for 6.x users. Alternative: keep it
      and document the difference from `tsc` 6.
- [ ] **4. Lower bound.** The decision says `5.x || 6.x`, but CI tests only 5.7.3, and `ModuleKind.Node18`/`Node20`
      and `ScriptTarget.ES2024` are newer than 5.0. Keep `5.x` or declare `>=5.7 <7`?
- [ ] **5. Additive API types.** Do new optional members (`ignoreDeprecations`, `ES2025`, `Node18`, `Node20`,
      `Preserve`) in `TsConfigOptions` / `TscArguments` / `CompilerArguments` count as "addon API unchanged"?
      Recommended: yes; nothing existing changes.
- [ ] **6. `--outFile`.** Recommended: keep the flag (it works on 5.x; on 6.x TypeScript reports its own error)
      and note it in the CLI README. Alternative: remove it now, ahead of 7.0.
- [ ] **7. Dependency on #135.** Confirm that slice 2 waits for #135 slices 2 and 3, and that #135 slice 3 adds
      `12` / ES2025 (row 10) to its derived target names.
- [ ] **8. CI cost.** 4 jobs (both TypeScript versions on Node 22 and 24) or 3 (5.7.3 on Node 22 only)?
- [ ] **9. Spike threshold.** What 7.1-over-6.x ratio for per-file emit (workloads b and c) counts as acceptable for
      the loader, and does 3C have to ship in a released 7.x, or is a nightly enough, to reopen B?
- [ ] **10. Users on TypeScript 7.** Proposed for slice 4: a clear error on a 7.x `typescript` plus README guidance
      (keep `typescript@6` as the project's `typescript` for websmith and run 7.x through its own binary). A
      fallback to `@typescript/typescript6` would need module aliasing across every `import ts from "typescript"`;
      left to the spike's recommendation.

## Slices

### Repository on TypeScript 6

- `infra/typescript-6-toolchain` — repo tsconfigs valid on 5.7 and 6.0 (no `downlevelIteration`, explicit `rootDir`, no `moduleResolution: "node"`), ts-loader `^9.6.2` with `rootDir` for the CLI bundle, the `fusion-fs.ts:182` typing, ts-jest and typescript-eslint releases that support 6.0; Definition of Done green on 5.7.3, `pnpm build` and `pnpm lint` green on 6.0.3 through the override, no `ignoreDeprecations` <!-- builds: TypeScript-6-clean repo tsconfigs and toolchain -->

### websmith's own options on TypeScript 6

- `bug/typescript-6-deprecated-options` — after #135 slices 2-3: no `Classic`/`Node10`/`ES5` in websmith's own compilations (`AddonRegistry.ts:602`, `WebpackAddonService.ts:297`, `environment.ts:394-396`), `strict: false` pin per open point 3, ESM-check module default per installed major (`check-esm.ts:100`, `Compiler.ts:802`), `ignoreDeprecations`/`ES2025`/`Node18`/`Node20`/`Preserve` in the api option types and CLI, fixtures off `Node10`; unit tests; e2e in compiler-test and webpack-test: addon projects and projects without pinned options compile on 6.0.3 without TS5107 and unchanged on 5.7.3 <!-- builds: version-aware module default in the effective-options helper -->

### websmith-node on TypeScript 6

- `bug/node-tsc-ignore-config` — `@quatico/websmith-node` passes `--ignoreConfig` to a 6.x `tsc` when it spawns it with file arguments (`websmith/Compiler.ts:86`), unchanged on 5.x; unit tests for the argument list per major; e2e: the node suites' single-file compile passes on both versions <!-- builds: tsc argument for TypeScript 6 in websmith-node -->

### Peer range and CI matrix

- `feature/typescript-6-peer-range` — peers `5.x || 6.x` (or open point 4's range), the CLI's `typescript` per open point 2, the dev pin per open point 1, a `ts.version` check that rejects 7.x with a clear error, CI matrix leg for TypeScript 6.0.3, README and `packages/*/README.md` supported-versions text, `Release-Notes.md` entries; unit test for the version check; e2e suites green on both legs <!-- builds: TypeScript version matrix in pull-request.yml, ts.version guard -->

### TypeScript 7.1 measurement

- `infra/typescript-7-1-spike` — benchmark harness beside `packages/webpack-test/perf/` and the report `docs/stories/ts7-rearchitecture/analysis-ts71-measurement.md`: IPC cost of per-file `transpileModule` and `getJavaScriptEmit` on a pinned 7.1 nightly vs in-process 5.7.3/6.0.3 (workloads a-d), roadmap 3C and ts-loader#1704 status, a recommendation with the trigger to revisit B/D recorded in the story; no product code <!-- builds: ts71 IPC benchmark harness and measurement report -->

## Notes

- Created 2026-10-02 from the `ts7-rearchitecture` story after the strategy decision (A + 7.1 spike, Jan Wloka).
  The story's "Candidate slice independent of the strategy" is split between this plan and #135 (table under
  Approach).
- **Probe (executed 2026-10-02).** Scratch copy of `origin/develop` at `cfb284cc` (`git archive`), `pnpm install
  --frozen-lockfile --offline`, then `pnpm add -D -w typescript@6` from registry.npmjs.org (6.0.3; root only, so it
  warned that ts-jest 29.2.5 wants `<6` and typescript-eslint 8.22.0 `<5.8.0`) and a root `pnpm.overrides`
  `typescript: 6.0.3` so every package resolved 6.0.3. Then, step by step: `pnpm build` (failed in `websmith-api`
  on row 1); added `ignoreDeprecations: "6.0"` to the root tsconfig and `rootDir: "./src"` to each package
  tsconfig as a stand-in for the real fix; `pnpm build` (failed on rows 2 and 3); fixed those as described in the
  table; `pnpm build` green, `pnpm lint` exit 0, `pnpm test` and `pnpm test:e2e` with the failure counts above.
  CLI fixtures run with the built 6.0.3 CLI against `tsc` 6.0.3: a CommonJS project without `esModuleInterop` and
  `rootDir` fails in websmith with TS5011 and TS5107 (`tsc` only TS5011), with and without `-o`; with
  `esModuleInterop: true` and `rootDir`, or with `ignoreDeprecations: "6.0"`, or with `module: nodenext`, websmith
  exits 0; a generator addon from `addonsDir` loaded and ran (row 9). `node -e` on 6.0.3:
  `getDefaultCompilerOptions()` is `{ target: 12, jsx: 1 }` (5.7.3: `{ target: 1, jsx: 1 }`),
  `ts.ScriptTarget[12]` is `"LatestStandard"`, `transpileModule` reports `[5107, 5107, 5107]` for
  `esModuleInterop: false` + `Classic` + `ES5`. The scratch copy was trashed afterwards.
- **Read, not executed:** rows 10, 12, 13 and 14 (code reading on develop); the 5.7.3 baseline of `pnpm test` was
  not rerun (CI on develop is green); the e2e failure attribution to rows 4-8 and 11 is by error code per suite,
  not by tracing every test; whether 6.0 accepts `moduleResolution: bundler` with `module: commonjs` is from
  memory of the 6.0 release notes, to verify in slice 2; npm registry checks for ts-jest 29.4.14 (peer `<7`),
  typescript-eslint 8.71.0 (peer `<6.1.0`), ts-loader 9.6.2, `@typescript/typescript6` 6.0.2.
- Analysis line numbers moved since 2026-09-24: `Classic` is now at `AddonRegistry.ts:602` (was 559), the module
  lookup table in `Compiler.ts` is gone (only `TARGET_MAP` at `:58-73` remains). New hits not in the analysis:
  rows 2, 3, 6, 8, 11, 14 and the 5011 `rootDir` default.
- Slice order: toolchain first (every later slice needs the repo to build on 6.x); product hits next, after #135;
  the node wrapper on its own (different package, independent of #135); peer range, pin and CI matrix last, once
  the 6.x leg can be green; the spike last as one branch per wave, but it touches no product code, so it can be
  moved to the first wave if its result is wanted sooner.
- Deliverable search (`plot-deliverable-search.sh`):
  - `ignoreDeprecations`, `ignoreConfig` — no existing deliverable; only unrelated `ignoreDiagnostics` /
    `skipIgnore` in `packages/api/src/TsConfigOptions.ts:787,812`.
  - `rootDir` — option declarations in `packages/api` and one test (`packages/compiler/src/bin.test.ts:786`); no
    helper to reuse.
  - `typescript matrix`, `5.x || 6.x` — nothing; the only hits are TypeScript version text such as
    `TscArguments.ts:10` "Based on TypeScript 5.7.3" (slice 2 updates it).
  - `transpileModule benchmark`, `perf` — no benchmark of `transpileModule`; the existing
    `packages/webpack-test/perf/esm-watch-bench.cjs` measures ESM watch and is the location precedent for slice 5.
- Rejected inside this plan: `ignoreDeprecations: "6.0"` as the repo fix (it only silences 6.x and fails on 7.0);
  depending on `@typescript/typescript6` instead of `typescript` (it pins one major, and addon authors' `ts.*`
  types come from `typescript`).
