<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# Measure TypeScript 7.1 beta with batched emit

> Re-run the TypeScript 7.1 benchmark against `7.1.0-beta` with the batched emit the API already offers, which the
> 2026-10-15 run never exercised, and record whether websmith stays on TypeScript 6 or plans 7.1 for builds without
> transformer addons.

## Status

- **State:** Delivered
- **Type:** infra
- **Story:** ts7-rearchitecture
- **Sprint:** tsc71-adoption
- **Review:** in-session
- **Impl:** own branches
- **Approved:** 2026-10-28, jwloka, in-session
- **Started:** 2026-10-28, Jan Wloka, `infra/typescript-7-1-batched-bench`
- **Started:** 2026-10-28, Jan Wloka, `docs/typescript-7-1-batched-measurement`
- **Delivered:** 2026-10-29
<!-- Transition records — written by the workflow commands, not by hand:
- **Approved:** <date>, <who>, <channel>
- **Started:** <date>, <who>, <branch>   (one line per started branch)
-->

## Changelog

- No user-facing change. The TypeScript 7.1 benchmark gains batched-emit workloads, and the ts7-rearchitecture story
  records a new decision.

## Motivation

The 2026-10-15 measurement (`docs/stories/ts7-rearchitecture/analysis-ts71-measurement.md`, `7.1.0-dev.20261013.1`)
met five of six speed criteria and failed criterion 4: 7.1's p95 was 7.609 × its own median (threshold 3 ×), in (c)
per-file check + emit. The decision recorded was "stay on A; re-run only when the 7.x API adds in-process or batched
emit".

A check of the API on 2026-10-27 found that both the measured nightly and `7.1.0-beta` already have batched emit,
unchanged between the two:

- `program.getJavaScriptEmit(files: readonly DocumentIdentifier[])` emits any number of files in one call
  (`dist/api/sync/api.d.ts:726`, `SelectedFilesEmitParams.files`).
- `api.batch(...generators)` / `batchRequests` sends any API calls, `getJavaScriptEmit` and `transpileModule`
  included, in one round trip (`BatchableAPIMethod`, `dist/api/proto.d.ts:38`).
- `emit()` / `emitToString()` emit the whole program in one call.

`ts71-bench.cjs` calls `getJavaScriptEmit([fileName])` once per file (`:511`, `:530`) and never `batch`, so it
measured the slowest use of the API. The re-run trigger was met before the decision was written. Since then
`7.1.0-beta` shipped (npm `beta`), and ts-loader merged 7.1 support (#1704, 2026-10-22) with `getCustomTransformers`
inert. Custom transformers (3C) are still absent from the beta's declarations, so this plan cannot change the answer
for addons with transformers.

## Design

### Approach

- **Re-pin the harness to `7.1.0-beta`** through its "Re-pinning" procedure (`ts71-bench.cjs:66-77`), and keep
  5.7.3 and 6.0.3 as the in-process baselines. Every existing workload (a)–(f) runs unchanged, so the beta's
  per-file numbers are comparable with the 2026-10-15 run.
- **Add two batched workloads**, each matching a way websmith compiles:
  - **(g) CLI batch:** one `createProgram`, every file's semantic diagnostics, then one `getJavaScriptEmit` over all
    files. Against in-process 6.0.3 `program.emit()` with `getPreEmitDiagnostics`. This is what the `websmith`
    command does.
  - **(h) loader micro-batch:** the files a loader has in flight, `--in-flight` at a time (default 8), sent as one
    `api.batch` of `getJavaScriptEmit` (type-checked path) and of `transpileModule` (fast path). Against in-process
    6.0.3 sequential calls, as in (f).
- **Judge the batched workloads with the same six criteria**, criterion by criterion, as a second "Speed (batched)"
  result beside the unchanged "Speed (per call)". Criterion 4 reads p95 over batches, since a batch is the unit a
  host waits for. The thresholds are not changed; a re-run that moves the bar until it passes measures nothing.
- **The decision table is the 2026-10-02 one** (story, Decisions). "Speed (batched): met" with 3C not met leads to
  the row for option B or D, limited to profiles without transformer addons. "Not met" keeps strategy A, and the
  trigger becomes "re-run when 7.x adds in-process emit or custom transformers".

### Open Points

- [ ] Whether a webpack loader can batch at all: webpack calls the loader once per module, so (h) measures an
      upper bound of what a micro-batching loader could reach. The report says so and does not claim the loader
      reaches it.
- [ ] Whether `getJavaScriptEmit` over many files returns per-file output a host can split (it returns
      `EmitOutput` with `outputFiles`); the harness asserts every file's marker in the batched output, as (e)
      asserts edits.

## Slices

One slice per wave. The harness merges first, so the report runs on reviewed code.

### Batched bench (Branch: infra/typescript-7-1-batched-bench) <!-- builds: (g) and (h) batched-emit workloads in ts71-bench.cjs --> → #224

Re-pin to `7.1.0-beta` (lockfile and integrity checks of the harness); add workloads (g) and (h) with per-file marker
assertions; extend `decision[]` with "Speed (batched)" beside the per-call result; a dry run
(`--sizes 20 --runs 1 --edits 3`) passes on Node 22 and 24; the header comment documents both workloads and the
batched criteria.

### Batched measurement (Branch: docs/typescript-7-1-batched-measurement) <!-- builds: analysis-ts71-batched-measurement.md and the story's 2026-11 decision row --> → #225

Full run at the default sizes; a report beside the first one with every threshold and its measured value for both
results, the payload bytes, and the 3C status on the run date (beta declarations, TypeScript#64709); the committed
result JSON; a Decisions row in `STORY-ts7-rearchitecture.md` with the chosen table row and the next trigger.

## Notes

- Sprint: `tsc71-adoption` (2026-10-28 → 2026-11-04) commits to this plan as its only Must Have.
- Out of scope: shipping 7.1 support, widening the peer range, custom transformers (3C).
