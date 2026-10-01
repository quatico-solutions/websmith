<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# deliverable

Round 3, deliverable lens. Subject: `docs/plans/2026-09-24-esm-output-check.md`, Wave 5 slices #130 and #131 on the scratch merge `7c94fea`.

## Setup

- Own copy: `git archive 7c94fea` extracted to `.../scratchpad/p3-deliverable`. The worktree `.worktrees/panel-3` was not touched. Free disk was 30 GiB.
- Environment: node 22.17.0, pnpm 10, `NX_DAEMON=false`.
- Read: the round 2 `panel.md` verdict, the plan's Wave 5 bullets, `gh pr diff 130` and `gh pr diff 131`.
- The copy's `node_modules` was moved to the Trash afterwards.

## Evidence

### Executed

- `pnpm install --frozen-lockfile --offline`, `pnpm build`, `pnpm lint`, `pnpm test` and `pnpm test:e2e` ran in sequence. The whole chain exited 0.
  - Build: 9 projects.
  - Lint: 9 projects.
  - Unit tests: 6 projects. Suite counts per project were 2, 1, 11, 8, 19 and 5, all passed.
  - E2E: 6 projects. Suite counts were 1, 2, 6, 3, 7 and 1, all passed.
- The e2e run included the new cases from both PRs, all passing:
  - `webpack-profile-config.test.ts`: the broken profile exits 1 with each config error once; the commonjs profile fails once; the thread-loader case reports once per module.
  - `websmith-loader.test.ts`: "should fail with syntax error and declaration emit error once each w/ declaration and per-file Program".
  - `bin.test.ts`: the declaration and isolatedDeclarations cases, the option error once with several files, and no "no profile provided" warning.
- Probes with the built CLI (`packages/compiler/bin/bin.js`) on small fixtures:
  - A, per-file declaration path with `export const a = class { private x = 1; }; export const b = ;`: printed both "(2,18) Expression expected." and "(1,14) Property 'x' of exported anonymous class type may not be private or protected.", once each, and exited 1.
  - B, three files with `resolveJsonModule` and `moduleResolution: classic`: the option error printed 1 time. Round 2 saw 3.
  - C, `--profile valid`, `--profile broken` (depends on `missing`) and `--profile unknown`: zero "no profile provided" warnings. `broken` got the accurate "Unknown profile 'missing' in 'depends'" error. `unknown` got "Missing profile: ... passed but not configured".

### Read only

- The #130 hunks in `Compiler.ts`:
  - `emitSourceFile` merges syntactic diagnostics with emit diagnostics, deduplicated by key.
  - `reportedWatchDiagnostics` and the changed `getDiagnosticKey` dedupe diagnostics that have no file but a code above 0.
  - `command.ts` drops `hasInvalidProfile` and its warning.
- The #130 README hunks. `packages/webpack/README.md` line 79 now reads "under `transpileOnly: true` and `false`, also on the fast…". `packages/compiler/README.md` now links to the loader's ESM check section. A grep for "not checked yet" in the READMEs finds nothing, and `hasInvalidProfile` no longer occurs in the sources.
- The #131 hunks:
  - `ConfigErrorReporter` and `getConfigErrors` in `TsCompiler.ts`.
  - The `afterCompile` hook in `webpack-hooks.ts`, which pushes each error once per compilation to `compilation.errors` and calls the `error` option. It also tracks the config file as a dependency, or as a missing dependency if absent.
  - A `watchRun` re-resolve when the config file changes.
  - A loader fallback that emits per module when no compilation hooks exist.
- The `Release-Notes.md` entries for both PRs.
- Watch mode behaviours (the declaration plus syntax error once each, the option error once across a rebuild) were exercised only by the unit tests inside `pnpm test`. I ran no separate watch probe.
- I did not run a separate webpack probe with a broken profile. The e2e test above covers it.

## Findings

### Wave 5 deliverables, #130 (`bug/declaration-emit-hides-syntax-errors`)

- SUPPORTED: a syntax error is reported next to a declaration emit error on the per-file declaration path. Evidence: `Compiler.ts` `emitSourceFile` hunk; CLI probe A (executed); the bin, loader and Compiler.spec tests passed. Watch mode is covered by a unit test.
- SUPPORTED: a TypeScript option error prints once, not once per file. Evidence: the `getDiagnosticKey` change and the `reportedWatchDiagnostics` set; CLI probe B printed it 1 time (executed); the Compiler.spec, bin and watch tests passed.
- SUPPORTED: `--profile` no longer warns "no profile provided". Evidence: the `command.ts` removal; probe C with three profile cases printed none (executed).
- SUPPORTED: `packages/webpack/README.md` names the fast path and `transpileOnly: true`. Evidence: line 79 (read).
- SUPPORTED: `packages/compiler/README.md` no longer says the loader is not checked. Evidence: the hunk and a grep (read).

### Wave 5 deliverable, #131 (`bug/loader-config-errors-fail-build`)

- SUPPORTED: the loader reports selected-profile config errors once through `this.emitError`, so the build fails. Evidence: the webpack-profile-config e2e passed (executed). With a broken selected profile, exit code is 1, and each of the unknown-profile and unknown-runtime errors appears once.
- Caveat, stated in the plan, the Release Notes and the README: with compiler hooks the errors go through the compilation's `errors` list and the `error` option, not through `this.emitError`. Only the no-hooks fallback uses `emitError`. The plan bullet's "through `this.emitError`" is therefore met only loosely. The outcome it names, a failing build with each error reported once, holds. I treat this as wording, not a gap.

### Round 2 findings

- SUPPORTED: loader config errors printed 2 to 5 times and did not fail the build. Now once, with exit code 1 (executed, e2e).
- SUPPORTED: a syntax error was hidden by a declaration emit error. Now both are shown, with exit code 1 (executed, probe A and e2e).
- SUPPORTED: `packages/webpack/README.md` named only `transpileOnly: false` (read).
- SUPPORTED: `packages/compiler/README.md` said the loader is not checked (read).
- SUPPORTED: the TS5070 option error printed once per emitted file. Now once (executed, probe B).
- SUPPORTED: the misleading profile warning (executed, probe C).

### Regression check

- No regressions. All four Definition of Done targets pass on `7c94fea` (executed), including the e2e suites for the earlier Wave 5 items: source file in diagnostics, fast-path syntax errors, and stable watch.

### Residual observations (not refutations)

- Behaviour under a persistent webpack cache and under thread-loader is documented as a limitation, and the thread-loader case is tested.
- I found nothing in the plan's Wave 5 text that is absent from the code that will land.

Position: supported
Evidence: executed
