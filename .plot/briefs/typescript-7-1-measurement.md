<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — typescript-6-support (slice: 7.1 measurement)

- **Plan (canonical):** `docs/plans/2026-10-02-typescript-6-support.md` on `develop`. Read the slice line (`:318`)
  and the **Spike** bullet under Design → Approach (`:214-250`), including the decision rule and its three-row table
  (`:236-250`). This brief turns them into one run, one report and two story edits.
- **Approved:** 2026-10-02, Jan Wloka, plan-PR #144 merged
- **Branch:** `docs/typescript-7-1-measurement` (base: `develop`, at `6f6a581a` when this brief was written)
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh` (on PATH). Do not merge it yourself.
- **Review of the result:** an independent review of the report against the JSON, plus uncached gates run by the
  maintainer's session before merge

**Ordering.** This slice waits on `infra/typescript-7-1-bench`, which merged as #190 (merge commit
**`f7b7dd9c`**, head `535c4752`). Nothing waits on this slice. Toolchain (#166), CI leg (#171), fixtures (#183),
websmith-node (#184), own compilations (#189) and the last fixture (#194) are merged. The harness installs its own
pinned TypeScript versions, so no other slice of this plan changes what you measure. That includes the peer-range
slice, which moves the workspace pin.

Line numbers are from `develop` at `6f6a581a`. If lines have moved, find the code by name.

### What changed on `develop` since the plan was approved (verified 2026-10-15)

- **The harness exists and runs.** `packages/webpack-test/perf/ts71-bench.cjs` (986 lines) is the entry point, run
  through `"perf:ts71": "node perf/ts71-bench.cjs"` (`packages/webpack-test/package.json:16`). It needs only Node
  built-ins and npm. The other files are `ts71-corpus.cjs`, `ts71-transformer-probe.cjs`, `ts71-versions.json` and
  `ts71-versions.lock.json` in the same directory. The run commands and the "Re-pinning" procedure are in its header
  comment (`ts71-bench.cjs:7-80`).
- **The nightly is `typescript@7.1.0-dev.20261013.1`, not `@typescript/native-preview`.** It is installed with
  `npm ci --ignore-scripts` from the committed lockfile into `$TMPDIR/websmith-ts71-versions-979483494c62`, which is
  outside the repository. The pins, as the smoke run printed them on 2026-10-15:

  | Alias | Package | Integrity |
  |---|---|---|
  | `ts573` | `typescript@5.7.3` | `sha512-84MVSjMEHP+FQRPy3pX9sTVV/INIex71s9TL2Gm5FG/WG1SqXeKyZ0k7/blY/4FdOzI12CBy1vGc4og/eus0fw==` |
  | `ts603` | `typescript@6.0.3` | `sha512-y2TvuxSZPDyQakkFRPZHKFm+KKVqIisdg9/CZwm9ftvKXLP8NRWj38/ODjNbr43SsoXqNuAisEf1GdCxqWcdBw==` |
  | `ts71` | `typescript@7.1.0-dev.20261013.1` | `sha512-wEt6fQCqhZ3hrbIUaO2LS7d94FSzH+xGP+/KJCxFNFHQiG/W2L0rJ/1B7lAQv6VKntlmjWuzYQ8LABuLZ3W/sg==` |
  | (binary) | `@typescript/typescript-darwin-arm64@7.1.0-dev.20261013.1` | `sha512-V22DvbTQjg6kMEqU5hhZmxhZqTNdbwNz3YB1CULEtxH7gxMxPvFpMM5rbJQgZlhabo0DxvsFfTdUNjOTr4IPIQ==` |

  On 2026-10-15 the registry still serves `7.1.0-dev.20261013.1` with this integrity. The dist-tags are `latest`
  `7.0.2` and `next` `7.1.0-dev.20261014.1`. **There is no 7.1 beta or release on npm** (`beta` is still `6.0.0-beta`
  and `rc` is `7.0.1-rc`). **Measure the committed pin. Do not re-pin to a newer nightly** (see "If something fails").
- **The plan's 3C reference has moved.** microsoft/TypeScript#63875 ("API feature roadmap") was **closed on
  2026-10-09** as completed, with "updated status in #64709". microsoft/TypeScript#64709 ("API status as of 7.1 beta,
  versioning/compatibility plan ahead", open, created 2026-10-09) says the following:
  - the `/unstable` prefix is dropped (`typescript/sync`, `typescript/async`);
  - the APIs are believed "stable and forward-compatible";
  - watch, incremental and solution-builder APIs "will not land as stable in 7.1";
  - missing utility APIs are being triaged.

  It **does not mention custom transformers.** #63875 had described 3C as a post-emit AST round trip ("fetching the
  JS emit as a SourceFile (AST), running custom transformations client-side, and sending the transformed AST back to
  the server for final emit"), costed at 2 dev-weeks. Neither the pinned nightly nor `7.1.0-dev.20261014.1` has a
  `transformers` field in `TranspileOptions` (`dist/api/sync/api.d.ts:64-68` of the 20261014 tarball). Report both
  issue numbers.
- **ts-loader#1704 ("Support TypeScript 7.1 API") is an open draft.** It was last updated 2026-10-10, when it moved
  its imports off `/unstable` after #64709. Its description says `getCustomTransformers` is "accepted for backwards
  compatibility but [is] now inert". Its macOS benchmark (2026-10-04, `github-actions`) shows a non-`transpileOnly`
  cold build +16.8 % and a `transpileOnly` cold build −33.5 % against ts-loader on TS 6. Cite that as context only:
  it measures a whole webpack build, not the API calls this harness times.
- **websmith's call sites moved since the plan.** The plan's decision rule cites `Compiler.ts:1089`. The fast path's
  `transpileModule` with `transformers: ctx.getTransformers()` is now at `packages/core/src/compiler/Compiler.ts:1458`.
  The cached program with `oldProgram` is at `:1066-1071`, and its host is `createCompileHost`
  (`packages/core/src/environment/compile-service.ts:23-25`, which is `ts.createCompilerHost(tsConfig, true)`). Cite
  these lines in the report, not the plan's.
- **The story's open question names a branch that never existed.** `STORY-ts7-rearchitecture.md:78-79` says the IPC
  cost is "measured by the spike slice of `typescript-6-support` (`infra/typescript-7-1-spike`)". The spike was split
  into `infra/typescript-7-1-bench` (#190) and this slice. Replace the name when you update that line.
- **The harness measures (c) differently from the plan's wording, by design** (PR #190 review fixes, commits
  `3fe1cac5`, `535c4752`, `7c165808`). See the caveats below. The plan text stays as it is. The report states the
  deviation.

### The three harness caveats: verified on `develop`, and what the report says

The maintainer's review of #190 named three caveats. All three were addressed before the merge. The report states
each one as follows.

- **(c) Type-check asymmetry: fixed, with a residual to state.**
  - Before `3fe1cac5`, 7.1's `getJavaScriptEmit` emitted without type-checking. The in-process `program.emit`
    checks through its emit resolver.
  - Now `typeCheckedPass` (`ts71-bench.cjs:315-336`) times a `getSemanticDiagnostics` per file before the emit, on
    both sides: `:373` in process, `:510` on 7.1. Criterion 2 is "createProgram + per-file checks and emits".
    Criterion 4's (c) part uses check + emit per file.
  - The smoke run reports `5 semantic diagnostics` for each of 5.7.3, 6.0.3 and 7.1 at size 20.
  - **In the report:**
    1. Quote `summary["1000"].c[<variant>].semanticDiagnostics` for all three variants. If they differ, say so
       prominently: the variants then did not check the same thing, and criterion 2 is not like for like. Still
       apply the rule as printed.
    2. Name the residual: the native server may check on several threads, and its `createProgram` may defer work to
       the first check. So report `createProgram`, check and emit separately, as the summary already does.
    3. State that (c) deviates from the plan's wording ("`createProgram` plus `getJavaScriptEmit` per file"), and why.
- **(e) The judged baseline is re-parsing: still true by design, and mitigated.**
  - The judged in-process row uses `ts.createCompilerHost(PROGRAM_OPTIONS, true)` (`ts71-bench.cjs:381`). That is
    what websmith's `Compiler.createProgram` passes with `oldProgram` (`Compiler.ts:1066-1071`). It caches no
    `SourceFile`, so each edit re-parses every corpus file and the lib files.
  - The unjudged row repeats the edits with a caching host (`:413-429`). Its JSON key is
    `summary[size].e["6.0.3"].perEditCachedHost`, and decision line 3 prints it as
    `unjudged: 6.0.3 with a SourceFile-caching host`.
  - Smoke run at size 20: 6.0.3 178.9 ms/edit judged, 5.9 ms/edit with the cached host, 7.1 2.2 ms/edit.
  - **In the report:**
    1. Give criterion 3 as judged, which the rule requires.
    2. Beside it, give the unjudged 7.1 / cached-host ratio.
    3. Say in one sentence how much of the judged gap is re-parsing that websmith could remove in process.
    4. Note that both sides time an `fs.writeFileSync` of the edited file inside the measured region (`:397`,
       `:526`). It is a small constant, and it is the same on both sides.
- **Child config environment variable too big for Linux (ARG_MAX / E2BIG): fixed.**
  - Since `7c165808`, `spawnChild` (`ts71-bench.cjs:659-680`) writes the child config to a `mkdtemp` file, passes it
    as `--child <file>`, and removes the directory in a `finally`. At 1,000 modules the config is about 220 KB. Only
    a path, `TS71_VERSIONS_DIR` (`:686`), still goes through the environment, to the probe.
  - **In the report:** one line saying the harness passes the child config by file, so it is not limited by
    `ARG_MAX`, and that this run was on macOS anyway.
  - After the run, check that no `$TMPDIR/websmith-ts71-child-*` directory is left behind. None was after the smoke
    run.

### Current state (smoke run, 2026-10-15)

I ran the harness on a detached worktree at `6f6a581a`:

- Node 22.17.0 and pnpm 10.8.0 through the corepack shim;
- `pnpm install --frozen-lockfile --offline`, then `pnpm build --skip-nx-cache` (green, 10 projects);
- the command, from `packages/webpack-test`:

  ```bash
  pnpm perf:ts71 -- --sizes 20 --runs 1 --edits 3 --out <scratch>/smoke.json
  ```

The run passed: exit 0 in about 6 s. Because of `--` the pnpm script passes a bare `--`, which `parseOptions`
ignores. The run did the following:

- it reinstalled the versions directory (`"installed":true`) and verified all four integrities;
- it printed `PROBE {"version":"7.1.0-dev.20261013.1","runtime":"ignored","typeCheck":[2353],…}`;
- it printed corpus hash `741a3215…d892f` for size 20, seed `20261013`, the same as in #190;
- it printed all six decision lines and `RESULT <path>`.

Decision at size 20, a dry-run size that the rule does not read. Criterion 4 fails at this size because with 20
samples the first call dominates p95:

```
  1 (b) per-file transpileModule, warm, 7.1 / 6.0.3: 0.415 <= 1.5 met (7.1 0.460 vs 6.0.3 1.109)
  2 (c) createProgram + per-file checks and emits, 7.1 / 6.0.3: 0.152 <= 2 met (7.1 54.350 vs 6.0.3 356.837)
  3 (e) watch rebuild per edit, 7.1 / 6.0.3: 0.012 <= 2 met (7.1 2.215 vs 6.0.3 178.855; unjudged: 6.0.3 with a SourceFile-caching host 5.948)
  4 7.1 p95 / own median, max of (b warm) and (c per file): 4.115 <= 3 not met (b 3.511, c 4.115)
  5 (f) 7.1 throughput in flight / 6.0.3 sequential: 4.641 >= 0.667 met (7.1 1998.934 vs 6.0.3 430.703)
  6 (a) 7.1 cold start ms (x loader instances above 1 s): 54 <= 2000 ms met (cold start 54 ms)
Speed: not met
```

The load average was **64 at the start** of the smoke run: the fleet was busy on this 10-core machine. See
"Machine quiet" below.

**JSON shape (`schema: "websmith-ts71-bench/1"`)** — what the report reads:

- `meta`:
  - `machine`: `platform`, `arch`, `release`, `cpu`, `cpus`, `totalMemBytes`, `loadavgStart`, `loadavgEnd`,
    `power`;
  - `node`: `version`, `v8`, `execPath`;
  - `git`: `head`, and `perfDirty`, which must be `false`;
  - `versions`: `ts573` / `ts603` / `ts71` with `version` and `integrity`, `binary`, `ipc`, `compilerOptions`,
    `programOptions`, `installed`;
  - also `options`, `corpus` (per size: `hash`, `seed`, `files`, `markerFiles`), `decisionSize` and `timestamp`.
- `summary[size][workload][variant]`, each value a `{ median, min, max, runs }` object:
  - `a`: the stats object, plus `loadMs`;
  - `b`: `warm`, `cold`, `warmP95`, `warmTotal`, `coldTotal`, `transformersApplied`, `markerModules`,
    `transformedWarm`;
  - `c`: `total`, `createProgram`, `check`, `emit`, `perFile`, `perFileP95`, `semanticDiagnostics`;
  - `e`: `perEdit`, plus `perEditCachedHost` in process;
  - `f`: `sequentialPerSecond`, plus `concurrentPerSecond` and `inFlight` on 7.1.
  - A workload that could not run has `status: "not measurable"` and a `reason`.
- `ipc[size]`: `bytesSentPerFile`, `bytesReceivedPerFile`, `serverMsPerFile`, `transportOverheadMsPerFile`,
  `roundTripMsPerFile`, `meanSourceBytesPerFile`, `totals`.
- `probe`: `version`, `runtime`, `typeCheck`, `tscOutput`.
- `decision[]`: `criterion`, `metric`, `value`, `threshold`, `status`, plus details such as `native`, `baseline`,
  `baselineCachedHost`, `bWarm`, `cPerFile`, `coldStartMs` and `loaderInstances`.
- `runs[]`: `variant`, `size`, `round`, `mode`, `results.{a,b,c,e,f}`, with raw `durations` arrays per call.

Size: a run with `--sizes 200 --runs 1` gave an 80 KB JSON. Expect about 2–3 MB at the defaults, almost all of it
`durations`.

### What to do

1. **Set up** (the worktree is yours; never build in the main checkout):

   ```bash
   mkdir -p "$TMPDIR/pnpm-shim" && printf '#!/bin/sh\nexec corepack pnpm@10.8.0 "$@"\n' > "$TMPDIR/pnpm-shim/pnpm" && chmod +x "$TMPDIR/pnpm-shim/pnpm"
   export PATH="$TMPDIR/pnpm-shim:$HOME/.nvm/versions/node/v22.17.0/bin:$PATH" COREPACK_ENABLE_NETWORK=0 COREPACK_ENABLE_STRICT=0 NX_DAEMON=false
   pnpm install --frozen-lockfile --offline
   ```

   - pnpm 10.34 refuses this lockfile (`ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`), and Homebrew's pnpm 11 fails with E401.
     Use the shim.
   - Never edit `pnpm-lock.yaml`, `~/.npmrc` or the root `package.json`.
   - The harness installs its pins itself, with an empty user config.
2. **Machine quiet.** The rule's thresholds sit far apart, but the p95 criterion is sensitive to contention.
   - Before the run, read `sysctl -n vm.loadavg`. Start when the 1-minute load is below the CPU count (10 on this
     Apple M1 Max).
   - Poll every 5 minutes for up to 60 minutes. If the load never drops, run anyway and state the load in the
     report's caveats.
   - Do not run gates, builds or tests in your worktree during the run.
   - The machine must be on AC power. The harness records `pmset`.
3. **The full run, once, at the harness defaults, on Node 22.17.0:**

   ```bash
   cd packages/webpack-test
   pnpm perf:ts71 -- --out "$TMPDIR/ts71-full.json" 2>&1 | tee "$TMPDIR/ts71-full.log"
   ```

   - The defaults are the plan's: `--runs 5` per variant, interleaved; `--sizes 200,1000`; `--edits 30`;
     `--in-flight 8`; seed `20261013`; `--loader-instances 1`. Do not change any of them.
   - `--loader-instances` only matters if the cold start exceeds 1 s. The smoke run's was 54 ms.
   - Expect tens of minutes. The in-process (e) at 1,000 modules re-parses the whole corpus per edit. Run it in the
     background with a generous timeout of at least 2 h, and do not interrupt it.
   - Node 24 is not part of this slice. One Node, one machine, one corpus, as the plan says.
   - Before the run, `git status --porcelain` must be clean. After it, `meta.git.head` must equal your branch's base
     commit and `meta.git.perfDirty` must be `false`.
4. **No cherry-picking.** The decision rule was "fixed before the run so the recommendation cannot be fitted to the
   numbers" (plan `:282-283`).
   - The first complete run is the result.
   - A second complete run is allowed only when the first is invalid for a reason you name before you look at its
     decision. Valid reasons are: the machine went to battery or sleep, another process was benchmarking, or
     `perfDirty` was true.
   - If you do a second run, report both and judge the second.
5. **Re-check 3C and ts-loader#1704 on the run date** and record what you find with the date:

   ```bash
   gh issue view 63875 -R microsoft/TypeScript --json state,closedAt
   gh issue view 64709 -R microsoft/TypeScript --json state,updatedAt,body,comments
   gh pr view 1704 -R TypeStrong/ts-loader --json state,isDraft,updatedAt,mergedAt,body
   NPM_CONFIG_USERCONFIG=<empty file> npm view typescript dist-tags --registry=https://registry.npmjs.org/
   ```

   The values as of 2026-10-15 are in "What changed" above. Only a released 7.x counts toward 3C: per the plan,
   "3C is met only when shipped in a released 7.x (not a nightly) with a documented phase that accepts
   `before`-style transformers".
6. **Write `docs/stories/ts7-rearchitecture/analysis-ts71-measurement.json`.** It is the run's JSON with the raw
   per-call arrays removed, so that the committed file stays small and diffable.

   ```bash
   node -e 'const fs=require("fs");const j=JSON.parse(fs.readFileSync(process.argv[1]));for(const r of j.runs)for(const w of Object.values(r.results))for(const v of Object.values(w))if(v&&typeof v==="object"&&Array.isArray(v.durations))delete v.durations;fs.writeFileSync(process.argv[2],JSON.stringify(j,null,2)+"\n")' "$TMPDIR/ts71-full.json" docs/stories/ts7-rearchitecture/analysis-ts71-measurement.json
   ```

   - Every summary, the decision, `meta`, `ipc`, `probe`, and each run's `calls` / `medianMs` / `p95Ms` / `maxMs` /
     `totalMs` remain.
   - In the report, give this command, plus the sha256 and byte size of the full file. A JSON file cannot carry a
     license header, and `license-config.json:33` ignores `.json`.
   - If the stripped file is still above 1 MB, say so in the PR. Do not commit the full file.
7. **Write `docs/stories/ts7-rearchitecture/analysis-ts71-measurement.md`.** Put the license header first, copied
   from `analysis-ts7-api-gap.md:1-6`, then `# TypeScript 7.1 API Measurement` and a line linking the story and the
   plan. It must contain, in this order:
   1. **Summary.** The Decisions row chosen, the line `Speed: met | not met`, 3C met or not met, and the run date.
      Three sentences at most.
   2. **Setup.**
      - Machine and Node, from `meta.machine` and `meta.node`: CPU model, core count, memory, OS release, power, and
        the load average at start and end.
      - The harness commit: **`f7b7dd9c`**, the merge commit of #190. Also the run's `meta.git.head`, and
        `perfDirty: false`.
      - The versions and integrities from `meta.versions`, including the platform binary, as a table like the one
        above.
      - The IPC encodings: MessagePack-framed JSON on the sync client for (a)–(e), JSON-RPC on the async client for
        (f).
      - The compiler options in numeric-enum form, the corpus hash and file count per size, and the seed.
      - The exact run command.
   3. **Results per workload.** Give one table per workload — (a), (b) warm, (b) cold, (c), (e), (f) — for sizes 200
      and 1,000.
      - Columns: 5.7.3, 6.0.3 and 7.1, each as median [min–max]; the 7.1 / 6.0.3 ratio of medians; and the ratio's
        range from 7.1 min / 6.0.3 max to 7.1 max / 6.0.3 min.
      - For (f), the ratio is 7.1 in-flight over 6.0.3 sequential, and it also shows 7.1 sequential.
      - For (c), add `createProgram`, check and emit as sub-rows.
      - For (e), add the unjudged cached-host row.
      - Mark 1,000 as the judged size.
      - Name (d): the 5.7.3 and 6.0.3 columns are the plan's (d).
   4. **IPC payload per file** at both sizes: bytes sent and received, server ms, transport overhead ms, and the mean
      source bytes.
   5. **Transformer probe.** Quote the `PROBE` JSON, and say what it means: 7.1 ignores `before` transformers at
      runtime, and its own typings reject the field with TS2353. Give the marker-module count from (b), with
      in-process applied N/N and 7.1 0/N.
   6. **Decision rule, every threshold with its measured value.** The slice's test is that "the report cites the
      bench commit and every threshold of the rule with its measured value". Use one table:
      - Columns: criterion, plan threshold, measured value, status.
      - Rows: the six criteria from `decision[]` at size 1,000, as plan `:236-240` words them; criterion 4 with both
        its `bWarm` and `cPerFile` parts; criterion 6 with the 1 s / 2 s logic.
      - Then a row for **3C** with its status on the run date, and a row for **Speed**.
      - Then the chosen row of the plan's table (`:244-248`), quoted exactly.
   7. **Status on the run date.** 3C: #63875 closed, #64709 and what it says or omits about transformers, the
      `TranspileOptions` shape, and whether a 7.1 beta or release is on npm. ts-loader#1704: state, draft or not,
      last update, and its stance on `getCustomTransformers`.
   8. **Caveats.**
      - The three above: (c) with the diagnostic counts, (e) with the cached-host ratio, and the child config file.
      - Load and contention.
      - One machine, macOS, arm64.
      - A nightly, not a release.
      - The API calls are compared directly, not websmith end to end (the bench brief's decision).
      - (b) is judged warm, (c) cold.
      - Any `not measurable` workload, with its `reason`.
   9. **Deviations from the plan's wording.** List each with its reason, citing `develop` lines, not the plan's:
      - (c) includes per-file semantic checks;
      - criterion 4 uses (c) check + emit per file;
      - the (e) cached-host row is unjudged;
      - `Compiler.ts:1089` is now `:1458`;
      - #63875 was superseded by #64709.
   10. **Reproduce.** The setup and run commands, the JSON-strip command, the sha256 of the full JSON, and the
       "Re-pinning" pointer (`ts71-bench.cjs` header) for the next run.
8. **Apply the rule literally.** Read the six statuses from `decision[]`.
   - Speed is met when all six are met. A `not measurable` counts as not met.
   - Pick the row: Speed met and 3C met → "reopen B…"; Speed met and 3C not met → "stay on A; re-run the harness at
     the next 7.x minor"; Speed not met → "stay on A; record "IPC cost blocks per-file emit"; re-run only when the
     7.x API adds in-process or batched emit".
   - If Speed fails only on criterion 4 while every ratio is far inside its threshold, the row is still the "not
     met" row. You may add one sentence in the report naming which criterion failed. Do not reword the row, and do
     not argue around it.
9. **Update `docs/stories/ts7-rearchitecture/STORY-ts7-rearchitecture.md` in place.** Change only these lines:
   - `updated:` in the front matter (`:6`): the run date.
   - **Open point `:76-77`** (3C phase). Replace the "Checked by the spike slice…" wording with the dated answer: is
     it shipped, in which phase, #63875 → #64709, and the probe result. Link
     `analysis-ts71-measurement.md`. Use ✅ when the question as posed is answered for this run. Name the re-check
     trigger from the chosen row.
   - **Open point `:78-79`** (IPC cost). Replace it with the measured answer in one sentence: the judged ratios for
     (b), (c) and (e) at 1,000, and payload bytes per file. Drop the nonexistent branch name
     `infra/typescript-7-1-spike`, and link the analysis. Use ✅.
   - **Decisions table (`:87-92`).** Add one row below the 2026-10-02 row, in the table's three-column format:
     - `| <run date> |`;
     - the chosen row's text;
     - a rationale that names the rule, its six measured values with met/not met, 3C status, the nightly version,
       and the harness commit `f7b7dd9c`, ending `(decision rule of typescript-6-support, fixed 2026-10-02)`.
   - **Session Log:** append one dated entry, `### <run date> — 7.1 measurement`, with 2–4 lines and a
     **Key outcomes** list, matching the existing entries (`:139-184`).
   - Leave the story's `status: draft`, its phases and its other open points as they are.
10. **Commit** in Arlo's notation **without a colon** (`commit-notation` skill). This is documentation, so use a
    lowercase `d`:
    - `d Adds the TypeScript 7.1 measurement report and its result data`
    - `d Records the TypeScript 7.1 measurement decision in the ts7-rearchitecture story`
    - `d Links the 7.1 measurement slice to its pull request`

    End each commit message with the attribution lines your session gives you.
11. **Bookkeeping.**
    - Push the first real commit as soon as it exists.
    - Open the PR with `plot-open-pr.sh`, never `gh pr create`. Use a descriptive title, for example "TypeScript
      7.1 API measurement and decision". The wave heading alone reads "7.1 measurement".
    - Append ` → #<PR>` to the `docs/typescript-7-1-measurement` line in the plan's `## Slices` (`:318`), after the
      `<!-- builds: … -->` comment, as #190 did for `:314`. Commit that on this branch. This is the only plan edit
      allowed.
    - **PR body:**
      - the decision block printed by the full run, verbatim;
      - the chosen Decisions row;
      - the 3C / ts-loader#1704 status with the date;
      - the load average at start and end;
      - the sha256 of the full JSON;
      - any harness fix (see below);
      - the gate results;
      - a sentence saying there is no Jest test or e2e case because the slice adds no code. The plan's test for it is
        the report.

### If something fails

- **The pinned nightly is gone from the registry** (`npm ci` reports `E404`, `ETARGET` or `EINTEGRITY` on
  `typescript-7.1.0-dev.20261013.1`).
  - First retry once with a fresh `--versions-dir "$(mktemp -d)/v"`.
  - If it still fails, re-pin by following the `ts71-bench.cjs` header's "Re-pinning" steps 1–6 **exactly**, to the
    then-current `next`. Commit `ts71-versions.json` and `ts71-versions.lock.json` together as a separate
    `t Re-pins the TypeScript 7.1 nightly to <version>` commit.
  - Do the dry run first: `--sizes 20 --runs 1 --edits 3`. The probe must still print a result, and the exports
    must still include `./sync` and `./async`. Then do the full run.
  - Name the old and the new pin in the report and the PR.
  - If the new nightly changes an API shape the harness uses, stop and report blocked. Do not adapt the harness to a
    new API in this slice.
- **The harness throws** (exit ≠ 0, no `RESULT` line).
  - Read the error.
  - A `CorrectnessError` means a stale emit in (e), a wrong version, a wrong integrity, or a corpus hash that
    changed. It is a finding, not a defect to patch around. With a stale-versions-dir error, retry once with a fresh
    `--versions-dir`. Otherwise stop, keep the log, and report blocked with the message.
  - Any other crash: fix it only if it is a **harness defect that blocks the run**, with the smallest change.
    Commit it separately as `t Fixes <what> in the TypeScript 7.1 bench harness`. Show the before and after
    error in the PR under the heading "Harness fix". Then do a dry run (`--sizes 20 --runs 1 --edits 3`) before the
    full run.
  - Never change a threshold, a default option, a workload, the corpus, the decision logic or the output format.
    Never fix a non-blocking review nit from #190: temp-dir ownership, Windows `npm.cmd`, file size, `options2`
    naming, the `leafIndices` repeats.
- **A workload prints `not measurable`.** That is a result, not a failure. The rule counts it as not met. Quote its
  `reason` in the report.
- **The run is far slower than expected** (more than 2 h). Let it finish. Do not lower `--runs` or `--sizes`. If it
  must be killed, report blocked with the last `round …` lines.

### Done when

The slice line is the specification: the full run, and `analysis-ts71-measurement.md` with the following:

- per workload, the 7.1 / 6.0.3 ratio with min/max;
- machine, Node, nightly version and hash, and the harness commit;
- the transformer probe result;
- the 3C and ts-loader#1704 status on the run date;
- the story's two open questions (3C phase, IPC cost) updated in place;
- one dated Decisions row chosen by the decision rule.

Its test is that "the report cites the bench commit and every threshold of the rule with its measured value", and
that the Definition of Done is green. The plan adds: "The measurement slice is done when one of these rows is
recorded, not when the report exists" (`:250`).

A naive result would pass without these:

- **The run is the default run:** `meta.options` shows `runs 5`, `sizes [200,1000]`, `edits 30`, `in-flight 8` and
  `loader-instances 1`; `decisionSize` is 1000; `perfDirty` is false; and `meta.git.head` is your branch's base
  commit.
- **The report and the JSON agree.** Every number in the report's decision table equals `decision[]` in the
  committed JSON, rounded as printed. The reviewer will check this.
- **All six criteria, plus 3C, plus Speed, plus the quoted row** are in the threshold table. None is summarised as
  "all met".
- **The three caveats are stated** with their measured values: the diagnostic counts, the cached-host ratio, and the
  child-config line.
- **The 3C status names both #63875 (closed 2026-10-09) and #64709**, with the dist-tags on the run date.
- **License header** on the new `.md`, as the first lines. `pnpm license:add` covers `md` (`license-config.json:18`);
  run it and check that it changed nothing else. Do not touch the `license:check` list.
- **Gates, run after the measurement, not during it:** `pnpm lint`, `pnpm build --skip-nx-cache`,
  `pnpm test --skip-nx-cache` and `pnpm test:e2e --skip-nx-cache`, all green locally. The e2e gates may leave
  `test-output-*` importers in `pnpm-lock.yaml`; restore it with `git checkout -- pnpm-lock.yaml`. CI `dist (22)`
  and `dist (24)` must be green. Report the advisory 6.0.3 cell's result; do not fix it.
- **Nothing else changes:**
  - `git diff origin/develop --stat` shows only the Scope-guard files;
  - `git diff origin/develop -- pnpm-lock.yaml packages/` is empty, unless a harness fix or re-pin was needed and is
    named in the PR;
  - no `websmith-ts71-child-*` directory is left in `$TMPDIR`.
- **No `Release-Notes.md` entry and no README change.** Nothing users install changes.

### Scope guard / Not in this slice

This branch owns:

- the new `docs/stories/ts7-rearchitecture/analysis-ts71-measurement.md` and `analysis-ts71-measurement.json`;
- in `docs/stories/ts7-rearchitecture/STORY-ts7-rearchitecture.md`: `updated:`, the two open points `:76-79`, one
  Decisions row and one Session Log entry;
- the ` → #<PR>` suffix on the plan's `:318` line.

Only if the run is blocked otherwise, and named in the PR:

- a minimal defect fix in `packages/webpack-test/perf/ts71-bench.cjs`, `ts71-corpus.cjs` or
  `ts71-transformer-probe.cjs`;
- a re-pin of `ts71-versions.json` and `ts71-versions.lock.json`.

Do not touch:

- the plan's body, which is frozen: the decision rule, the Spike bullet, other slice lines and the Changelog;
- `analysis-ts7-api-gap.md`. Its `unstable/*` names (`:86-88`) are stale, but correcting them is not this slice's
  job. Mention the staleness in the report's deviations;
- `docs/stories/README.md`, because the story's status does not change;
- product code, tests, snapshots, `package.json` files, `pnpm-lock.yaml`, `pnpm-workspace.yaml`,
  `eslint.config.js`, `license-config.json`, `.github/`, `Release-Notes.md` and READMEs;
- `esm-watch-bench.cjs`.

Not in this slice:

- a TypeScript 7 backend or any plan for one. If the row is "reopen B", the new plan is separate work, started by
  the maintainer;
- a Node 24 run;
- re-running at a newer nightly for comparison;
- unit tests for the harness's pure helpers (#190 review suggestion);
- the non-blocking review nits of #190.

Branches in flight, checked on 2026-10-15:

- #196 `bug/watch-generator-added-files` touches `Compiler.ts`, `CompilationContext.ts`, their specs,
  `bin.test.ts`, `Release-Notes.md` and `docs/plans/2026-10-02-cli-error-exit-gaps.md`. There is no file overlap.
  It moves `Compiler.ts` lines, so cite `Compiler.ts` by function name as well as by line.
- Dependabot #185, #186 and #195 touch dependency versions and `pnpm-lock.yaml`. There is no overlap, and they
  cannot reach the harness's pinned versions.
- `bug/typescript-6-root-dir-once` is briefed but not started. It does not touch this plan line or the story.

If you find something the plan did not anticipate, report it in the PR rather than improvising outside scope. That
includes:

- a 7.1 result that is implausible at 1,000 modules, for example a native (e) slower than in-process;
- semantic-diagnostic counts that differ between variants;
- a 3C or ts-loader status that has changed since 2026-10-15.
