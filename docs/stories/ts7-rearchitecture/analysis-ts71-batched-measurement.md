<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# TypeScript 7.1 Beta Measurement with Batched Emit

Story: [Re-architecture for TypeScript 7](STORY-ts7-rearchitecture.md) · Plan:
[`typescript-7-1-batched-measurement`](../../plans/2026-10-28-typescript-7-1-batched-measurement.md) · Data:
[`analysis-ts71-batched-measurement.json`](analysis-ts71-batched-measurement.json) · First run:
[`analysis-ts71-measurement.md`](analysis-ts71-measurement.md) (2026-10-15)

## 1. Summary

Run on 2026-10-28 against `typescript@7.1.0-beta`: **Speed (per call): not met**, **Speed (batched): met**, and 3C
is **not met**. The Decisions row is the 2026-10-02 table's "reopen B: a new plan for a dual backend, D assessed in
it", **limited to profiles without transformer addons**, as the plan's Approach prescribes for "Speed (batched): met"
with 3C not met. Profiles with transformer addons stay on A.

- **Per call** fails on criterion 4 alone, as on 2026-10-15: 7.1's p95 is 7.111 × its own median (threshold 3 ×)
  in (c) per file. The beta's per-call ratios are within noise of the nightly's (section 6.2).
- **Batched** meets all six: (h) 0.303 ≤ 1.5; (g) 0.171 ≤ 2; (e) 0.004 ≤ 2; p95 over batches 2.352 ≤ 3; (h)
  throughput 3.470 ≥ 0.667; cold start 45 ms.
- **(h) is an upper bound.** Webpack calls a loader once per module, so no loader holds eight modules at once today.
  (h) measures what a loader that micro-batches its in-flight modules could reach, not what websmith's loader does.
  The CLI's (g) needs no such loader change.
- **Criterion 4 passes because a batch is the unit.** A batch of eight averages out large and small modules; the
  in-process variants pass the batched criterion 4 too (6.0.3: 1.901 and 2.401). See Caveats.

## 2. Setup

- **Machine:** Apple M1 Max, 10 cores, 64 GiB (68,719,476,736 bytes), macOS (darwin 25.2.0, arm64), power "Now
  drawing from 'AC Power'". Load average (1, 5, 15 min) at start 8.79 / 22.60 / 21.45, at end 10.35 / 10.96 /
  15.50 (`meta.machine.loadavgStart`, `loadavgEnd`). Other fleet agents were running: the 1-minute load was 31.93 at
  12:29Z, so the run waited until it fell below the core count (9.30 at 12:33:42Z) and started at 12:33:47Z.
- **Node:** v22.17.0 (V8 12.4.254.21-node.26), `/Users/jwloka/.nvm/versions/node/v22.17.0/bin/node`.
- **Harness:** `packages/webpack-test/perf/ts71-bench.cjs` at **`d9926b76`**, the merge commit of #224 (last harness
  change `c7d81d4b`). Run at `meta.git.head` `3c2bdf83dc7ea1cf98ae8d0dd810f8f17a057bc9`, an empty Plot claim commit
  on top of `develop` at `d9926b76`; `perfDirty: false`. Schema `websmith-ts71-bench/2`.
- **Versions** (`meta.versions`, installed by the harness with `npm ci --ignore-scripts` from the committed
  `ts71-versions.lock.json`, outside the repository; integrities verified; `installed: false`, the directory was
  already populated from the same lockfile hash):

  | Alias | Package | Integrity |
  |---|---|---|
  | `ts573` | `typescript@5.7.3` | `sha512-84MVSjMEHP+FQRPy3pX9sTVV/INIex71s9TL2Gm5FG/WG1SqXeKyZ0k7/blY/4FdOzI12CBy1vGc4og/eus0fw==` |
  | `ts603` | `typescript@6.0.3` | `sha512-y2TvuxSZPDyQakkFRPZHKFm+KKVqIisdg9/CZwm9ftvKXLP8NRWj38/ODjNbr43SsoXqNuAisEf1GdCxqWcdBw==` |
  | `ts71` | `typescript@7.1.0-beta` | `sha512-cjWjZAJDsmZzsNC5GwHNlW0YPM65jZa5oR0KyQcYX3KSVIfTvtBq//vewISyatKk4OLi5grZjHhIVE9fdrw1UQ==` |
  | (binary) | `@typescript/typescript-darwin-arm64@7.1.0-beta` | `sha512-q7mxblcyX0E7hXsY4k+Q6KWKK5mGmfVq+BDesdTgRVgjodk27aIxER77Zyj9+TgSTlCje8F7+JM6f6hl2BuNdw==` |

- **IPC encodings:** MessagePack-framed JSON over stdio on the sync client (`tsc --api`; `[type, method, JSON
  payload]` tuples) for (a)–(e), (g) and (h); JSON-RPC (vscode-jsonrpc) over stdio on the async client for (f).
- **Compiler options** (numeric enums): `transpileModule` `{"target":9,"module":99,"jsx":2,"strict":true}`;
  programs `{"target":9,"module":99,"jsx":2,"strict":true,"moduleResolution":100}`.
- **Corpus:** seed `20261013`, the same hashes as on 2026-10-15.

  | Size | Files | Marker modules | Hash |
  |---|---|---|---|
  | 200 | 200 | 19 | `d71d43b82aa0b3129cee6eb7208dc61b550f6e7c0f06940b287f882c02e7d24d` |
  | 1,000 | 1,000 | 99 | `f182534b130d6211e7064027d15a009166487eeff9fc73877d046fab335c8d04` |

- **Options** (`meta.options`, the harness defaults): `runs 5` per variant, interleaved; `sizes [200,1000]`;
  `edits 30`; `in-flight 8`; `loader-instances 1`; `decisionSize` 1000. Finished 2026-10-28T12:42:13Z
  (`meta.timestamp`); about 8.5 minutes wall-clock (12:33:47Z to 12:42:13Z, taken from the shell, not in the JSON).
- **Run command**, from `packages/webpack-test`:

  ```bash
  pnpm perf:ts71 -- --out "$TMPDIR/ts71-batched.json" > "$TMPDIR/ts71-batched.log" 2>&1
  ```

## 3. Results per workload

Each cell is the median [min–max] over the 5 runs. The ratio is 7.1 / 6.0.3 of the medians; its range runs from 7.1
min / 6.0.3 max to 7.1 max / 6.0.3 min. The 5.7.3 and 6.0.3 columns are the plan's workload (d): the same workloads
in process. The decision rule reads the 1,000-module tables only. (a)–(f) are unchanged since 2026-10-15. (g) runs
after (f) in the same child, on the corpus as (e) left it. (h) times each batch as one unit: in process as
sequential calls, on 7.1 as one `api.batch`; its "ms per file" is a batch's time divided by its files, on both
sides. All 30 runs asserted every file's marker in the (g) and (h) output (`markersAsserted` 200 or 1,000 for (g),
twice that for (h)).

#### 200 modules

**(a) cold start, ms (spawn or load + first transpileModule)**

| Metric | 5.7.3 (d) | 6.0.3 (d) | 7.1 | 7.1 / 6.0.3 | ratio range |
|---|---|---|---|---|---|
| cold start | 122 [119–123] | 124 [119–127] | 47 [43–49] | 0.378 | 0.335–0.408 |
| of which load | 97 [94–97] | 99 [94–100] | 35 [32–38] | 0.354 | 0.322–0.401 |

**(b) per-file transpileModule, warm pass, ms per file (judged)**

| Metric | 5.7.3 (d) | 6.0.3 (d) | 7.1 | 7.1 / 6.0.3 | ratio range |
|---|---|---|---|---|---|
| median per file | 0.834 [0.767–0.873] | 0.805 [0.779–0.848] | 0.346 [0.298–0.382] | 0.430 | 0.352–0.491 |
| p95 per file | 4.549 [4.403–4.715] | 4.325 [4.114–4.476] | 1.416 [1.341–1.561] | 0.327 | 0.300–0.379 |
| pass total | 283 [274–301] | 274 [266–287] | 99 [89–109] | 0.362 | 0.312–0.411 |

**(b) per-file transpileModule, cold pass, ms per file (unjudged)**

| Metric | 5.7.3 (d) | 6.0.3 (d) | 7.1 | 7.1 / 6.0.3 | ratio range |
|---|---|---|---|---|---|
| median per file | 1.047 [1.018–1.144] | 1.074 [0.989–1.093] | 0.342 [0.301–0.437] | 0.318 | 0.276–0.442 |
| pass total | 404 [387–424] | 403 [386–406] | 101 [94–126] | 0.250 | 0.231–0.326 |

**(c) createProgram + per-file semantic check and emit, cold, ms**

| Metric | 5.7.3 (d) | 6.0.3 (d) | 7.1 | 7.1 / 6.0.3 | ratio range |
|---|---|---|---|---|---|
| total | 801 [768–845] | 786 [754–820] | 174 [167–187] | 0.222 | 0.204–0.248 |
| ↳ createProgram | 176 [168–186] | 183 [176–187] | 34 [34–34] | 0.188 | 0.180–0.196 |
| ↳ check, per file | 0.878 [0.807–0.913] | 0.844 [0.749–0.920] | 0.181 [0.165–0.209] | 0.214 | 0.180–0.279 |
| ↳ emit, per file | 0.359 [0.312–0.377] | 0.292 [0.282–0.367] | 0.209 [0.190–0.236] | 0.715 | 0.517–0.839 |
| check + emit, per file | 1.292 [1.163–1.331] | 1.129 [1.060–1.353] | 0.387 [0.357–0.448] | 0.343 | 0.264–0.423 |
| check + emit, p95 per file | 10.630 [9.728–10.821] | 10.621 [9.656–10.757] | 2.746 [2.455–2.911] | 0.259 | 0.228–0.301 |
| semantic diagnostics | 5 | 5 | 5 | | |

**(e) watch rebuild, ms per edit (30 edits)**

| Metric | 5.7.3 (d) | 6.0.3 (d) | 7.1 | 7.1 / 6.0.3 | ratio range |
|---|---|---|---|---|---|
| judged (websmith's host, re-parses every file) | 174.82 [172.87–178.19] | 194.87 [192.90–195.63] | 1.46 [1.42–1.65] | 0.007 | 0.007–0.009 |
| unjudged: in process with a SourceFile-caching host | 5.56 [4.99–5.75] | 3.83 [3.66–4.07] | n/a | 0.382 | 0.349–0.452 |

**(f) throughput, modules/s (ratio: 7.1 with 8 in flight / 6.0.3 sequential)**

| Metric | 5.7.3 (d) | 6.0.3 (d) | 7.1 | 7.1 / 6.0.3 | ratio range |
|---|---|---|---|---|---|
| sequential | 765 [719–840] | 763 [745–781] | 1336 [1238–1555] | 1.750 | 1.584–2.088 |
| 8 in flight | n/a | n/a | 1980 [1827–2138] | 2.594 | 2.339–2.872 |

**(g) CLI batch, ms: createProgram + every file's semantic diagnostics + one emit of every file**

| Metric | 5.7.3 (d) | 6.0.3 (d) | 7.1 | 7.1 / 6.0.3 | ratio range |
|---|---|---|---|---|---|
| total (judged) | 863 [833–998] | 1021 [961–1100] | 110 [106–117] | 0.108 | 0.097–0.122 |
| ↳ createProgram | 110 [107–116] | 122 [118–124] | 34 [30–34] | 0.276 | 0.246–0.290 |
| ↳ check, all files | 353 [342–450] | 359 [340–441] | 53 [50–55] | 0.147 | 0.113–0.163 |
| ↳ emit, all files | 395 [385–433] | 519 [493–635] | 25 [24–28] | 0.049 | 0.038–0.056 |
| unjudged: `getPreEmitDiagnostics` (lib and global too; ratio: 7.1 check, all files / 6.0.3 `getPreEmitDiagnostics`) | 665 [637–735] | 727 [689–837] | n/a | 0.073 | 0.059–0.080 |
| diagnostics | 5 | 5 | 5 | | |

**(h) loader micro-batch, transpileModule (no transformers), 25 batches of 8 files**

| Metric | 5.7.3 (d) | 6.0.3 (d) | 7.1 | 7.1 / 6.0.3 | ratio range |
|---|---|---|---|---|---|
| ms per file | 1.260 [1.146–1.378] | 1.158 [1.155–1.286] | 0.389 [0.352–0.459] | 0.336 | 0.273–0.397 |
| ms per batch | 10.08 [9.17–11.02] | 9.26 [9.24–10.29] | 3.11 [2.81–3.67] | 0.336 | 0.273–0.397 |
| p95 per batch | 22.91 [20.41–25.60] | 21.36 [19.83–21.49] | 6.66 [6.51–7.57] | 0.312 | 0.303–0.382 |
| modules/s | 708 [580–810] | 739 [713–776] | 2327 [2181–2374] | 3.148 | 2.811–3.330 |

**(h) loader micro-batch, semantic check + emit, 25 batches of 8 files**

| Metric | 5.7.3 (d) | 6.0.3 (d) | 7.1 | 7.1 / 6.0.3 | ratio range |
|---|---|---|---|---|---|
| ms per file | 1.963 [1.898–2.341] | 1.909 [1.757–1.988] | 0.506 [0.477–0.525] | 0.265 | 0.240–0.299 |
| ms per batch | 15.70 [15.18–18.72] | 15.27 [14.06–15.91] | 4.05 [3.82–4.20] | 0.265 | 0.240–0.299 |
| p95 per batch | 41.23 [39.98–49.91] | 39.95 [37.04–43.10] | 10.43 [9.58–10.68] | 0.261 | 0.222–0.288 |
| modules/s | 444 [350–466] | 469 [455–497] | 1809 [1623–1824] | 3.854 | 3.264–4.013 |

#### 1,000 modules (judged size)

**(a) cold start, ms (spawn or load + first transpileModule)**

| Metric | 5.7.3 (d) | 6.0.3 (d) | 7.1 | 7.1 / 6.0.3 | ratio range |
|---|---|---|---|---|---|
| cold start | 122 [121–129] | 122 [119–130] | 45 [43–48] | 0.364 | 0.335–0.406 |
| of which load | 99 [97–103] | 98 [95–104] | 33 [32–36] | 0.335 | 0.311–0.382 |

**(b) per-file transpileModule, warm pass, ms per file (judged)**

| Metric | 5.7.3 (d) | 6.0.3 (d) | 7.1 | 7.1 / 6.0.3 | ratio range |
|---|---|---|---|---|---|
| median per file | 0.740 [0.708–0.786] | 0.719 [0.696–0.777] | 0.344 [0.335–0.385] | 0.479 | 0.432–0.553 |
| p95 per file | 4.242 [3.888–4.358] | 4.005 [3.845–4.241] | 1.693 [1.598–1.746] | 0.423 | 0.377–0.454 |
| pass total | 1323 [1257–1362] | 1292 [1203–1339] | 540 [532–599] | 0.418 | 0.397–0.498 |

**(b) per-file transpileModule, cold pass, ms per file (unjudged)**

| Metric | 5.7.3 (d) | 6.0.3 (d) | 7.1 | 7.1 / 6.0.3 | ratio range |
|---|---|---|---|---|---|
| median per file | 0.870 [0.830–0.871] | 0.832 [0.799–0.878] | 0.349 [0.325–0.423] | 0.419 | 0.370–0.529 |
| pass total | 1536 [1509–1575] | 1522 [1454–1574] | 545 [518–619] | 0.358 | 0.329–0.426 |

**(c) createProgram + per-file semantic check and emit, cold, ms**

| Metric | 5.7.3 (d) | 6.0.3 (d) | 7.1 | 7.1 / 6.0.3 | ratio range |
|---|---|---|---|---|---|
| total | 2734 [2677–2830] | 2567 [2490–2641] | 846 [833–947] | 0.330 | 0.315–0.380 |
| ↳ createProgram | 361 [357–392] | 394 [356–396] | 75 [66–77] | 0.189 | 0.167–0.217 |
| ↳ check, per file | 0.653 [0.586–0.678] | 0.588 [0.566–0.623] | 0.195 [0.186–0.242] | 0.331 | 0.299–0.428 |
| ↳ emit, per file | 0.351 [0.319–0.364] | 0.280 [0.268–0.294] | 0.215 [0.204–0.265] | 0.768 | 0.694–0.986 |
| check + emit, per file | 1.016 [0.923–1.080] | 0.883 [0.853–0.923] | 0.413 [0.394–0.502] | 0.468 | 0.427–0.589 |
| check + emit, p95 per file | 8.648 [8.022–9.201] | 7.941 [7.225–8.229] | 2.938 [2.826–3.134] | 0.370 | 0.343–0.434 |
| semantic diagnostics | 5 | 5 | 5 | | |

**(e) watch rebuild, ms per edit (30 edits)**

| Metric | 5.7.3 (d) | 6.0.3 (d) | 7.1 | 7.1 / 6.0.3 | ratio range |
|---|---|---|---|---|---|
| judged (websmith's host, re-parses every file) | 539.45 [529.69–540.21] | 577.55 [548.31–585.30] | 2.46 [1.97–2.53] | 0.004 | 0.003–0.005 |
| unjudged: in process with a SourceFile-caching host | 10.23 [9.33–10.36] | 6.18 [5.55–7.29] | n/a | 0.397 | 0.270–0.456 |

**(f) throughput, modules/s (ratio: 7.1 with 8 in flight / 6.0.3 sequential)**

| Metric | 5.7.3 (d) | 6.0.3 (d) | 7.1 | 7.1 / 6.0.3 | ratio range |
|---|---|---|---|---|---|
| sequential | 644 [584–723] | 667 [605–704] | 1353 [1283–1407] | 2.028 | 1.823–2.327 |
| 8 in flight | n/a | n/a | 1737 [1709–1783] | 2.603 | 2.428–2.949 |

**(g) CLI batch, ms: createProgram + every file's semantic diagnostics + one emit of every file**

| Metric | 5.7.3 (d) | 6.0.3 (d) | 7.1 | 7.1 / 6.0.3 | ratio range |
|---|---|---|---|---|---|
| total (judged) | 2880 [2777–3001] | 2967 [2902–3114] | 509 [500–537] | 0.171 | 0.160–0.185 |
| ↳ createProgram | 327 [309–360] | 356 [343–527] | 73 [63–82] | 0.205 | 0.120–0.240 |
| ↳ check, all files | 1691 [1618–1779] | 1710 [1614–1750] | 317 [308–326] | 0.185 | 0.176–0.202 |
| ↳ emit, all files | 862 [850–895] | 915 [880–972] | 126 [119–133] | 0.138 | 0.123–0.151 |
| unjudged: `getPreEmitDiagnostics` (lib and global too; ratio: 7.1 check, all files / 6.0.3 `getPreEmitDiagnostics`) | 2060 [1968–2127] | 2190 [2171–2667] | n/a | 0.145 | 0.116–0.150 |
| diagnostics | 5 | 5 | 5 | | |

**(h) loader micro-batch, transpileModule (no transformers), 125 batches of 8 files**

| Metric | 5.7.3 (d) | 6.0.3 (d) | 7.1 | 7.1 / 6.0.3 | ratio range |
|---|---|---|---|---|---|
| ms per file | 1.492 [1.415–1.509] | 1.442 [1.391–1.561] | 0.437 [0.409–0.440] | 0.303 | 0.262–0.316 |
| ms per batch | 11.94 [11.32–12.07] | 11.53 [11.13–12.49] | 3.50 [3.27–3.52] | 0.303 | 0.262–0.316 |
| p95 per batch | 23.07 [22.33–25.91] | 21.92 [20.10–31.15] | 6.94 [6.37–7.42] | 0.316 | 0.205–0.369 |
| modules/s | 576 [513–673] | 577 [567–673] | 2003 [1996–2145] | 3.470 | 2.967–3.784 |

**(h) loader micro-batch, semantic check + emit, 125 batches of 8 files**

| Metric | 5.7.3 (d) | 6.0.3 (d) | 7.1 | 7.1 / 6.0.3 | ratio range |
|---|---|---|---|---|---|
| ms per file | 2.216 [2.066–2.355] | 2.021 [1.902–2.140] | 0.592 [0.560–0.635] | 0.293 | 0.262–0.334 |
| ms per batch | 17.73 [16.53–18.84] | 16.17 [15.22–17.12] | 4.74 [4.48–5.08] | 0.293 | 0.262–0.334 |
| p95 per batch | 42.32 [37.82–52.32] | 38.82 [37.71–47.82] | 11.14 [10.44–11.39] | 0.287 | 0.218–0.302 |
| modules/s | 388 [353–414] | 414 [379–433] | 1458 [1421–1535] | 3.524 | 3.282–4.048 |

## 4. IPC payload per file

From an untimed 7.1 pass of (b) with `collectTiming`, MessagePack-framed JSON on the sync client; source text is
sent per call (`ipc` in the JSON).

| Size | Bytes sent | Bytes received | Server ms | Transport overhead ms | Round trip ms | Mean source bytes | Requests |
|---|---|---|---|---|---|---|---|
| 200 | 2,791 | 1,794 | 0.464 | 0.054 | 0.518 | 2,464 | 200 |
| 1,000 | 3,306 | 2,132 | 0.537 | 0.076 | 0.613 | 2,961 | 1,000 |

Bytes per file are the same as on 2026-10-15 (same corpus); the pass measures single calls, not batches.

## 5. Transformer probe

```json
{"version":"7.1.0-beta","runtime":"ignored","typeCheck":[2353],"tscOutput":"…/ts71-transformer-probe.mts(7,5): error TS2353: Object literal may only specify known properties, and 'transformers' does not exist in type 'TranspileOptions'."}
```

(`tscOutput` shortened at the temp-directory path; the full string is in the JSON.) The beta ignores a `before`
transformer at runtime, and its own typings reject the `transformers` field with TS2353. In (b) the `before`
transformer rewrote 99/99 marker modules on 5.7.3 and 6.0.3 in process, and 0/99 on 7.1 (19/19 and 0/19 at size
200). (h) runs without transformers on every variant.

## 6. Decision rule, every threshold with its measured value

At 1,000 modules, 7.1 against in-process 6.0.3, from `decision[]` in the committed JSON.

### 6.1 Speed (batched)

| Criterion | Threshold | Measured value | Status |
|---|---|---|---|
| 1. (h) 7.1 per file within a micro-batch, `transpileModule`, vs 6.0.3 (h) | at most 1.5x | 0.303 (7.1 0.437 ms vs 6.0.3 1.442 ms) | met |
| 2. (g) 7.1 createProgram + all checks + one emit vs 6.0.3 (g) | at most 2x | 0.171 (7.1 508.704 ms vs 6.0.3 2967.250 ms) | met |
| 3. (e) median per edit vs 6.0.3, unchanged (no batched form) | at most 2x | 0.004 (7.1 2.456 ms vs 6.0.3 577.553 ms; unjudged 6.0.3 with a SourceFile-caching host 6.181 ms) | met |
| 4. 7.1 p95 at most 3x its own median over batches, in (h transpile) and (h check + emit) | at most 3x | 2.352 = max of (h transpile) 1.983 and (h check + emit) 2.352 | met |
| 5. (h) 7.1 micro-batched `transpileModule` throughput vs 6.0.3 (h) | at least 1/1.5 (0.667) | 3.470 (7.1 2003.296 vs 6.0.3 577.334 modules/s) | met |
| 6. (a) cold start: above 1 s it counts as cost x loader instances, against speed only above 2 s | ≤ 1 s not counted; else cost x instances ≤ 2,000 ms | 45 ms x 1 loader instance (below 1 s) | met |
| **Speed (batched)**: all six met | all six | all six met | **met** |

**Criterion 2 and the check scope.** The judged in-process (g) checks the corpus files only
(`getSemanticDiagnostics` per file, `ts71-bench.cjs:531-537`), as (c) does and as 7.1's
`getSemanticDiagnostics(files)` does (`:723`). The `websmith` command runs `getPreEmitDiagnostics`, which also
checks the lib files and the global diagnostics; that is the unjudged row (`:540-543`): 6.0.3 2,190 ms against 1,710
ms for the judged check, so about 480 ms of lib and global checking that 7.1's side does not do (≈450 ms against ≈60
ms at size 20, as the bench slice found). With that row in place of the judged check, 6.0.3's (g) would be about
3,447 ms and the ratio about 0.148, still met; criterion 2 is judged on the like-for-like scope.

### 6.2 Speed (per call), and the beta against the 2026-10-15 nightly

Workloads (a)–(f) are unchanged, so the nightly's values from
[`analysis-ts71-measurement.json`](analysis-ts71-measurement.json) stand beside the beta's.

| Criterion | Threshold | 2026-10-15, `7.1.0-dev.20261013.1` | 2026-10-28, `7.1.0-beta` | Status (beta) |
|---|---|---|---|---|
| 1. (b) 7.1 median per-file `transpileModule`, warm, vs 6.0.3 | at most 1.5x | 0.478 (0.302 vs 0.632 ms) | 0.479 (0.344 vs 0.719 ms) | met |
| 2. (c) vs 6.0.3 | at most 2x | 0.342 (808.530 vs 2367.197 ms) | 0.330 (845.790 vs 2566.667 ms) | met |
| 3. (e) median per edit vs 6.0.3 | at most 2x | 0.004 (2.180 vs 541.370 ms; cached host 5.905) | 0.004 (2.456 vs 577.553 ms; cached host 6.181) | met |
| 4. 7.1 p95 at most 3x its own median in (b warm) and (c per file) | at most 3x | 7.609 (b 5.301, c 7.609) | 7.111 (b 4.919, c 7.111) | **not met** |
| 5. (f) throughput with 8 in flight vs 6.0.3 sequential | at least 1/1.5 (0.667) | 2.538 (1921.782 vs 757.163 modules/s) | 2.603 (1737.115 vs 667.458 modules/s) | met |
| 6. (a) cold start | ≤ 1 s not counted; else ≤ 2,000 ms | 43 ms x 1 | 45 ms x 1 | met |
| **Speed (per call)**: all six met | all six | not met | criterion 4 not met | **not met** |

The beta changed little: criteria 1, 2, 3 and 5 moved by less than 0.07 each, and criterion 4 from 7.609 to 7.111,
still above 3. Both 7.1 and 6.0.3 are about 5–14 % slower in absolute terms than on 2026-10-15 (e.g. (b) 6.0.3 0.719
against 0.632 ms), which points at the machine's state rather than at the beta.

### 6.3 3C and the chosen row

| Criterion | Threshold | Measured value | Status |
|---|---|---|---|
| **3C**: shipped in a released 7.x with a documented phase that accepts `before`-style transformers | released 7.x | not shipped: `7.1.0-beta` has no `transformers` in `TranspileOptions` (TS2353) and ignores it at runtime; the beta is not a release (section 7) | **not met** |

The 2026-10-02 table (plan `typescript-6-support`, Spike):

> | Speed | 3C | Decisions row |
> |---|---|---|
> | met | met | reopen B: a new plan for a dual backend, D assessed in it |
> | met | not met | stay on A; re-run the harness at the next 7.x minor |
> | not met | any | stay on A; record "IPC cost blocks per-file emit"; re-run only when the 7.x API adds in-process or batched emit |

The plan of this measurement reads the table with "Speed (batched): met" and 3C not met as "the row for option B or
D, limited to profiles without transformer addons". 3C only matters to profiles that register transformer addons;
for the others the batched speed is the whole question. Chosen:

- **Profiles without transformer addons:** "reopen B: a new plan for a dual backend, D assessed in it".
- **Profiles with transformer addons:** stay on A ("met | not met"); they reopen when 3C ships in a released 7.x.
- **Next re-run trigger:** re-run the harness on the first released 7.1 (`7.1.0`) and at each later 7.x minor, and
  re-check 3C then.

## 7. Status on the run date (2026-10-28)

- **3C.** `7.1.0-beta` (published 2026-10-20T16:45:47Z) declares `TranspileOptions` as `compilerOptions`,
  `fileName` and `reportDiagnostics` only, in `dist/api/sync/api.d.ts:64-68`, `dist/api/async/api.d.ts:63-67` and
  `dist/api/proto.generated.d.ts:1164-1168`; no file under `dist/api` mentions "transformer".
  microsoft/TypeScript#64709 ("API status as of 7.1 beta, versioning/compatibility plan ahead") is open, last updated
  2026-10-09T18:35:54Z, with no comments; it does not mention custom transformers. npm dist-tags: `latest` `7.0.2`,
  `beta` `7.1.0-beta`, `next` `7.1.0-dev.20261028.1`, `rc` `7.0.1-rc`: there is no 7.1 release.
- **ts-loader#1704** ("Support TypeScript 7.1 API"): merged 2026-10-22T14:16:55Z. Its description says
  `getCustomTransformers`, `resolveModuleName` and `resolveTypeReferenceDirective` are "still accepted for backwards
  compatibility but are now inert - the native API doesn't expose equivalent extension points".

## 8. Caveats

- **(h) is an upper bound.** Webpack calls a loader once per module; no loader holds a chunk of eight today
  (`ts71-bench.cjs:47-53`). (h) measures what a loader that collects its in-flight modules and sends them as one
  `api.batch` could reach. websmith's loader does not do that, and whether it can (latency added while a chunk
  fills, a module that waits on another) is a design question for the B/D plan, not answered here.
- **Criterion 4 over batches smooths module sizes.** A batch's time sums eight modules of different sizes, so its
  p95 / median is lower than a single call's on every variant, in process too: 6.0.3 1.901 (h transpile) and 2.401
  (h check + emit), 5.7.3 1.932 and 2.387, against 6.0.3's per-call 5.568 (b warm) and 8.988 (c per file). Batched
  criterion 4 passes mainly because the unit changed, as the plan defines it; it does not show that per-call jitter
  went away (per call it is 7.111).
- **Criterion 1 and 5 baselines are batch means.** In (h) "ms per file" is a batch's time / 8 on both sides, so
  6.0.3's 1.442 ms is a mean, close to (b)'s warm mean (pass total / files = 1.292 ms), not (b)'s median of 0.719
  ms. Against that median, 7.1's (h) 0.437 ms would be 0.608, still met. 6.0.3's (h) throughput (577 modules/s) is
  below its (f) sequential throughput (667); against (f), 7.1's (h) 2,003 modules/s is 3.001, still met.
- **(g) runs warm in process.** (g) follows (f) in the same child, so the in-process JIT is warm; 7.1's (g) runs on
  a new sync API whose server was started by an untimed `transpileModule` (`:712`).
- **(e) the judged baseline re-parses**, unchanged from 2026-10-15: judged ratio 0.004; against the unjudged
  SourceFile-caching host (6.0.3 6.18 ms) 7.1's ratio is 0.397. One edit is one snapshot update, so (e) has no
  batched form and is judged identically in both results.
- **Load and contention.** Other fleet agents ran on this machine. The run started once the 1-minute load had
  fallen below the core count (8.79), but the 5- and 15-minute loads (22.60, 21.45) show heavy use just before;
  at the end it was 10.35 / 10.96 / 15.50. No other benchmark ran in this worktree during the run. Both 6.0.3 and
  7.1 are slower than on 2026-10-15, so the ratios are less affected than the absolute values.
- **One machine:** macOS, arm64, Apple M1 Max, one Node (22.17.0), one corpus.
- **A beta, not a release:** `typescript@7.1.0-beta`.
- **API calls, not websmith end to end:** the harness compares API calls, not a websmith or webpack build.
- **Not measurable:** no workload reported `not measurable`; every workload has `status: "ok"` in all 30 runs.

## 9. Deviations

- **The committed JSON is the result file as written**, 3,609,467 bytes with the raw per-call `durations` arrays.
  The 2026-10-15 report committed a copy with `durations` removed; this slice's brief asks for the file as written.
- **The decision names two rows of the table**, one per kind of profile (section 6.3), because the plan splits the
  "met" outcome by transformer use. The table itself has no such split.
- **The re-run trigger names `7.1.0`.** "The next 7.x minor" of the table would skip the 7.1 release, which is the
  first build that can meet 3C's "released 7.x".
- **`analysis-ts7-api-gap.md:86-88` is still stale** (`unstable/*` entry points). Not corrected in this slice.

## 10. Reproduce

```bash
export PATH="$HOME/.nvm/versions/node/v22.17.0/bin:$HOME/.nvm/versions/node/v22.14.0/bin:$PATH" NX_DAEMON=false
pnpm install --frozen-lockfile --offline
cd packages/webpack-test
pnpm perf:ts71 -- --out "$TMPDIR/ts71-batched.json" > "$TMPDIR/ts71-batched.log" 2>&1
cp -f "$TMPDIR/ts71-batched.json" ../../docs/stories/ts7-rearchitecture/analysis-ts71-batched-measurement.json
```

pnpm 10.8.0 comes from the `v22.14.0` install; the Homebrew pnpm 11 fails. Full JSON: 3,609,467 bytes, sha256
`7fd6f604682060fc0f4a3e051f3b0cba26f918a7041e4aa01d94208604a36e0e`, committed unchanged.

For the next run, follow "Re-pinning" in the header comment of `ts71-bench.cjs` (`:92-103`).
