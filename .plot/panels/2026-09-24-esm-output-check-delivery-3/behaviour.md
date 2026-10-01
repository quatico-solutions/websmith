<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# behaviour

Plan: `docs/plans/2026-09-24-esm-output-check.md`, round 3. Subject: scratch merge `7c94fea` (develop + PR #130 + PR #131).

## Setup

- Disk check: 30 GiB free on `/System/Volumes/Data`.
- I made a fresh copy with `git archive 7c94fea | tar -x` into `scratchpad/p3-behaviour/repo`. The worktree `.worktrees/panel-3` was not touched.
- I ran `pnpm install --frozen-lockfile --offline`. Env: pnpm 10.34.1, Node 22.17.0, `NX_DAEMON=false`.
- I built `api`, `core`, `websmith-loader` and `@quatico/websmith-compiler` with nx.
- Fixtures are in `scratchpad/p3-behaviour/fx/`. The scenario scripts are `loaders.sh`, `watch.sh`, `loader2.sh`, `cli.sh` and `cli2.sh`.
- The CLI ran as `node repo/packages/compiler/bin/bin.js`, with `-c <abs>/websmith.config.json -p <abs>/tsconfig.json`.
- The loader ran through webpack-cli 6 / webpack 5.97.1 from `packages/webpack-test`. The loader was `repo/packages/webpack/lib/index.js`, with `transpileOnly: true` unless stated. thread-loader was 4.0.4 from `packages/webpack-test`.
- Every watch process I started was killed. `pgrep` found none afterwards.
- I trashed the copy's `node_modules` at the end.

## Evidence (executed)

### Loader: configuration errors (PR #131)

| # | Check | Result | Output (abridged) |
|---|-------|--------|-------------------|
| L-1 | Loader, selected profile `broken` (`depends: ["nope"]`, `esm.runtime: "x"`), plain | supported | `ERROR in Unknown profile 'nope' in 'depends' of '…/websmith.config.json'.` once; `ERROR in Unknown 'esm.runtime' value 'x' in profile 'broken' …` once; `compiled with 2 errors`, EXIT=1. This was the round-2 refutation (printed 2–5 times, exit 0). |
| L-2 | Loader, profile `commonjs` (`esm` plus `tsConfig.module: CommonJS`) | supported | `ERROR in Profile 'commonjs' of '…' sets 'esm', but its 'tsConfig.module' is 'CommonJS'. Use an E…` once; `compiled with 1 error`, EXIT=1 |
| L-3 | Loader, valid profile `valid` while `broken` and `commonjs` exist in the file | supported | no config error; `compiled successfully`, EXIT=0 |
| L-3b | Loader, valid `esm` profile next to broken ones | supported | `compiled successfully`, EXIT=0 |
| L-4 | thread-loader 4.0.4, `broken` | supported | Per module, as #131 claims: 3 modules × 2 errors = `compiled with 6 errors`, EXIT=1. Each is `ERROR in ./src/<m>.ts  Module Error (from …thread-loader/dist/cjs.js): Unknown …`. |
| L-5 | thread-loader, `valid` | supported | `compiled successfully`, EXIT=0 |
| L-6 | Loader watch, start with `broken`, then change only `websmith.config.json` | supported | Phase 1: 2 errors, `compiled with 2 errors`. After the fixed config was written (no source edit): `compiled successfully in 20 ms`. After the broken config was written again: the same 2 errors once, `compiled with 2 errors in 17 ms`. |
| L-7 | Loader, profile `ondep` with `depends: ["commonjs"]` | supported | `commonjs`'s error printed once, `compiled with 1 error`, EXIT=1 |
| L-8 | Loader, `transpileOnly: false`, `broken` | supported | the same 2 errors once each, EXIT=1 |
| L-9 | Loader, two rules (`index.ts` and `[ab].ts`) with the same config, `broken` | supported | 2 errors once each, `compiled with 2 errors` (not doubled), EXIT=1 |
| L-10 | Loader, `configFile` that does not exist, profile `valid` | supported | `ERROR in ./src/index.ts` plus `ERROR in No configuration file found at "l-nocfg/nonexistent.json".`, EXIT=1 |
| L-11 | Loader, profile name that is not configured | supported | `ERROR in ./src/index.ts  Module build failed … Error: No profile with name "nosuch" configured.`, EXIT=1. This is an error with a stack trace, not the clean config-error format. |
| L-12 | Repo's own `webpack-profile-config.test.ts` and `webpack-esm-check.test.ts` with jest | supported | 2 suites, 16 tests, all pass |

### CLI: declaration and syntax errors, option errors (PR #130)

| # | Check | Result | Output (abridged) |
|---|-------|--------|-------------------|
| C-1 | `declaration: true`, one file with a TS4094 class expression and `export const d = ;`, no `noEmitOnError` | supported | `index.ts (2,18): Expression expected.` and `index.ts (1,14): Property 'x' of exported anonymous class type may not be private or protected.`, each once, EXIT=1 |
| C-2 | The same with `noEmitOnError: true` | supported | only `(2,18): Expression expected.`, EXIT=1, no `dist` |
| C-3 | TS4094 only (baseline) | supported | one TS4094 line, EXIT=1 |
| C-4 | The C-1 fixture with `--transpileOnly` | supported | only the syntax error, EXIT=1. TS4094 is not reported in transpile-only mode, which is outside what #130 claims. |
| C-5 | `isolatedDeclarations: true` (TS9010) plus a syntax error | supported | `(2,18): Expression expected.`, then `(1,14)` and `(2,14): Variable must have an explicit type annotation with --isolatedDeclarations.`, each once, EXIT=1 |
| C-6 | The same with `noEmitOnError` | supported | only the syntax error, EXIT=1 |
| C-7 | TS5070 option error (`resolveJsonModule` with `moduleResolution: classic`), 3 files | supported | `Error: 5070: Option '--resolveJsonModule' cannot be specified when 'moduleResolution' is set to 'classic'.` once, EXIT=1. This held with `-c`, without `-c`, and with `--transpileOnly`. |
| C-8 | The same under `--watch` with 3 files, then edits to `a.ts` and `b.ts` | supported | one TS5070 line in the whole log across startup and both edits |
| C-9 | `--profile good` | supported | no output, EXIT=0 |
| C-10 | `--profile baddep` | supported | `Unknown profile 'nope' in 'depends' of '…'.` once; no `Custom profile configuration … found, but no profile provided` warning; EXIT=1 |
| C-11 | `--profile unknown` | supported | `[WARN] Missing profile: The following profile is passed but not configured "unknown".`, EXIT=0; no misleading warning |
| C-12 | `--profile bad` | supported | one `Profile 'bad' … sets 'esm', but its 'tsConfig.module' is 'CommonJS'` error, EXIT=1 |
| C-13 | `--profile ondep` (depends on `bad`) | supported | `bad`'s error once, EXIT=1 |
| C-14 | No `--profile` | supported | no output, EXIT=0 |

### Round-2 regressions

| # | Check | Result | Output (abridged) |
|---|-------|--------|-------------------|
| R-1 | CLI ESM91001 names the source | supported | `dist/index.js (1,19): ESM91001: "require" is not defined in ES module output; … (source "src/index.ts", profile "client").`, EXIT=1 |
| R-2 | `check: "warn"` | supported | `[WARN] … ESM91001 … (profile "warn")`, EXIT=0 |
| R-3 | Loader ESM91001 names the source | supported | `l-esm/dist/b.js (1,18): ESM91001: … (source "src/b.ts", profile "validesm").` with `ERROR in ./src/b.ts`. In the same build, ESM91010 errors and ESM91005 warnings were reported and EXIT=1. |
| R-4 | Fast-path syntax error | supported | `src/index.ts (1,18): Expression expected.`, EXIT=1 |
| R-5 | CLI `--watch` | supported | ESM91001 on start, then clean after the fix, then ESM91001 again after re-adding `require`; the watcher stayed alive until I killed it |

## Evidence (read only)

| Check | Result | Note |
|-------|--------|------|
| `gh pr view 130` and `131` | read | These gave me the claims I tested. |
| `packages/webpack/README.md` lines 85–95 | read | They describe config errors failing loader builds, once per compilation, the thread-loader per-module behaviour, and the persistent-cache limit. This matches what I observed. |
| README `packages/compiler/README.md` | read | `grep` finds no "not checked yet" text in any README. |
| Persistent-cache limit of #131 | read | Not executed. |

## Findings

- **The round-2 refutation is fixed.** In the loader, a selected profile's config errors (`depends` unknown, `esm.runtime` unknown, `esm` with CommonJS, missing `configFile`) now print once each, fail the build and exit 1. They are not doubled with several loader rules. A valid profile next to broken ones builds clean. thread-loader reports per module (6 errors for 3 modules), as #131 states. Watch re-reports the config errors when only `websmith.config.json` changes (error, clean, error), and a rebuild of an unchanged config is clean.
- **#130 holds in the CLI.** The syntax error prints next to TS4094 and TS9010, once each; under `noEmitOnError` only the syntax error prints. TS5070 prints once with 3 files, and once for a whole `--watch` session across edits. `--profile` no longer gives the misleading warning, and the messages for unknown profiles and `depends` entries are correct.
- **Observed, not counted against the plan:**
  - `--profile good` without `-c` gives `Missing profile`. This is expected, because the CLI loads the config only with `-c`.
  - A relative `-p .` with `-c websmith.config.json` ended silently with EXIT=0 and no output in my first attempt. Absolute paths worked. I did not investigate whether this predates the plan.
  - L-11: an unconfigured profile name in the loader gives a raw `Module build failed … No profile with name "nosuch" configured.` with a stack trace. It does fail the build.
  - Under `--transpileOnly`, TS4094 is not reported.
- **Limits stated by #131 that I did not execute:** persistent-cache rebuilds; stale modules after a config-only watch edit.
- **No regressions** in the round-2 behaviours I sampled.

Position: supported
Evidence: executed

## Executed vs read

- **Executed:** every row in the three executed tables, against a fresh copy of `7c94fea`. That includes the 16 jest tests of two `webpack-test` suites.
- **Not executed:** `pnpm lint`, the full `pnpm test`, `pnpm build` and `pnpm test:e2e`; `perf:esm`; persistent-cache builds.
- **Read:** the two PR bodies, the round-2 `behaviour.md`, `packages/webpack/README.md`, and `bin.test.ts` for how the existing e2e invokes the CLI.
