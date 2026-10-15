<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# TypeScript 7.1 API Measurement

Story: [Re-architecture for TypeScript 7](STORY-ts7-rearchitecture.md) · Plan:
[`typescript-6-support`](../../plans/2026-10-02-typescript-6-support.md) (Spike, decision rule) · Data:
[`analysis-ts71-measurement.json`](analysis-ts71-measurement.json)

## 1. Summary

Run on 2026-10-15: **Speed: not met**, and 3C is **not met**, so the Decisions row is "stay on A; record "IPC cost
blocks per-file emit"; re-run only when the 7.x API adds in-process or batched emit". Only criterion 4 failed (7.1
p95 / own median 7.609 > 3); the five ratio and cold-start criteria are met.

## 2. Setup

- **Machine:** Apple M1 Max, 10 cores, 64 GiB (68,719,476,736 bytes), macOS (darwin 25.2.0, arm64), power "Now
  drawing from 'AC Power'". Load average (1, 5, 15 min) at start 9.18 / 18.00 / 18.45, at end 8.60 / 10.93 / 14.80.
- **Node:** v22.17.0 (V8 12.4.254.21-node.26), `/Users/jwloka/.nvm/versions/node/v22.17.0/bin/node`.
- **Harness:** `packages/webpack-test/perf/ts71-bench.cjs` at **`f7b7dd9c`**, the merge commit of #190. Run at
  `meta.git.head` `cf1e3767b92b412f398fa755bf9475b70313b8a1`, an empty Plot claim commit on top of `develop` at
  `374d0602`, which contains `f7b7dd9c`; `perfDirty: false`.
- **Versions** (`meta.versions`, installed by the harness with `npm ci --ignore-scripts` from the committed
  `ts71-versions.lock.json`, outside the repository; integrities verified):

  | Alias | Package | Integrity |
  |---|---|---|
  | `ts573` | `typescript@5.7.3` | `sha512-84MVSjMEHP+FQRPy3pX9sTVV/INIex71s9TL2Gm5FG/WG1SqXeKyZ0k7/blY/4FdOzI12CBy1vGc4og/eus0fw==` |
  | `ts603` | `typescript@6.0.3` | `sha512-y2TvuxSZPDyQakkFRPZHKFm+KKVqIisdg9/CZwm9ftvKXLP8NRWj38/ODjNbr43SsoXqNuAisEf1GdCxqWcdBw==` |
  | `ts71` | `typescript@7.1.0-dev.20261013.1` | `sha512-wEt6fQCqhZ3hrbIUaO2LS7d94FSzH+xGP+/KJCxFNFHQiG/W2L0rJ/1B7lAQv6VKntlmjWuzYQ8LABuLZ3W/sg==` |
  | (binary) | `@typescript/typescript-darwin-arm64@7.1.0-dev.20261013.1` | `sha512-V22DvbTQjg6kMEqU5hhZmxhZqTNdbwNz3YB1CULEtxH7gxMxPvFpMM5rbJQgZlhabo0DxvsFfTdUNjOTr4IPIQ==` |

- **IPC encodings:** MessagePack-framed JSON over stdio on the sync client (`tsc --api`; `[type, method, JSON
  payload]` tuples) for (a)–(e); JSON-RPC (vscode-jsonrpc) over stdio on the async client for (f).
- **Compiler options** (numeric enums): `transpileModule` `{"target":9,"module":99,"jsx":2,"strict":true}`;
  programs `{"target":9,"module":99,"jsx":2,"strict":true,"moduleResolution":100}`.
- **Corpus:** seed `20261013`.

  | Size | Files | Marker modules | Hash |
  |---|---|---|---|
  | 200 | 200 | 19 | `d71d43b82aa0b3129cee6eb7208dc61b550f6e7c0f06940b287f882c02e7d24d` |
  | 1,000 | 1,000 | 99 | `f182534b130d6211e7064027d15a009166487eeff9fc73877d046fab335c8d04` |

- **Options** (`meta.options`, the harness defaults): `runs 5` per variant, interleaved; `sizes [200,1000]`;
  `edits 30`; `in-flight 8`; `loader-instances 1`; `decisionSize` 1000. Finished 2026-10-15T02:26:12Z (`meta.timestamp`, written at the end of the
  run); about 6 minutes wall-clock, approximate and not recorded in the JSON.
- **Run command**, from `packages/webpack-test`:

  ```bash
  pnpm perf:ts71 -- --out "$TMPDIR/ts71-full.json" > "$TMPDIR/ts71-full.log" 2>&1
  ```

## 3. Results per workload

Each cell is the median [min–max] over the 5 runs. The ratio is 7.1 / 6.0.3 of the medians; its range runs from
7.1 min / 6.0.3 max to 7.1 max / 6.0.3 min. The 5.7.3 and 6.0.3 columns are the plan's workload (d): the same
workloads in process. The decision rule reads the 1,000-module tables only.

#### 200 modules

**(a) cold start, ms (spawn or load + first transpileModule)**

| Metric | 5.7.3 (d) | 6.0.3 (d) | 7.1 | 7.1 / 6.0.3 | ratio range |
|---|---|---|---|---|---|
| cold start | 121 [119–131] | 121 [113–124] | 44 [42–48] | 0.362 | 0.335–0.424 |
| of which load | 97 [94–106] | 96 [90–98] | 32 [31–36] | 0.338 | 0.312–0.404 |

**(b) per-file transpileModule, warm pass, ms per file (judged)**

| Metric | 5.7.3 (d) | 6.0.3 (d) | 7.1 | 7.1 / 6.0.3 | ratio range |
|---|---|---|---|---|---|
| median per file | 0.767 [0.651–0.790] | 0.694 [0.647–0.846] | 0.278 [0.251–0.336] | 0.401 | 0.296–0.519 |
| p95 per file | 4.300 [3.913–4.552] | 4.090 [3.680–7.643] | 1.391 [1.291–1.459] | 0.340 | 0.169–0.397 |
| pass total | 273 [245–276] | 247 [242–359] | 91 [84–103] | 0.369 | 0.233–0.424 |

**(b) per-file transpileModule, cold pass, ms per file (unjudged)**

| Metric | 5.7.3 (d) | 6.0.3 (d) | 7.1 | 7.1 / 6.0.3 | ratio range |
|---|---|---|---|---|---|
| median per file | 0.964 [0.932–1.054] | 0.936 [0.911–1.015] | 0.296 [0.267–0.331] | 0.316 | 0.263–0.364 |
| pass total | 380 [363–394] | 359 [353–384] | 95 [91–102] | 0.265 | 0.237–0.289 |

**(c) createProgram + per-file semantic check and emit, cold, ms**

| Metric | 5.7.3 (d) | 6.0.3 (d) | 7.1 | 7.1 / 6.0.3 | ratio range |
|---|---|---|---|---|---|
| total | 751 [731–796] | 752 [686–901] | 161 [149–190] | 0.214 | 0.165–0.277 |
| ↳ createProgram | 168 [157–182] | 175 [159–253] | 32 [30–35] | 0.180 | 0.118–0.217 |
| ↳ check, per file | 0.837 [0.787–0.883] | 0.756 [0.719–0.830] | 0.168 [0.148–0.210] | 0.223 | 0.178–0.292 |
| ↳ emit, per file | 0.328 [0.314–0.348] | 0.298 [0.257–0.303] | 0.178 [0.154–0.249] | 0.598 | 0.507–0.968 |
| check + emit, per file | 1.182 [1.138–1.245] | 1.065 [1.041–1.138] | 0.342 [0.305–0.459] | 0.321 | 0.268–0.441 |
| check + emit, p95 per file | 9.885 [8.564–11.005] | 9.876 [9.401–10.238] | 2.539 [2.046–2.686] | 0.257 | 0.200–0.286 |
| semantic diagnostics | 5 | 5 | 5 | | |

**(e) watch rebuild, ms per edit (30 edits)**

| Metric | 5.7.3 (d) | 6.0.3 (d) | 7.1 | 7.1 / 6.0.3 | ratio range |
|---|---|---|---|---|---|
| judged (websmith's host, re-parses every file) | 169.28 [162.57–171.52] | 190.47 [185.95–195.61] | 1.38 [1.19–1.52] | 0.007 | 0.006–0.008 |
| unjudged: in process with a SourceFile-caching host | 5.00 [4.71–5.47] | 3.61 [3.42–3.88] | n/a | 0.382 | 0.308–0.443 |

**(f) throughput, modules/s (ratio: 7.1 with 8 in flight / 6.0.3 sequential)**

| Metric | 5.7.3 (d) | 6.0.3 (d) | 7.1 | 7.1 / 6.0.3 | ratio range |
|---|---|---|---|---|---|
| sequential | 812 [713–847] | 800 [710–834] | 1475 [1201–1547] | 1.844 | 1.439–2.178 |
| 8 in flight | n/a | n/a | 2112 [1833–2163] | 2.641 | 2.196–3.046 |

#### 1,000 modules (judged size)

**(a) cold start, ms (spawn or load + first transpileModule)**

| Metric | 5.7.3 (d) | 6.0.3 (d) | 7.1 | 7.1 / 6.0.3 | ratio range |
|---|---|---|---|---|---|
| cold start | 119 [116–126] | 120 [114–123] | 43 [41–149] | 0.361 | 0.337–1.306 |
| of which load | 95 [92–101] | 96 [90–97] | 32 [31–34] | 0.332 | 0.316–0.375 |

**(b) per-file transpileModule, warm pass, ms per file (judged)**

| Metric | 5.7.3 (d) | 6.0.3 (d) | 7.1 | 7.1 / 6.0.3 | ratio range |
|---|---|---|---|---|---|
| median per file | 0.663 [0.589–0.693] | 0.632 [0.591–0.731] | 0.302 [0.283–0.386] | 0.478 | 0.387–0.653 |
| p95 per file | 4.035 [3.631–4.361] | 3.745 [3.543–4.799] | 1.603 [1.565–1.843] | 0.428 | 0.326–0.520 |
| pass total | 1207 [1098–1287] | 1142 [1106–1389] | 507 [477–592] | 0.444 | 0.344–0.535 |

**(b) per-file transpileModule, cold pass, ms per file (unjudged)**

| Metric | 5.7.3 (d) | 6.0.3 (d) | 7.1 | 7.1 / 6.0.3 | ratio range |
|---|---|---|---|---|---|
| median per file | 0.733 [0.717–0.817] | 0.734 [0.682–0.833] | 0.322 [0.278–0.430] | 0.439 | 0.333–0.631 |
| pass total | 1368 [1356–1490] | 1372 [1300–1569] | 523 [477–669] | 0.381 | 0.304–0.515 |

**(c) createProgram + per-file semantic check and emit, cold, ms**

| Metric | 5.7.3 (d) | 6.0.3 (d) | 7.1 | 7.1 / 6.0.3 | ratio range |
|---|---|---|---|---|---|
| total | 2540 [2423–2704] | 2367 [2211–2490] | 809 [776–845] | 0.342 | 0.312–0.382 |
| ↳ createProgram | 354 [335–414] | 360 [340–405] | 69 [62–73] | 0.192 | 0.153–0.215 |
| ↳ check, per file | 0.567 [0.554–0.621] | 0.560 [0.484–0.576] | 0.180 [0.164–0.197] | 0.321 | 0.285–0.408 |
| ↳ emit, per file | 0.292 [0.288–0.321] | 0.252 [0.218–0.271] | 0.188 [0.171–0.199] | 0.746 | 0.633–0.911 |
| check + emit, per file | 0.870 [0.864–0.968] | 0.820 [0.721–0.858] | 0.368 [0.338–0.393] | 0.449 | 0.395–0.545 |
| check + emit, p95 per file | 7.959 [7.585–8.584] | 7.232 [6.661–7.505] | 2.799 [2.777–2.967] | 0.387 | 0.370–0.445 |
| semantic diagnostics | 5 | 5 | 5 | | |

**(e) watch rebuild, ms per edit (30 edits)**

| Metric | 5.7.3 (d) | 6.0.3 (d) | 7.1 | 7.1 / 6.0.3 | ratio range |
|---|---|---|---|---|---|
| judged (websmith's host, re-parses every file) | 524.75 [492.75–526.30] | 541.37 [531.48–542.14] | 2.18 [2.01–2.25] | 0.004 | 0.004–0.004 |
| unjudged: in process with a SourceFile-caching host | 9.19 [7.28–9.92] | 5.91 [4.78–6.68] | n/a | 0.369 | 0.302–0.471 |

**(f) throughput, modules/s (ratio: 7.1 with 8 in flight / 6.0.3 sequential)**

| Metric | 5.7.3 (d) | 6.0.3 (d) | 7.1 | 7.1 / 6.0.3 | ratio range |
|---|---|---|---|---|---|
| sequential | 762 [554–779] | 757 [538–826] | 1501 [1141–1556] | 1.982 | 1.380–2.894 |
| 8 in flight | n/a | n/a | 1922 [1713–2027] | 2.538 | 2.073–3.769 |

## 4. IPC payload per file

From an untimed 7.1 pass of (b) with `collectTiming`, MessagePack-framed JSON on the sync client; source text is
sent per call.

| Size | Bytes sent | Bytes received | Server ms | Transport overhead ms | Round trip ms | Mean source bytes | Requests |
|---|---|---|---|---|---|---|---|
| 200 | 2,791 | 1,794 | 0.416 | 0.040 | 0.456 | 2,464 | 200 |
| 1,000 | 3,306 | 2,132 | 0.458 | 0.036 | 0.494 | 2,961 | 1,000 |

## 5. Transformer probe

```json
{"version":"7.1.0-dev.20261013.1","runtime":"ignored","typeCheck":[2353],"tscOutput":"…/ts71-transformer-probe.mts(7,5): error TS2353: Object literal may only specify known properties, and 'transformers' does not exist in type 'TranspileOptions'."}
```

(`tscOutput` shortened at the temp-directory path; the full string is in the JSON.) The 7.1 nightly ignores a
`before` transformer at runtime, and its own typings reject the `transformers` field with TS2353. In (b) the
`before` transformer rewrote 99/99 marker modules on 5.7.3 and 6.0.3 in process, and 0/99 on 7.1 (19/19 and 0/19
at size 200).

## 6. Decision rule, every threshold with its measured value

At 1,000 modules, 7.1 against in-process 6.0.3, from `decision[]` in the committed JSON:

| Criterion | Plan threshold | Measured value | Status |
|---|---|---|---|
| 1. (b) 7.1 median per-file `transpileModule` vs 6.0.3 in process | at most 1.5x | 0.478 (7.1 0.302 ms vs 6.0.3 0.632 ms) | met |
| 2. workload (c) vs 6.0.3 | at most 2x | 0.342 (7.1 808.530 ms vs 6.0.3 2367.197 ms) | met |
| 3. workload (e) median per edit vs 6.0.3 | at most 2x | 0.004 (7.1 2.180 ms vs 6.0.3 541.370 ms; unjudged 6.0.3 with a SourceFile-caching host 5.905 ms) | met |
| 4. 7.1 p95 at most 3x its own median in (b) and (c) | at most 3x | 7.609 = max of (b warm) 5.301 and (c per file) 7.609 | **not met** |
| 5. throughput with 8 in flight (f) vs in-process 6.0.3 | at least 1/1.5 (0.667) | 2.538 (7.1 1921.782 vs 6.0.3 757.163 modules/s) | met |
| 6. cold start (a): above 1 s it counts as cost x loader instances, against speed only above 2 s | ≤ 1 s not counted; else cost x instances ≤ 2,000 ms | 43 ms x 1 loader instance (below 1 s) | met |
| **3C**: shipped in a released 7.x with a documented phase that accepts `before`-style transformers | released 7.x | not shipped: no 7.1 beta or release on npm; the nightly has no `transformers` in `TranspileOptions` (TS2353) and ignores it at runtime | **not met** |
| **Speed**: all six criteria met | all six | criterion 4 not met | **not met** |

Chosen row of the plan's table:

> | not met | any | stay on A; record "IPC cost blocks per-file emit"; re-run only when the 7.x API adds in-process or batched emit |

Criterion 4 is the only criterion that failed; criteria 1–3 and 5 are met with wide margins.

## 7. Status on the run date (2026-10-15)

- **3C.** microsoft/TypeScript#63875 ("API feature roadmap") is closed since 2026-10-09T18:37:42Z as completed,
  pointing to microsoft/TypeScript#64709 ("API status as of 7.1 beta, versioning/compatibility plan ahead"), which
  is open, last updated 2026-10-09, with no comments. #64709 drops the `/unstable` prefix (`typescript/sync`,
  `typescript/async`), calls the APIs "stable and forward-compatible", says watch, incremental and solution-builder
  APIs "will not land as stable in 7.1", and says missing utility APIs are being triaged. It does not mention
  custom transformers. #63875 had described 3C as a post-emit AST round trip (JS emit fetched as a `SourceFile`,
  transformed client-side, sent back for final emit), costed at 2 dev-weeks. Neither the pinned nightly nor
  `7.1.0-dev.20261014.1` has a `transformers` field in `TranspileOptions`. npm dist-tags: `latest` `7.0.2`, `next`
  `7.1.0-dev.20261014.1`, `rc` `7.0.1-rc`, `beta` `6.0.0-beta`: there is no 7.1 beta or release.
- **ts-loader#1704** ("Support TypeScript 7.1 API"): open, draft, last updated 2026-10-10T10:20:11Z, not merged.
  Its description says `getCustomTransformers` (with `resolveModuleName` and `resolveTypeReferenceDirective`) is
  "still accepted for backwards compatibility but [is] now inert - the native API doesn't expose equivalent
  extension points". Its own macOS benchmark (2026-10-04) shows a non-`transpileOnly` cold build +16.8 % and a
  `transpileOnly` cold build −33.5 % against ts-loader on TS 6. That is context only: it times a whole webpack
  build, not the API calls this harness times.

## 8. Caveats

- **(c) type-check symmetry.** Both sides time a `getSemanticDiagnostics` per file before its emit
  (`typeCheckedPass`, `ts71-bench.cjs:315-336`; in process `:373`, 7.1 `:510`). `summary["1000"].c[*]
  .semanticDiagnostics` is 5 for 5.7.3, 5 for 6.0.3 and 5 for 7.1 (also 5/5/5 at size 200), so the variants checked
  the same thing. Residual: the native server may check on several threads, and its `createProgram` may defer work
  to the first check, so `createProgram`, check and emit are reported separately (section 3): 7.1's `createProgram`
  is 0.192x of 6.0.3's, its check 0.321x, its emit 0.746x.
- **(e) the judged baseline re-parses.** The judged in-process row uses `ts.createCompilerHost(PROGRAM_OPTIONS,
  true)` (`ts71-bench.cjs:381`), the host websmith's `Compiler.createProgram` passes with `oldProgram`
  (`packages/core/src/compiler/Compiler.ts:1066-1071` → `createCompileHost`,
  `packages/core/src/environment/compile-service.ts:23-25`). It caches no `SourceFile`, so every edit re-parses all
  corpus and lib files. Judged ratio 0.004; against the unjudged SourceFile-caching host (`:414-429`,
  `perEditCachedHost`, 6.0.3 5.91 ms) the 7.1 / 6.0.3 ratio is 0.369 (range 0.302–0.471). About 535 of 6.0.3's 541
  ms per edit (99 %) is re-parsing that websmith could remove in process with a caching host. Both sides time an
  `fs.writeFileSync` of the edited file inside the measured region (`:397`, `:526`), a small constant that is the
  same on both sides.
- **Child config.** The harness passes the child config by file (`--child <file>`, `spawnChild`,
  `ts71-bench.cjs:661`), so it is not limited by `ARG_MAX`; this run was on macOS anyway. No
  `$TMPDIR/websmith-ts71-child-*` directory was left behind.
- **Criterion 4 and module sizes.** The in-process variants have the same shape: 6.0.3's own p95 / median is 5.925
  (b warm) and 8.819 (c per file), 5.7.3's 6.084 and 9.144. The corpus draws module sizes from websmith's own
  line-count histogram, so the per-file p95 reflects the larger modules as well as IPC jitter. The rule judges 7.1
  alone, as printed.
- **Load and contention.** The fleet was running other agents on this machine. The run started when the 1-minute
  load fell below the core count (9.18 at start; 8.60 at end), but the 5- and 15-minute loads (18.00, 18.45) show
  heavy use just before. No other benchmark ran in this worktree during the run.
- **One machine:** macOS, arm64, Apple M1 Max, one Node (22.17.0), one corpus.
- **A nightly, not a release:** `typescript@7.1.0-dev.20261013.1`.
- **API calls, not websmith end to end:** the harness compares the API calls directly (the bench slice's decision),
  not a websmith or webpack build.
- **(b) is judged warm, (c) cold.**
- **Not measurable:** no workload reported `not measurable`.

## 9. Deviations from the plan's wording

- **(c) includes per-file semantic checks.** The plan says "one `createProgram` plus `getJavaScriptEmit` per file".
  7.1's `getJavaScriptEmit` emits without type-checking, while the in-process `program.emit` checks through its emit
  resolver; the harness adds a `getSemanticDiagnostics` per file on both sides (`ts71-bench.cjs:315-336`, fix
  `3fe1cac5` in #190) so the two sides do the same work.
- **Criterion 4 uses (c) check + emit per file** (`perFile`, `perFileP95`) for its (c) part, for the same reason.
- **The (e) cached-host row is unjudged** (`ts71-bench.cjs:414-429`). The judged row keeps websmith's real host so
  the rule measures what websmith does today.
- **`Compiler.ts:1089` is now `:1458`.** The fast path's `ts.transpileModule(…, { transformers:
  ctx.getTransformers() })` is in `Compiler.transpileSourceCode` at `packages/core/src/compiler/Compiler.ts:1458`;
  the cached program with `oldProgram` is in `Compiler.createProgram` at `:1066-1071`.
- **#63875 was superseded by #64709**, see section 7.
- **`analysis-ts7-api-gap.md:86-88` is stale.** Its `unstable/*` entry points are now `typescript/sync` and
  `typescript/async` (since `7.1.0-dev.20261009.1`). Not corrected in this slice.

## 10. Reproduce

```bash
mkdir -p "$TMPDIR/pnpm-shim" && printf '#!/bin/sh\nexec corepack pnpm@10.8.0 "$@"\n' > "$TMPDIR/pnpm-shim/pnpm" && chmod +x "$TMPDIR/pnpm-shim/pnpm"
export PATH="$TMPDIR/pnpm-shim:$HOME/.nvm/versions/node/v22.17.0/bin:$PATH" COREPACK_ENABLE_NETWORK=0 COREPACK_ENABLE_STRICT=0 NX_DAEMON=false
pnpm install --frozen-lockfile --offline
cd packages/webpack-test
pnpm perf:ts71 -- --out "$TMPDIR/ts71-full.json" > "$TMPDIR/ts71-full.log" 2>&1
```

The committed JSON is the full result with the raw per-call `durations` arrays removed (from the repository root):

```bash
node -e 'const fs=require("fs");const j=JSON.parse(fs.readFileSync(process.argv[1]));for(const r of j.runs)for(const w of Object.values(r.results))for(const v of Object.values(w))if(v&&typeof v==="object"&&Array.isArray(v.durations))delete v.durations;fs.writeFileSync(process.argv[2],JSON.stringify(j,null,2)+"\n")' "$TMPDIR/ts71-full.json" docs/stories/ts7-rearchitecture/analysis-ts71-measurement.json
```

Full JSON: 3,228,783 bytes, sha256 `11091bed1d001658d313eea9df65cdef0fa40e6fe090bc7b2026f23e6ee56ee3` (not
committed). Committed JSON: 102,116 bytes.

For the next run at a newer nightly, follow "Re-pinning" in the header comment of `ts71-bench.cjs` (`:66-77`).
