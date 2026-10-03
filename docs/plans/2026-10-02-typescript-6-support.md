<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# Support TypeScript 6 and measure the TypeScript 7.1 API

> Make websmith run on TypeScript 6.x as well as 5.7+ (peer range `>=5.7 <7`) without deprecation errors and
> without changing the addon API, and measure the TypeScript 7.1 nightly API (IPC cost, transformer support) against
> a decision rule fixed in advance, to decide when to revisit a 7.x backend.

## Status

- **State:** Approved
- **Type:** feature
- **Story:** ts7-rearchitecture
- **Review:** pr
- **Impl:** own branches
- **Rounds:** 1
- **Approved:** 2026-10-02, Jan Wloka, plan-PR #144 merged
- **Started:** 2026-10-02, Jan Wloka, `infra/typescript-6-toolchain`
- **Started:** 2026-10-03, Jan Wloka, `infra/typescript-6-ci-leg`
<!-- Transition records — written by the workflow commands, not by hand:
- **Approved:** <date>, <who>, <channel>
- **Started:** <date>, <who>, <branch>   (one line per started branch)
-->

## Changelog

- Added: TypeScript 6 support. `@quatico/websmith-api`, `-core`, `-node`, `-testing`, `websmith-loader` and the CLI
  accept `typescript` `>=5.7 <7`.
- **Breaking:** `@quatico/websmith-compiler` no longer ships its own `typescript` (was a 5.7.3 dependency); it is a
  peer, so the CLI compiles with the project's TypeScript. Add `typescript` to your project. `npx` and global
  installs resolve the peer to the newest match (6.x), so their users move to TypeScript 6 defaults. Without a
  `typescript`, the CLI exits with "websmith needs typescript >=5.7 <7; none was found".
- **Breaking:** the supported range narrows from `5.x` to `>=5.7 <7`; 5.0-5.6 were never tested.
- **Breaking (TypeScript 6 only):** websmith no longer pins `strict: false`; an unset `strict` follows the installed
  TypeScript (off on 5.x as before, on with 6.x, as `tsc` does). Combined with 0.10.0's fail-on-error, a project
  without `strict` in `tsconfig.json` can fail its build on 6.x. Set `"strict": false` to keep the old behaviour.
  The matching `target` / `esModuleInterop` entry is #135's.
- Fixed: on TypeScript 6, websmith no longer fails with deprecation errors (TS5107) for options it sets itself:
  `moduleResolution` `classic`/`node10` when it compiles addons (CLI and webpack loader), and `target: ES5` /
  `node10` in `@quatico/websmith-testing`.
- Fixed: `module: node18` and `node20` (TypeScript 6) emit with package.json awareness in `transpileOnly` and the
  loader, as `node16`/`nodenext` already do.
- Fixed: `@quatico/websmith-node` works with TypeScript 6's `tsc`, which rejects file arguments next to a
  `tsconfig.json` (TS5112), and passes `--target ES2025` by its name.
- Added: the typed compiler options in `@quatico/websmith-api` know `ignoreDeprecations` (`"5.0"` on 5.x, `"6.0"` on
  6.x), target `ES2025` and the module kinds `Node18`, `Node20` and `Preserve`; `--ignoreDeprecations` is accepted on
  the CLI. Values that exist only in 6.x are reported by TypeScript on 5.x, not dropped.
- Addon authors: no API change. `AddonContext` and the `ts.*` types it exposes stay as they are; addons run on the
  TypeScript the project installs, and now the CLI and its addons share that one `typescript`. On 6.x the
  `ts.CompilerOptions` an addon reads carry 6.x defaults (`target` 12, `strict`, `rootDir`), and
  `ts.ScriptTarget[12]` is `"LatestStandard"`.
- TypeScript 7 is not supported: websmith exits with "websmith needs typescript >=5.7 <7; found 7.x" and the README
  says how to keep `typescript@6` for websmith and run 7.x through its own binary.

## Motivation

The `ts7-rearchitecture` story mapped the TypeScript 7 API gap (analysis-ts7-api-gap.md). On 2026-10-02 Jan Wloka
chose **strategy A plus a 7.1 spike**: stay on TypeScript 6.x, keep the addon API unchanged, and measure the 7.1
nightly so that the result decides when to revisit strategies B (dual backend) and D (7.x only). TypeScript 7 is
`latest` on npm (7.0.2), 6.0.3 is the last 6.x; websmith's peer range is `5.x`, so a consumer who moves to 6.x
leaves it behind today.

TypeScript 6.0 has the same JS API as 5.7.3 (analysis 3), but turns deprecated options into errors and changes
defaults. Measured on `origin/develop` at `cfb284cc` with `typescript` overridden to 6.0.3 (Notes, "Probe"); rows
15-17 come from the draft panel (`.plot/panels/2026-10-02-typescript-6-support/`):

| # | What breaks on 6.0.3 | Where (develop) | Measured |
|---|---|---|---|
| 1 | Repo tsconfigs: `moduleResolution: "node"` (TS5107), `downlevelIteration` (TS5101), no `rootDir` next to `outDir` (TS5011, new 6.0 default) | `tsconfig.json:19`, `:48`; `packages/api/tsconfig.json:6`, `packages/core/tsconfig.json:8`, `packages/testing/tsconfig.json:6`; every package `tsconfig.json` with `outDir` | `pnpm build` fails in the first project (`websmith-api`) |
| 2 | The CLI bundle: ts-loader 9.5.2 passes `rootDir: undefined` to `transpileModule`, so every bundled file reports TS5011; with ts-loader 9.6.2 the `rootDir` must also cover `../core/src` (TS6059) | `packages/compiler/webpack.config.js:35-39` | 81 errors; green with ts-loader 9.6.2 plus `compilerOptions.rootDir` = `packages/` |
| 3 | One type error: Node's `StatWatcher` not assignable to memfs's | `packages/testing/src/fusion-fs.ts:182` | TS2740; green with a cast |
| 4 | websmith's own default `esModuleInterop: false` → TS5107 on every project that leaves it unset, Program and `transpileOnly` path alike | `packages/core/src/compiler/defaults.ts:16` | websmith exits 1 where `tsc` 6.0.3 passes; 31 e2e and most unit failures |
| 5 | Default `target` from `ts.getDefaultCompilerOptions()` is `12` (ES2025) on 6.0.3, `1` (ES5) on 5.7.3 | `defaults.ts:10` | 16+ unit assertions expect `target: 1`; default lib becomes `lib.es2025.full.d.ts` |
| 6 | Addon compilation in the webpack loader uses `moduleResolution: Node10` | `packages/webpack/src/WebpackAddonService.ts:297` | TS5107 in the loader suites |
| 7 | Test environment compiles with `target: ES5`, `moduleResolution: Node10` | `packages/testing/src/compilation/environment.ts:394-396` | TS5107; addons silently not loaded (`compilationEnv#addons` gets `[]`) |
| 8 | `@quatico/websmith-node` spawns `tsc <files>` in a directory with a `tsconfig.json`; 5.7.3's `tsc` rejects `--ignoreConfig` (TS5023), 6.0.3's requires it (TS5112) | `packages/node/src/websmith/Compiler.ts:86`; binary from `findTsc()` at `:55` | TS5112 "Use '--ignoreConfig'"; 4 node suites fail. TS5023 executed by the panel |
| 9 | Addon compilation in the CLI uses `moduleResolution: Classic` | `packages/core/src/compiler/addons/AddonRegistry.ts:602` | no failure observed: a generator addon loaded and ran on 6.0.3. Still deprecated, gone in 7.0 |
| 10 | `scriptTargetToString` has no entry for `12`; `ts.ScriptTarget[12]` is `"LatestStandard"`, not `"ES2025"` | `packages/core/src/compiler/config/parsed-command-line.ts:155-174` | read, not reproduced: a `target` of ES2025 would reach `tsc` args as `"12"` |
| 11 | Fixtures and tests use `ModuleResolutionKind.Node10` and `target: ES5` | `Node10`: `packages/compiler-test/tests/compile-tsc.test.ts:16`, `compile-websmith.test.ts:60,100,149,187`; `ES5`: `compile-websmith.test.ts:117,139,167,176,209,230,515`, `compile-tsc.test.ts:60`, `webpack-tsc.test.ts:96,103,113,120` | TS5107 in compiler-test e2e; `ES5` lines read by the panel, TS5107 for ES5 executed |
| 12 | The CLI flag `--outFile` | `packages/compiler/src/command.ts:57` | read: TypeScript reports its own deprecation error; websmith only passes it on |
| 13 | `ts.ImportsNotUsedAsValues` | `packages/node/src/compiler-options.ts:22` | read: still in 6.0.3 typings, builds; removed in 7.0 |
| 14 | ESM check falls back to `target ?? ES5` when `target` is unset; 6.0.3's default target is ES2025, so an unset `module` and `target` emits ESM there. With an explicit `target`, 6.0.3 emits as 5.7.3 does | `packages/core/src/compiler/esm/check-esm.ts:100`, message at `Compiler.ts:802` | executed by the panel (ts6-semantics, finding 2); hidden today because `tsDefaults` spreads `getDefaultCompilerOptions()` |
| 15 | `ModuleKind.Node18` (101) / `Node20` (102) are not treated as node module kinds: `transpileModule` emits them without package.json awareness, no package.json watch | `packages/core/src/compiler/Compiler.ts:933`, `:1395`; check `getImpliedNodeFormat` at `:1482` | executed by the panel on 6.0.3; `module: "node20"` is rejected by 5.7.3's parser |
| 16 | websmith-node renders `target` with `ts.ScriptTarget[value]`, so ES2025 reaches `tsc` as `--target LatestStandard` | `packages/node/src/compiler-options.ts:31-33` | executed by the panel (`ScriptTarget[12]`); #135 does not cover this file |
| 17 | `websmith-loader` imports `typescript` but declares no `typescript` peer (dependencies `api`, `core`, `comment-json`; peer `webpack` only) | `packages/webpack/package.json`; imports in `TsCompiler.ts`, `WebpackAddonService.ts`, `WebpackAddonContext.ts` | read by the panel moderator; resolves through hoisting today |

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
- **Supported range:** peer `typescript` `>=5.7 <7` in every package that imports it (`api`, `core`, `node`,
  `testing`, `example-addons`, `websmith-loader` (row 17) and the CLI, open point 2). The floor is what CI proves
  (open point 4).
- **TypeScript 7 guard by package.json, not `ts.version`.** A 7.x `typescript` has no `main`, so
  `import ts from "typescript"` throws before any `ts.version` read; the CLI bundle keeps `typescript` external
  (`packages/compiler/webpack.config.js:47`) and fails at start-up. Each entry point (CLI `bin`, loader entry,
  websmith-node, `@quatico/websmith-testing`'s environment) first calls one small `checkTypeScript()` that does
  `require.resolve("typescript/package.json")` from its own location and reads `version`, before anything requires
  `typescript`. It reports, then exits (CLI) or throws (library):
  - not found: "websmith needs typescript >=5.7 <7; none was found. Add typescript to your project."
  - out of range: "websmith needs typescript >=5.7 <7; found <version>. For TypeScript 7, keep typescript@6 as the
    project's typescript and run 7.x through its own binary (see README)."
  The check sits in `@quatico/websmith-core` for the CLI, loader and testing (all depend on core) and is duplicated
  in websmith-node, which must not import core. The CLI's import of core must stay lazy behind the check, since
  core imports `typescript` at module load.
- **Pinned dev version: move to 6.0.3, keep 5.7.3 in CI** (open point 1). Analysis:
  - For 6.0.3: the deprecation errors catch any new use of deprecated options at build time in the repo itself,
    not only in a CI leg; 6.x is the line strategy A stays on; the exported API is identical to 5.7.3 (analysis 3:
    533 function names, empty diff), so compiling against 6.0.3 types rarely admits 6-only API, and the 5.7.3 leg
    catches the rest (`libReplacement`, `erasableSyntaxOnly`, `ScriptTarget.ES2025`).
  - For staying on 5.7.3: no toolchain bump (ts-jest 29.2.5 declares `<6`, typescript-eslint 8.22 `<5.8`), and
    the floor users have today is what developers see. Cost: deprecations show up only in the 6.x CI leg.
  - Either way both versions run in CI, so tests must not assert version-dependent defaults (row 5).
  - The pin moves in the last product slice, after the 6.x leg is green.
- **Published artifacts are checked against the other major.** An override leg rebuilds every package with its own
  TypeScript, so no leg type-checks the `.d.ts` files a user installs, which are built by the pin. The peer-range
  slice adds a CI step on the lockfile cells: `pnpm pack` `api`, `core` and `testing`, install them into a consumer
  fixture with the other major (5.7.3 after the pin move) in an isolated directory, and run `tsc --noEmit` on a file
  that imports and uses their exported types.
- **The CLI's own `typescript`** is a `dependency` pinned to 5.7.3 (`packages/compiler/package.json:49`), so CLI
  users get 5.7.3 whatever their project installs, while compiled addons resolve `typescript` from the project
  (README line 69): two instances can coexist today. It becomes a peer `>=5.7 <7` (open point 2) in its own slice,
  with the guard's "not found" message and a Breaking entry. `packages/compiler/README.md:23` already tells users to
  add `typescript`.
- **6.0.3 in CI from the second slice.** The `infra/typescript-6-ci-leg` slice adds the 6.0.3 cell as advisory
  (`continue-on-error: true`) so that every later slice's PR shows its 6.x result in CI; the peer-range slice makes
  it required. Locally, a slice runs 6.0.3 the same way the leg does (below) in a scratch copy.
- **CI matrix:**
  - Cells until the pin moves: TypeScript 5.7.3 on Node 22 and 24 from the lockfile (today's checks), 6.0.3 on
    Node 24 through the override. After the pin moves: 6.0.3 on Node 22 and 24 from the lockfile, 5.7.3 on Node 24
    through the override (open point 8).
  - Job names: the lockfile cells keep `dist (22)` and `dist (24)` (`name:` set explicitly so branch protection is
    untouched); the override cell is `dist (24, typescript <version>)`. The peer-range slice adds it to the required
    checks.
  - Override wiring, override cell only: after checkout, `pnpm pkg set pnpm.overrides.typescript=<version>` on the
    root `package.json`, then `pnpm install --no-frozen-lockfile`; the rewritten lockfile is never committed. The
    whole tree re-resolves, so a red override cell is triaged against the lockfile cells first (toolchain drift is
    not a websmith bug).
  - First step after install, every cell: assert that every workspace package resolves exactly the matrix version
    (`pnpm -r exec node -p "require('typescript/package.json').version"` all equal), so an ignored override cannot
    go green on the wrong version.
  - CI runs pnpm 9 (`pnpm/action-setup@v3`, `version: 9`); the CI-leg slice confirms the override on pnpm 9 in its
    own PR run, not on the local pnpm 10.
- **Deprecation hits, owner per hit.** Overlap with the draft plan `tsc-option-parity` (#135):

  | Hit | Owner |
  |---|---|
  | `esModuleInterop: false` default (row 4) | #135 `bug/tsc-default-target-interop` |
  | `target: ES5` from `getDefaultCompilerOptions()` (row 5) | #135 `bug/tsc-default-target-interop` |
  | `TARGET_MAP` ES3/ES5 rows, `scriptTargetToString` incl. `12` (row 10) | #135 `bug/option-enum-tables` (covers 12/99/100) |
  | ESM check's `target` fallback (row 14) | this plan, own-compilations slice, through #135's `getEffectiveTarget` |
  | `strict: false` default | this plan, own-compilations slice (open point 3) |
  | `Classic` / `Node10` in websmith's own compilations (rows 6, 7, 9) | this plan, own-compilations slice |
  | `Node18` / `Node20` node module kinds (row 15) | this plan, module-kinds slice |
  | Test fixtures with `Node10` / `ES5` (row 11) | this plan, fixtures slice |
  | Repo tsconfigs, `downlevelIteration`, `rootDir`, ts-loader (rows 1-3) | this plan, toolchain slice |
  | `--outFile` CLI flag (row 12) | this plan, module-kinds slice (README note only, open point 6) |
  | websmith-node `tsc` spawn, target names (rows 8, 16) | this plan, node slice |
  | Loader `typescript` peer (row 17) | this plan, peer-range slice |
  | `ImportsNotUsedAsValues` (row 13) | not here: builds on 6.x; a 7.x concern |

  The own-compilations slice waits for #135 `bug/option-enum-tables` (the later of #135's two slices). If #135 is
  not approved when that slice is reached, it takes rows 4, 5 and 10 over, without #135's other changes.
- **Findings carried over from #135's panel** (`ts7-roadmap` juror): `ts.getEmitScriptTarget` and
  `ts.getESModuleInterop` exist at runtime but are not in `typescript.d.ts`, so neither this plan nor #135 calls
  them; the effective-target logic lives in one websmith helper (#135's `getEffectiveTarget`, which falls back to
  `ts.getDefaultCompilerOptions().target`: ES5 on 5.x, ES2025 on 6.x). Row 14's fix is to use it at
  `check-esm.ts:100` instead of `?? ES5`, with no version branch. `ts.ScriptTarget[99]` is `"Latest"`, and on 6.0.3
  `ts.ScriptTarget[12]` is `"LatestStandard"` (measured): reverse enum lookups need explicit entries for 12, 99
  and 100, in core (#135) and in websmith-node (row 16, duplicated deliberately because node must not import core).
- **Replacement for `Classic` / `Node10` (rows 6, 7, 9): omit `moduleResolution`.** Under `module: CommonJS`,
  omission resolves to node10 on 5.7.3 and bundler on 6.0.3 with no diagnostic on either (executed by the panel).
  An explicit `Bundler` is TS5095 on 5.7.3, so omission is the only version-free choice; the CLI's addon compilation
  sets `noResolve: true` anyway. Row 7 also moves `target: ES5` to `ES2020` (as `AddonRegistry.ts:600` uses), which
  changes the testing environment's addon emit on 5.x too; its tests assert behaviour, not ES5 output. The existing
  ESM-addon e2e cases (`fix-ts-addons-esm-projects`) guard the format.
- **`ignoreDeprecations`** is typed `"5.0" | "6.0"` and documented per major (5.7.3 accepts only `"5.0"`; `"6.0"`
  there is TS5103). Neither the repo nor any shared fixture uses it: a value valid on one leg fails on the other, and
  the repo must build clean on 6.x so that it will on 7.x tooling later.
- **Toolchain (toolchain slice):** ts-loader `^9.6.2` (respects `rootDir` in `transpileOnly` mode), ts-jest `^29.4`
  (peer `>=4.3 <7`), typescript-eslint and `@typescript-eslint/*` to a release whose peer range includes 6.0 and
  5.7.3 (8.71.0 declares `<6.1.0`; its floor is checked in the slice and stated in the PR). The dependency-updates
  plan (#133) leaves the lint toolchain out, so no overlap in intent; both touch `pnpm-lock.yaml`, and whichever
  merges second rebases.
- **Repo tsconfigs (toolchain slice):** remove `downlevelIteration` (target is ESNext); root
  `"moduleResolution": "bundler"` (valid with `module: ESNEXT` on 5.7.3 and 6.0.3); in each CommonJS package
  (`api`, `core`, `testing`, `compiler`, `node`, `webpack`) `"moduleResolution": null`, which resets the inherited
  value to the per-major default (node10 on 5.7.3, bundler on 6.0.3, no error on either; executed by the panel; a
  package inheriting `bundler` under CommonJS is TS5095 on 5.7.3); `"rootDir": "./src"` next to every `outDir` (all
  `include` only `src/**`); `rootDir` = `packages/` for ts-loader in the CLI's webpack config. `node16` with
  `module: node16` is rejected because it changes what the packages emit.
- **Tests per slice** (Definition of Done): unit tests in the touched packages (assemble / act / assert, `testObj`,
  `actual`); every product slice that changes CLI, loader or addon-visible behaviour adds e2e cases in
  `packages/compiler-test` or `packages/webpack-test` that fail before the change on the 6.0.3 cell and stay green
  on 5.7.3. Assertions on version-dependent defaults (row 5) compare against `ts.getDefaultCompilerOptions()` or the
  installed major instead of literals.
- **Spike** (bench and measurement slices) writes no product code. It produces a harness, a dated report
  `docs/stories/ts7-rearchitecture/analysis-ts71-measurement.md` and one dated row in the story's Decisions table:
  - Versions: an exact `typescript@7.1.0-dev.*` nightly, pinned and named with its tarball integrity hash in the
    report, installed in an isolated directory outside the workspace (so it never joins the matrix), against
    in-process 5.7.3 and 6.0.3.
  - Workloads (webpack-like): (a) cold start, i.e. spawn plus first `transpileModule`; (b) per-file
    `transpileModule` for 200 and 1,000 modules, one call per module as the loader does in `transpileOnly`;
    (c) one `createProgram` plus `getJavaScriptEmit` per file for the same sets (the type-checked loader path, cold);
    (d) the same on 5.7.3 and 6.0.3 in process; (e) watch rebuild: change one of 1,000 files, update the program
    (`oldProgram` in process, snapshots on 7.1 if the API offers them) and emit the affected file, 30 edits as
    `esm-watch-bench.cjs` does; (f) concurrency: 8 in-flight `transpileModule` calls over one IPC channel versus
    sequential. A workload the 7.1 API cannot express is recorded as "not measurable" and counts as not met.
  - IPC: the client's default encoding (MessagePack or JSON-RPC) is named, source text is sent per call (as the
    loader holds it), and payload bytes per file are reported.
  - Runs: 5 per variant, variants interleaved (as `esm-watch-bench.cjs` does), warm and cold reported separately,
    median with min/max (no means); same corpus, Node and machine, all recorded.
  - Corpus: the `webpack-test` fixtures plus a generated corpus from a committed generator with a fixed seed, module
    sizes drawn from websmith's own `packages/*/src` line-count histogram, the `esm-watch-bench` import-tree shape,
    and about 10% of modules touched by a transformer addon.
  - Transformer probe: a 10-line script calls the nightly's `transpileModule` with a `before` transformer and
    records the type error or runtime behaviour, next to the status of roadmap item 3C
    (microsoft/TypeScript#63875: phase, typings) and ts-loader's migration (TypeStrong/ts-loader#1704).
  - **Decision rule, fixed before the run** (open point 9). Speed is met when all hold for 1,000 modules: 7.1
    median per-file `transpileModule` (b) at most 1.5x 6.0.3 in process; workload (c) at most 2x; workload (e)
    median per edit at most 2x; 7.1 p95 at most 3x its own median in (b) and (c); throughput with 8 in flight (f)
    at least 1/1.5 of in-process 6.0.3. Cold start (a) above 1 s is reported as cost times the loader instances of
    a multi-profile build and counts against speed only if that exceeds 2 s. 3C is met only when shipped in a
    released 7.x (not a nightly) with a documented phase that accepts `before`-style transformers
    (`Compiler.ts:1089` passes `before` transformers to `transpileModule`).

    | Speed | 3C | Decisions row |
    |---|---|---|
    | met | met | reopen B: a new plan for a dual backend, D assessed in it |
    | met | not met | stay on A; re-run the harness at the next 7.x minor |
    | not met | any | stay on A; record "IPC cost blocks per-file emit"; re-run only when the 7.x API adds in-process or batched emit |

    The measurement slice is done when one of these rows is recorded, not when the report exists.

### Open Points

- [x] **1. Pinned dev version** — decided: move to 6.0.3 in the peer-range slice, keep 5.7.3 as the override cell,
      pending approval. 6.x is the line strategy A stays on and its deprecation errors then guard the repo at
      build time; the 6.0.3 cell has been green from the CI-leg slice on, so the move is a swap, and the packed
      artifact check covers 5.7.3 consumers.
- [x] **2. The CLI's `typescript`** — decided: peer `>=5.7 <7` in its own slice (`feature/cli-typescript-peer`)
      with the guard's "not found" message, a Breaking entry and an e2e on a project without `typescript`, pending
      approval. One `typescript` for CLI and addons removes today's two-instance hazard; a dependency on 6.0.x
      would force 6.0 defaults on 5.x projects, and keeping 5.7.3 leaves CLI users off TypeScript 6.
- [x] **3. `strict: false` default** (`defaults.ts:20`) — decided: drop the pin, pending approval. No change on
      5.x, matches `tsc` on 6.x (the product promise); the Breaking entry names the 0.10.0 fail-on-error
      combination and the one-line opt-out.
- [x] **4. Lower bound** — decided: `>=5.7 <7`, pending approval. It is what CI proves; `Node18`/`Node20`/`ES2025`
      are 6.0-only and 5.0-5.6 were never tested. The narrowing is a Breaking entry.
- [x] **5. Additive API types** — decided: yes, new optional members (`ignoreDeprecations: "5.0" | "6.0"`,
      `ES2025`, `Node18`, `Node20`, `Preserve`) count as "addon API unchanged", pending approval. Nothing existing
      changes; the release notes list the new values, since exhaustive `switch`/`Record` code downstream can see
      them; `packages/api` still compiles on the 5.7.3 cell, and a 6-only value on 5.x is reported by TypeScript's
      own option parser (asserted in an e2e).
- [x] **6. `--outFile`** — decided: keep the flag and note in the CLI README that TypeScript 6 deprecates it,
      pending approval. It works on 5.x and TypeScript reports its own error on 6.x; removing it is a 7.x concern.
- [x] **7. Dependency on #135** — decided: the own-compilations slice `waits:` on #135 `bug/option-enum-tables`
      (which already lists 12/99/100 for core), pending approval. #135 does not cover
      `packages/node/src/compiler-options.ts`, so the node slice owns that table (row 16). If #135 is not approved
      by then, the own-compilations slice takes rows 4, 5 and 10 over.
- [x] **8. CI cost** — decided: 3 jobs, the lockfile version on Node 22 and 24, the other version on Node 24
      through the override, pending approval. It keeps today's two required check names, covers the released
      "5.x on Node 24" cell until the pin moves, and adds one job instead of two; a fourth cell is added only if a
      failure shows a Node-dependent TypeScript difference.
- [x] **9. Spike threshold** — decided: the decision rule under Approach (1.5x / 2x / 2x / p95 3x / concurrency /
      cold start; 3C only in a released 7.x), pending approval. Fixed before the run so the recommendation cannot
      be fitted to the numbers; the owner may adjust the numbers before approval, not after the run.
- [x] **10. Users on TypeScript 7** — decided: the package.json guard plus README guidance (keep `typescript@6`
      as the project's `typescript`, run 7.x via its own binary), no `@typescript/typescript6` fallback, pending
      approval. Aliasing every `import ts from "typescript"` would give addons `ts.*` types from a different
      `typescript` than the project's, the reason a `typescript6` dependency is already rejected (Notes).
- [x] **11. Release and Breaking entries** — decided: the next minor (0.11.0) carries them, each as a
      `**Breaking:**` item under `### Changed` in `Release-Notes.md` as 0.10.0 did; #135 writes the
      `target`/`esModuleInterop` entry and this plan's `strict` entry points to it, pending approval. One story for
      "defaults follow `tsc`", and the format users already know.

## Slices

### Toolchain

- `infra/typescript-6-toolchain` — repo tsconfigs valid on 5.7.3 and 6.0.3 (no `downlevelIteration`, root `moduleResolution: "bundler"`, `"moduleResolution": null` and `"rootDir": "./src"` in every CommonJS package), ts-loader `^9.6.2` with `rootDir` = `packages/` for the CLI bundle, the `fusion-fs.ts:182` typing, ts-jest and typescript-eslint releases whose peers include 5.7.3 and 6.0; no `ignoreDeprecations`. Test: Definition of Done green on 5.7.3; `pnpm build` and `pnpm lint` green on 6.0.3 through the override in a scratch copy (red before: TS5107 in `websmith-api`), commands and output in the PR → #166 <!-- builds: TypeScript-6-clean repo tsconfigs and toolchain -->

### CI leg

- `infra/typescript-6-ci-leg` — `pull-request.yml` matrix with the 6.0.3 override cell on Node 24 (`continue-on-error: true`), `pnpm pkg set pnpm.overrides.typescript` plus `pnpm install --no-frozen-lockfile` in that cell only, the installed-version assertion as the first step after install in every cell, explicit job names keeping `dist (22)` / `dist (24)`; #133's workflow changes checked first. Test: the PR's own run shows three cells on pnpm 9, the assertion step reports 5.7.3 / 5.7.3 / 6.0.3, and a deliberately wrong override value in a throwaway commit fails the assertion (then reverted); Definition of Done green on the 5.7.3 cells → #171 <!-- builds: advisory TypeScript 6.0.3 cell in pull-request.yml -->

### Fixtures

- `bug/typescript-6-test-fixtures` — compiler-test and webpack-test fixtures and test options off `Node10` and `target: ES5` (row 11): `ES2020` and an omitted `moduleResolution`, expected output regenerated from `tsc` of the running major; cases whose subject is ES5 downlevel output run on 5.x only (skipped by installed major, named in the test title); one e2e that asserts websmith's output paths equal `tsc`'s for a project with `src/`, `outDir` and no `rootDir`. Test: Definition of Done green on the 5.7.3 cells; on the 6.0.3 cell no TS5107 for `target`/`moduleResolution` comes from these suites (red before) <!-- builds: version-neutral e2e fixtures -->

### websmith-node

- `bug/node-tsc-ignore-config` — `@quatico/websmith-node` reads the version of the `tsc` that `findTsc()` returns (its `package.json`) and passes `--ignoreConfig` only to a 6.x binary with file arguments (`websmith/Compiler.ts:86`); its target names get an explicit `12` → `ES2025` (and 99 → `ESNext`) entry instead of `ts.ScriptTarget[value]` (`compiler-options.ts:31-33`). Unit tests: argument list for 5.x and 6.x binaries, the mixed cases (6.x imported with a 5.x binary and the reverse), every target value incl. 12/99. Test: e2e node suites' single-file compile green on both cells (red before on 6.0.3: TS5112) <!-- builds: spawned-tsc version check and target names in websmith-node -->

### 7.1 bench

- `infra/typescript-7-1-bench` — benchmark harness beside `packages/webpack-test/perf/esm-watch-bench.cjs`, in no suite: workloads (a)-(f), interleaved runs, the seeded corpus generator, the pinned nightly with integrity hash in an isolated directory, IPC encoding and payload bytes, the `before`-transformer probe script. Test: a dry run with 20 modules and 1 run per variant completes on 5.7.3, 6.0.3 and the nightly and prints every metric the decision rule needs; `pnpm lint` and the Definition of Done green (no product code) <!-- builds: ts71 IPC benchmark harness -->

### 7.1 measurement

- `docs/typescript-7-1-measurement` — the full run and `docs/stories/ts7-rearchitecture/analysis-ts71-measurement.md`: per workload the 7.1 / 6.0.3 ratio with min/max, machine, Node, nightly version and hash, the harness commit, the transformer probe result, 3C and ts-loader#1704 status on the run date; the story's two open questions (3C phase, IPC cost) updated in place, and one dated Decisions row chosen by the decision rule. Test: the report cites the bench commit and every threshold of the rule with its measured value; Definition of Done green <!-- builds: ts71 measurement report and Decisions row -->

### Own compilations

- `bug/typescript-6-own-compilations` — after #135: no `moduleResolution` in websmith's own addon compilations (`AddonRegistry.ts:602`, `WebpackAddonService.ts:297`, `environment.ts:394-396`, the last also off `target: ES5`), `strict: false` pin dropped (open point 3), `check-esm.ts:100` and `Compiler.ts:802` fall back through #135's `getEffectiveTarget`; Breaking entry for `strict` in `Release-Notes.md`. Unit tests for each site and for `getEmittedModuleKind` with unset and explicit `target`. Test: e2e in compiler-test and webpack-test: an addon project compiles on 6.0.3 without TS5107 and unchanged on 5.7.3; an addon that calls `ts.factory` in a `before` transformer runs and changes the output on both cells through the CLI and the loader; a project without `strict` follows the installed TypeScript <!-- builds: addon compilations without moduleResolution, effective-target ESM fallback --> <!-- waits: bug/option-enum-tables -->

### Module kinds and option types

- `feature/typescript-6-module-kinds` — `Compiler.ts:933` and `:1395` treat `ModuleKind.Node18` / `Node20` as node module kinds when the installed `ts.ModuleKind` has them, `getImpliedNodeFormat` (`:1482`) checked alike; `ignoreDeprecations: "5.0" | "6.0"`, `ES2025`, `Node18`, `Node20`, `Preserve` in `TsConfigOptions` / `TscArguments` / `CompilerArguments` and `--ignoreDeprecations` on the CLI; `TscArguments.ts:10` version text; README for the new values and the `--outFile` deprecation note; Release-Notes entries. Unit tests for the module-kind checks with each kind and an absent enum member. Test: e2e in webpack-test: a `module: node20` project in `transpileOnly` emits per package.json `type` and rebuilds on a package.json change on the 6.0.3 cell (red before); e2e in compiler-test: `module: node20` on 5.7.3 fails with TypeScript's own option error, not silently <!-- builds: Node18/Node20 node module kinds and api option types -->

### CLI peer

- `feature/cli-typescript-peer` — `checkTypeScript()` in core (and its copy in websmith-node) resolving `typescript/package.json` before the first `require("typescript")` at the CLI `bin`, the loader entry, websmith-node and the testing environment, with the "none was found" and "found <version>" messages; the CLI's `typescript` from `dependencies` to `peerDependencies` `>=5.7 <7` with core loaded lazily behind the check; Breaking entry and `packages/compiler/README.md` install text. Unit tests: resolvable 5.x and 6.x, not resolvable, 7.x present, malformed version. Test: e2e in compiler-test: the packed CLI installed into a project without `typescript` exits 1 with the "none was found" message, and with a stubbed 7.x `typescript` (no `main`) exits 1 with the "found 7" message; both red before <!-- builds: package.json-based TypeScript guard, CLI typescript peer -->

### Peer range

- `feature/typescript-6-peer-range` — peers `>=5.7 <7` in `api`, `core`, `node`, `testing`, `example-addons` and `websmith-loader` (new); dev pin 6.0.3 in every manifest and the lockfile; matrix flipped to 6.0.3 on Node 22 and 24 from the lockfile plus 5.7.3 on Node 24 through the override, `continue-on-error` removed and the override cell added to the required checks; the packed-artifact step (pack `api`, `core`, `testing` built on 6.0.3, `tsc --noEmit` a consumer fixture with 5.7.3 in an isolated directory); README and `packages/*/README.md` supported-versions text with the TypeScript 7 guidance; Breaking entry for the narrowed range. Test: Definition of Done green on all three cells; the packed-artifact step passes and fails on a deliberately 6-only type in a throwaway commit (reverted); e2e: a webpack-test project with pnpm strict resolution (no hoisting) loads `typescript` through the loader's own peer <!-- builds: lockfile pin 6.0.3, required TypeScript matrix, packed-artifact type check -->

## Notes

- Created 2026-10-02 from the `ts7-rearchitecture` story after the strategy decision (A + 7.1 spike, Jan Wloka).
  The story's "Candidate slice independent of the strategy" is split between this plan and #135 (table under
  Approach).
- **Amended after the draft panel (2026-10-02).** Three jurors (addon authors and downstream, CI and spike, TS 5.7
  to 6.0 semantics) were unanimous `amend`; moderation in `.plot/panels/2026-10-02-typescript-6-support/panel.md`.
  Applied: the TypeScript 7 guard reads `typescript/package.json` instead of `ts.version`; the CLI peer is its own
  slice with a Breaking entry; the 6.0.3 CI cell lands second, advisory, with a specified override and a version
  assertion; slice 1's `moduleResolution` fix keeps 5.7.3 working (root `bundler`, `null` per CommonJS package);
  row 14 corrected; rows 15-17 added (`Node18`/`Node20`, websmith-node's target names, the loader's missing peer);
  `target: ES5` fixtures named in row 11; `--ignoreConfig` keyed on the spawned `tsc`; `ignoreDeprecations` typed
  per major; the own-options slice split into fixtures, own compilations and module kinds; an addon `ts.*` e2e;
  the spike split into bench and measurement with workloads (e)/(f) and a decision rule fixed in advance; a
  packed-artifact check against the other major; every open point decided, pending approval. The strategy is
  unchanged.
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
- **Read, not executed:** rows 10, 12, 13 and 17 (code reading on develop); the 5.7.3 baseline of `pnpm test` was
  not rerun (CI on develop is green); the e2e failure attribution to rows 4-8 and 11 is by error code per suite,
  not by tracing every test; npm registry checks for ts-jest 29.4.14 (peer `<7`), typescript-eslint 8.71.0 (peer
  `<6.1.0`), ts-loader 9.6.2, `@typescript/typescript6` 6.0.2. Executed by the panel's ts6-semantics juror (5.7.3
  and 6.0.3 side by side, not the repo): rows 14-16, the `moduleResolution` omission and `null` reset, `bundler`
  with CommonJS (valid on 6.0.3, TS5095 on 5.7.3), `--ignoreConfig` (TS5023 on 5.7.3), `ignoreDeprecations`
  (`"6.0"` is TS5103 on 5.7.3).
- Two 6.0 defaults need no websmith change: `types` defaults to `[]` (a project relying on ambient `@types/*` gets
  what `tsc` 6 gives; the testing environment sets `types: ["node"]` at `environment.ts:398`), and the default lib
  `lib.es2025.full.d.ts` is resolved from the installed `typescript` through `ts.getDefaultLibFilePath`
  (`shared-host.ts:13-14`).
- Analysis line numbers moved since 2026-09-24: `Classic` is now at `AddonRegistry.ts:602` (was 559), the module
  lookup table in `Compiler.ts` is gone (only `TARGET_MAP` at `:58-73` remains). New hits not in the analysis:
  rows 2, 3, 6, 8, 11, 14-17 and the 5011 `rootDir` default.
- Slice order: toolchain first (every later slice needs the repo to build on 6.x); the advisory 6.0.3 cell second,
  so every later PR shows its 6.x result in CI; fixtures and websmith-node next (independent of #135, they remove
  most of the 6.x cell's noise); the spike before the #135-gated slice, so a late #135 cannot stall the measurement,
  and before the CLI peer and guard whose TypeScript 7 guidance it informs; own compilations after #135; module
  kinds; the CLI peer; peer range, pin and required matrix last.
- Cross-plan: #135 `tsc-option-parity` owns the `esModuleInterop` / `target` defaults and the core target tables
  (the own-compilations slice `waits:` on its `bug/option-enum-tables`); #133 `dependency-updates`'
  `infra/dependabot-config` ignores `typescript` majors, so Dependabot never proposes the pin move this plan makes
  by hand, and its nx and transitive slices may touch `pull-request.yml` and the lockfile: whichever lands second
  rebases.
- Deliverable search (`plot-deliverable-search.sh`):
  - `ignoreDeprecations`, `ignoreConfig` — no existing deliverable; only unrelated `ignoreDiagnostics` /
    `skipIgnore` in `packages/api/src/TsConfigOptions.ts:787,812`.
  - `rootDir` — option declarations in `packages/api` and one test (`packages/compiler/src/bin.test.ts:786`); no
    helper to reuse.
  - `typescript matrix`, `5.x || 6.x` — nothing; the only hits are TypeScript version text such as
    `TscArguments.ts:10` "Based on TypeScript 5.7.3" (the module-kinds slice updates it).
  - `transpileModule benchmark`, `perf` — no benchmark of `transpileModule`; the existing
    `packages/webpack-test/perf/esm-watch-bench.cjs` measures ESM watch and is the location precedent for the bench.
- Rejected inside this plan: `ignoreDeprecations: "6.0"` as the repo fix (it only silences 6.x and fails on 7.0);
  depending on `@typescript/typescript6` instead of `typescript` (it pins one major, and addon authors' `ts.*`
  types come from `typescript`); a version guard on `ts.version` (unreachable for 7.x, which has no `main`);
  `node16` + `module: node16` for the repo packages (changes their emit); an explicit per-major `Bundler` for
  websmith's own compilations (omission gives the same result without a branch).
