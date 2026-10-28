<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — typescript-7-1-batched-measurement (wave 2: Batched measurement)

- **Plan (canonical):** `docs/plans/2026-10-28-typescript-7-1-batched-measurement.md` on `develop`
- **Approved:** 2026-10-28, jwloka, in-session
- **Sprint:** `tsc71-adoption` (ends 2026-11-04); this wave completes its only Must Have
- **Branch:** `docs/typescript-7-1-batched-measurement` (base: `develop`)
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh` (on PATH). Do not merge it yourself.
- **Review of the code:** an independent review by the maintainer's session before merge

Start after wave 1 ("Batched bench", #224) has merged: this wave runs that harness and changes no code.

### What to build

Run the full benchmark on `develop` and record the decision. The harness (`packages/webpack-test/perf/ts71-bench.cjs`,
schema `websmith-ts71-bench/2`) now pins `7.1.0-beta` and produces two results: **Speed (per call)** over (a)–(f),
unchanged since 2026-10-15, and **Speed (batched)** over (g) CLI batch and (h) loader micro-batch, judged by the same
six thresholds. Deliver:

1. **The run.** From `packages/webpack-test`, with the harness defaults (`--runs 5 --sizes 200,1000 --edits 30
   --in-flight 8`):
   `pnpm perf:ts71 -- --out "$TMPDIR/ts71-batched.json" > "$TMPDIR/ts71-batched.log" 2>&1`
   on Node 22.17.0 (the header's "Run" block). The decision is read at 1,000 modules.
2. **The data:** `docs/stories/ts7-rearchitecture/analysis-ts71-batched-measurement.json`, the result file as written.
3. **The report:** `docs/stories/ts7-rearchitecture/analysis-ts71-batched-measurement.md`, beside
   `analysis-ts71-measurement.md` and in its section order: Summary, Setup (machine, Node, harness commit,
   `meta.versions` with integrities, corpus hashes, options, run command), Results per workload, IPC payload,
   Transformer probe, Decision rule with **every threshold and its measured value for both results**, Status on the
   run date, Caveats, Deviations, Reproduce.
4. **The decision:** one row in the Decisions table of `STORY-ts7-rearchitecture.md`, dated the run date, naming the
   chosen row of the 2026-10-02 decision table and the next re-run trigger. Update "Current Plan" there to match.

### Settled — do not re-derive

- **The thresholds and the table are fixed.** They were written before the first run. Report what the numbers say,
  including "not met"; do not adjust a threshold, a size or a workload to change a verdict.
- **(g)'s judged baseline checks the corpus files only** (`getSemanticDiagnostics` per file, as (c) and 7.1 do).
  `getPreEmitDiagnostics`, what the `websmith` command runs, is an unjudged row. Both appear in the report; the
  difference between them is the lib and global checking 7.1's side does not do (≈450 ms against ≈60 ms at size 20).
  Say so where criterion 2 is read.
- **(h) is an upper bound.** Webpack calls a loader once per module; (h) measures what a loader that micro-batches
  its in-flight modules could reach, not what websmith's loader does today. State it in the Summary and in Caveats.
- **3C decides the transformer question, not speed.** Read the beta's `TranspileOptions` for a `transformers` field
  and TypeScript#64709 on the run date. If 3C is still not met, a "Speed (batched): met" leads at most to option B/D
  **for profiles without transformer addons**.
- **Compare with 2026-10-15 per call.** The per-call workloads are unchanged; put the beta's per-call values beside
  the nightly's for criteria 1–6 so a reader sees what the beta itself changed.

### Done when

- The JSON and the report are committed under `docs/stories/ts7-rearchitecture/` with the MIT header on the
  Markdown file; the report cites its numbers from the JSON (`decision[]`, `summary`), not from the log.
- The machine state is recorded: load average at start and end, as the first report did (it ran at 9–18 on 10
  cores). Other fleet agents may be running; if the 1-minute load average at start is above the core count, wait or
  record it as a caveat — do not stop other agents.
- The story's Decisions row and "Current Plan" agree with the report.
- The sprint item stays unticked; `/plot-deliver` and the sprint close tick it.
- `pnpm lint` passes (Markdown only changes); no Release-Notes entry.

### Bookkeeping

Push the first real commit as soon as it exists. Open the PR with `plot-open-pr.sh`, never `gh pr create`, then
append `→ #<number>` to this branch's heading line in the plan's `## Slices`. Commits follow Arlo's notation without
a colon (`d …`).

### Scope guard

This branch owns the two new files under `docs/stories/ts7-rearchitecture/` and the Decisions row and "Current
Plan" of `STORY-ts7-rearchitecture.md`. It does not change the harness: if the full run fails or a workload is "not
measurable", report it as such and stop there, rather than editing `ts71-bench.cjs` on this branch.
