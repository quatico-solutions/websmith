<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — loader-options-once (Benchmark: esm-bench-watchdog)

- **Plan (canonical):** `docs/plans/2026-10-02-loader-options-once.md` on `develop`
- **Approved:** 2026-10-02, Jan Wloka, plan-PR #134 merged
- **Branch:** `infra/esm-bench-watchdog` (base: `develop`)
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh` (on PATH). Do not merge it yourself.
- **Review of the code:** an independent review, plus uncached gates run by the maintainer's session before merge

**Ordering.** This is the plan's first branch and waits on nothing. `bug/loader-resolve-options-once` waits on it.
That slice's gate uses this branch's benchmark and the baseline procedure you write into its header, so a racy
benchmark or a vague procedure blocks it.

Line numbers below are from `develop` at `06e086b5`. Re-find code by name if lines have moved.

### What to build

`packages/webpack-test/perf/esm-watch-bench.cjs` is a manual benchmark (`pnpm perf:esm`, not in CI). Each child
process watches one variant and runs a chain of steps. A step waits `settle` ms, writes a file and starts a
watchdog. The step ends on webpack's `done` callback or when the watchdog fires, whichever comes first, and either
event calls `next()`.

**The race** (found by reading, confirmed by the performance juror, `:235-271`):

- The watchdog callback (`:265-269`) counts the step as `unchanged`, clears `pending` and calls `next()`.
- A rebuild that finishes after that still reaches the `done` callback. `clearTimeout(watchdog)` (`:240`) has nothing
  left to stop, because the timer already fired, or it clears the **next** step's watchdog. Then it:
  - records a sample, as `results.initial` when `pending` is undefined (`:245-249`), which overwrites the real initial
    build, or as the new step's sample when the new write already set `pending`;
  - calls `next()` again (`:250`). Two step chains now run in the same process: steps are skipped, writes overlap and
    every later sample is suspect.
- The watchdog is `max(30 s, 3 × initial)` (`:229`). A slow flip rebuild of a 1000-module project reaches that limit,
  so this is not hypothetical. It gets likelier as `bug/loader-resolve-options-once` changes rebuild times.

**The work:**

1. **Extract the step scheduler** from `runChild` (`:229-271`) into its own CommonJS module next to the benchmark,
   e.g. `packages/webpack-test/perf/watch-steps.cjs`. A module the test can `require` without side effects is
   needed because `esm-watch-bench.cjs` runs `main()` or `runChild()` when it is loaded (`:368-372`). Inject
   `setTimeout`/`clearTimeout`, or use them in a way Jest's fake timers control. The webpack watcher, fixture and
   sampling stay in the benchmark. The scheduler owns the step order, the settle delay, the watchdog and the
   generation token.
   - Commit the extraction **unchanged in behaviour** first, together with the new test. The late-`done` test must
     fail on that commit. Then add the fix.
2. **Fix it with a generation token, not only a cleared timer.**
   - Each step gets a generation number.
   - The watchdog and the `done` handler both check that their generation is still current before they record or
     advance. The first one to arrive ends the step and advances the generation.
   - A late `done` for an expired generation records nothing, does not touch `results.initial`, does not clear the
     current watchdog and does not call `next()`.
   - Count late completions (e.g. `results.late[scenario]`) and print them next to `unchanged`, so a run with timeouts
     shows it.
3. **Record the initial build.** Today `results.initial` is printed per round (`:331`) but not summarized. Add the
   median of the per-process initial-build times per variant to the summary output. That is the number
   `bug/loader-resolve-options-once` compares against `develop`. Do not gate on it here.
4. **Document the manual `develop` baseline procedure in the header** (`:7-29`). The plan's settled gate (Open Point
   "Measured gate for resolve-once", (a)) is:
   - the 1000-module initial build drops by at least 80% against a `develop` build of the same generated project;
   - both runs use the same `--modules` and `--processes`, take the median of 3, and both numbers go in the PR.

   Write it as runnable steps, for example:
   - a worktree of `develop` at the PR's merge base;
   - `pnpm install --offline` and `pnpm build`;
   - `pnpm perf:esm --modules 1000 --processes <n>` three times on each tree;
   - the median of the three initial-build medians of variant A on each side.

   Say which variant the gate reads and what "median of 3" counts.

No product code changes. No `Release-Notes.md` entry and no README change: the benchmark is internal tooling and the
plan names no documentation duty for it.

The plan is canonical. This brief is orientation.

### Settled decisions — do not re-derive them

- **A generation token, not `clearTimeout` alone.** `clearTimeout` cannot stop a timer that already fired, and the
  bug lives entirely in that ordering: the watchdog fires first, then `done` arrives. The draft plan's "cleared
  timer" was rejected by the loader-performance juror (`.plot/panels/2026-10-02-loader-options-once/
  loader-performance.md`, finding 5) and the plan settles on the token (Design → "Benchmark first", slice line).
- **Its own branch, before resolve-once.** The panel (downstream and performance jurors) split it out of slice 1.
  Slice 1 was too big to review, and its gate numbers must come from a benchmark already known to be correct. Do
  not fold any resolve-once work in here.
- **The benchmark stays manual, out of CI.** The header's reason still holds: timing noise on shared runners exceeds
  the budget. The esm-check-webpack brief measured rebuild medians swinging 90–180 ms across identical runs. Only the
  scheduler's logic gets an automated test, and that test is deterministic (fake timers, no webpack).
- **Leave the gates and their texts alone.** The change from the ESM-check share gate to "absolute ms per rebuilt
  module", the rewrite of the variant C flip text, and the 20-module starter build gate are settled for
  `bug/loader-resolve-options-once` (Open Point (b), (c)). They are not part of this branch. The panel noted the share
  rises when rebuild time falls, which is why that slice changes it and this one does not.
- **Known limit, documented rather than solved:** a late `done` that arrives **after** the next step's write cannot
  be told apart from that step's own `done` by a token alone. If checking that the step's file is in
  `watching.compiler.modifiedFiles` before crediting a sample is a few lines, you may do it. Otherwise state the
  limit in the header. Do not build more than that.

### Done when

The plan's slice line is the specification. These are the assertions a naive implementation would pass without:

- **A late `done` after the watchdog fired runs `next` exactly once.** Fake timers: start a step and advance past the
  watchdog, then deliver `done`. Assert `next` ran once, the step counted as `unchanged`, and no sample was recorded.
  The test must fail on the extraction-only commit. This catches the "just `clearTimeout`" fix, which still calls
  `next` twice.
- **A late `done` does not overwrite the initial build,** and does not clear the next step's watchdog: after the late
  `done`, the next step's watchdog still fires.
- **The normal path:** a `done` before the watchdog records one sample, counts nothing as `unchanged`, and the
  watchdog never fires afterwards.
- **The chain ends once:** after the last action the finish callback (`watching.close`) runs exactly once, also when
  the last step timed out and a late `done` follows.
- **Behaviour check of the benchmark:** a short real run completes and prints the summary with the initial-build
  medians, e.g. `pnpm perf:esm --modules 50 --processes 1 --edits 3 --flips 2` after `pnpm build`, run with Node 22.
  Put the output in the PR.
- **The header** carries the baseline procedure as runnable steps.
- **Tests follow `docs/rules/testing.md`:** assemble / act / assert with no part comments, `testObj` and `actual`, and
  no shared `testObj`.
  - Put the test in `packages/webpack-test/tests/` (e.g. `esm-watch-bench-steps.test.ts`), because the package's Jest
    `testRegex` is `tests/.*test\.(tsx?)$`.
  - `webpack-test` has no `test` script, so the test runs under `pnpm test:e2e`. Say so in the PR.
  - Loading a `.cjs` file from that test may need `"cjs"` in `moduleFileExtensions` in
    `packages/webpack-test/jest.config.ts`. Verify the red test really loads the module.
  - The tests' ESLint block does not switch off `@typescript-eslint/no-require-imports` (`eslint.config.js:139-151`
    switches it off only for `**/perf/*.cjs`). Use a scoped disable comment on the `require` line.
- **Gates, all green:** `pnpm lint`, `pnpm build`, `pnpm test --skip-nx-cache`, `pnpm test:e2e --skip-nx-cache`.
- **New files carry the MIT license header** (`pnpm license:add`). Do not add them to the `license:check` list.

### Repo mechanics

- **pnpm 10** from `$HOME/.nvm/versions/node/v22.17.0/bin`: put it first on `PATH`. The Homebrew pnpm 11 fails with
  E401.
- **Installs:** `pnpm install --offline`. The Artifactory login in `~/.npmrc` is expired. **Never edit `~/.npmrc`.**
  If a registry package is unavoidable, use an empty file as `NPM_CONFIG_USERCONFIG` plus
  `--config.registry=https://registry.npmjs.org/`. This branch should need no new package.
- **Node 24** is at `$HOME/.nvm/versions/node/v24.21.0/bin/node`, for runtime checks.
- **Commits:** Arlo's notation without a colon (`commit-notation` skill). For example, `t Fixes the benchmark watchdog
  race with a generation token` (lowercase `t`: test or tooling-only change, no product risk).
- **Deleting files:** use `trash`, never `rm`.

### Bookkeeping

- Push the first real commit as soon as it exists.
- Open the PR with `plot-open-pr.sh`, never `gh pr create`. Then give it a descriptive title: the wave heading alone
  reads "Benchmark".
- Append `→ #<number>` to the `infra/esm-bench-watchdog` line in the plan's `## Slices` and commit that on this
  branch.

### Scope guard

This branch owns:

- `packages/webpack-test/perf/esm-watch-bench.cjs` and the new scheduler module beside it;
- the new test file in `packages/webpack-test/tests/`;
- `packages/webpack-test/jest.config.ts`, only if the `.cjs` extension is needed;
- the `→ #<PR>` line in `docs/plans/2026-10-02-loader-options-once.md`.

Do not touch:

- product code (`packages/*/src`);
- `package.json` files (the `perf:esm` script already exists), `pnpm-lock.yaml`, tsconfigs, `eslint.config.js`
  (its `**/perf/*.cjs` block already covers a new `.cjs` beside the benchmark);
- `Release-Notes.md`, READMEs.

Branches starting at the same time, checked against their plans on `develop`:

- `infra/dependabot-config` (#133): `.github/dependabot.yml` and the claude-review workflow. No overlap.
- `bug/tsc-default-target-interop` (#135): core `tsDefaults`, `effective-options.ts`, `Compiler.ts`, `system.ts`,
  compiler-test fixtures, **webpack-test snapshots** (`tests/__snapshots__`), `Release-Notes.md`. No overlap if you
  add no snapshot test. Keep yours snapshot-free.
- `bug/esm-check-false-positives` (#137): core ESM-check modules, `bin.test.ts`,
  `packages/webpack-test/tests/webpack-esm-check.test.ts`. Same directory, different file. No overlap.
- `bug/cli-project-directory` (#136): core `parsed-command-line`/`ResolvedCompilerOptions`/`command`, `bin.test.ts`,
  `Release-Notes.md`. No overlap.
- `infra/typescript-6-toolchain` (#144): every package's tsconfigs (including `packages/webpack-test/tsconfig*.json`),
  devDependency versions (ts-loader, ts-jest, typescript-eslint) in `package.json` files, `pnpm-lock.yaml`. This is
  the one real collision risk. Avoid it by leaving all of those untouched. If `jest.config.ts` needs `"cjs"`, it is a
  one-line change that branch does not plan to make.

Later and not in flight: the typescript-6 plan's `infra/typescript-7-1-bench` adds a harness **beside**
`esm-watch-bench.cjs`. Keep the extracted scheduler generic (no ESM-check names in it) so it can be reused, but do not
design for it.

If you find something the plan did not anticipate, report it rather than improvising outside scope.
