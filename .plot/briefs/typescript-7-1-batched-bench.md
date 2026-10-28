<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — typescript-7-1-batched-measurement (wave 1: Batched bench)

- **Plan (canonical):** `docs/plans/2026-10-28-typescript-7-1-batched-measurement.md` on `develop`
- **Approved:** 2026-10-28, jwloka, in-session
- **Sprint:** `tsc71-adoption` (2026-10-28 → 2026-11-04), whose only Must Have is this plan
- **Branch:** `infra/typescript-7-1-batched-bench` (base: `develop`)
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh` (on PATH). Do not merge it yourself.
- **Review of the code:** an independent review, plus uncached gates run by the maintainer's session before merge

Wave 2 ("Batched measurement", `docs/typescript-7-1-batched-measurement`) runs the full measurement on this harness
after it merges. This branch does a dry run only; do not commit full-run results here.

### What to build

`packages/webpack-test/perf/ts71-bench.cjs` (986 lines) measures TypeScript 7.1 against in-process 5.7.3 and 6.0.3
with workloads (a)–(f) and a six-criterion decision (`decide`, `:823`). Its 2026-10-15 run failed criterion 4 only:
7.1's p95 was 7.609 × its own median in (c) per-file check + emit (threshold 3 ×). Every 7.1 emit was one file per
call: `getJavaScriptEmit([fileName])` at `:511` and `:530`; `batch` is never used.

Re-pin the harness to `7.1.0-beta` and add two batched workloads, judged as a second result:

- **(g) CLI batch** — one `createProgram`, every file's semantic diagnostics, then **one** `getJavaScriptEmit` over all
  files. Baseline: in-process 6.0.3 `program.emit()` after `getPreEmitDiagnostics`. Assert every file's marker is in
  the batched output (split by `outputFiles`), as (e) asserts edits.
- **(h) loader micro-batch** — the files a loader has in flight, `--in-flight` at a time (default 8), sent as one
  `api.batch(...)` of `getJavaScriptEmit` generators (type-checked path) and, separately, of `transpileModule`
  generators (fast path). Baseline: in-process 6.0.3 sequential calls, as in (f). Same marker assertion.
- **"Speed (batched)"** in `decision[]` beside the unchanged per-call result: the same six thresholds, with criterion
  4 read as p95 over **batches** (the unit a host waits for). Print both results in the summary.

The batch APIs, verified in `7.1.0-beta`'s declarations on 2026-10-27:
`getJavaScriptEmit(files: readonly DocumentIdentifier[]): EmitOutput` and its `.gen(files)` generator
(`dist/api/sync/api.d.ts:726-729`); `batch<T extends readonly AnyAPIRequestGenerator[]>(...requestGenerators: T)`
(`:105`); low-level `batchRequests(requests)` (`dist/api/sync/client.d.ts:15`). The beta's emit and batch API is
identical to the pinned nightly's; only timing plumbing changed (`TS_API_TIMING_DIR`).

### Settled — do not re-derive

- **Thresholds do not change.** The decision rule is the plan's, written before the first run; moving a bar until a
  run passes measures nothing. (g) and (h) are judged by the same six numbers.
- **Per-call workloads (a)–(f) stay exactly as they are**, so the beta's per-call numbers are comparable with
  2026-10-15. Only the pin changes for them.
- **Re-pin by the header's procedure** (`ts71-bench.cjs:66-77`): edit the alias in `ts71-versions.json`, regenerate
  `ts71-versions.lock.json` in a scratch directory with npm, an empty user config and the public registry, check
  `exports` has `./sync` and `./async`, check the `TranspileOptions` and `Snapshot.update` shapes, dry run, commit
  both files together. Never the workspace's `typescript` (pinned 6.0.3) and never `~/.npmrc`.
- **No transformers on 7.1.** `transformers` is absent from the beta's `TranspileOptions`; (h)'s `transpileModule`
  batch runs without them and records `transformersApplied: false`, as (b) does. The transformer probe
  (`ts71-transformer-probe.cjs`) runs unchanged.
- **The loader limit is stated, not solved.** Webpack calls the loader once per module, so (h) is an upper bound of
  what a micro-batching loader could reach. Say so in the header comment; do not build a batching loader.
- Summaries stay medians with min and max over runs, never means; a 7.1 workload that throws or lacks a method is
  "not measurable" and counts as not met; a correctness failure (missing marker, wrong version) aborts the run.

### Done when

- `ts71-versions.json` and `ts71-versions.lock.json` pin `7.1.0-beta`, committed together, integrities checked by the
  harness's own pre-run check.
- (g) and (h) run in every child of the 7.1 variant and the in-process baselines, with marker assertions, and appear
  in the summary table and in the result JSON (bump the schema name if its shape changes, e.g.
  `websmith-ts71-bench/2`).
- `decision[]` carries "Speed (per call)" and "Speed (batched)", each listing all six criteria with threshold and
  value.
- Dry run passes on Node 22 and 24: `pnpm perf:ts71 --sizes 20 --runs 1 --edits 3` (see the header's "Run" block for
  the Node paths); paste the summary in the PR.
- The header comment documents (g), (h), the batched criteria and the loader caveat.
- `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm test:e2e` pass (the harness is not in CI, but the package is).
  pnpm is pinned to 10.8.0 through `packageManager`; run it through corepack. Before each push, run
  `node <plot scripts>/board/plot-local-checks.mjs` and run what it prints.
- No Release-Notes entry: no user-facing change.

### Bookkeeping

Push the first real commit as soon as it exists. Open the PR with `plot-open-pr.sh`, never `gh pr create`, then
append `→ #<number>` to this branch's heading line in the plan's `## Slices`. Commits follow Arlo's notation without
a colon (`e …` for the harness and pin, `d …` for comments).

### Scope guard

This branch owns `packages/webpack-test/perf/ts71-bench.cjs`, `ts71-versions.json`, `ts71-versions.lock.json` and,
if needed, `ts71-corpus.cjs`. It does not touch `docs/stories/ts7-rearchitecture/` (wave 2 writes the report and the
decision), the workspace `typescript` pin, or any package source. No other branch is in flight on these files.

If the beta's API does not match the declarations above (a method missing, `batch` rejecting a generator), record it
as "not measurable" for that workload and say so in the PR rather than working around it.
