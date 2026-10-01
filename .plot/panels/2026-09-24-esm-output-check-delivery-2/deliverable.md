<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# deliverable

Delivery panel round 2. I read the plan `docs/plans/2026-09-24-esm-output-check.md` (Design, Slices Waves 1–5, Changelog, Definition of Done) against the merged diffs. The focus is Wave 5 (#126–#129), which was built to fix the round 1 refutation. I also re-checked the deliverables round 1 marked as supported, to see whether Wave 5 broke any of them.

## Setup

- I made a clean copy of develop `3de39b1` with `git archive 3de39b1 | tar -x` into the scratchpad (`.../scratchpad/juror-deliverable`). The main checkout was not touched.
- Toolchain: Node v22.17.0, pnpm 10.34.1, `NX_DAEMON=false`.
- `pnpm install --frozen-lockfile --offline`, then `pnpm build`, which succeeded for all 9 projects.
- CLI probes used the freshly built `packages/compiler/bin/bin.js` against fixture projects in `.../scratchpad/probes/p1`–`p10`.

## Evidence

### Executed

- **Definition of Done, all four targets green on `3de39b1`:**
  - `pnpm lint`: exit 0, 9 projects.
  - `pnpm test`: exit 0. Suites: core 919, webpack 134, compiler 103, plus 57, 32 and 21 in the other projects. No failures.
  - `pnpm build`: exit 0.
  - `pnpm test:e2e`: exit 0. Suites:
    - compiler `bin.test.ts`: 51 passed.
    - webpack-test: 64 passed, 1 skipped. The skipped test is the thread-loader `it.skip`, which predates this plan (`c484ea7`).
    - compiler-test: 43 passed.
    - example-addons: 11 passed.
    - webpack: 38 passed.
- **Watch e2e under load (#126):** I ran `jest tests/webpack-esm-check.test.ts -t "watch|rebuild"` three times, each with two `yes > /dev/null` processes loading the CPU. All three runs passed 3/3.
- **CLI probes:**
  - **p1 (fast path syntax error):** `export const a = ;`, module `esnext`, no addons. Prints `src/a.ts (1,18): Expression expected.` and exits 1. `out/a.js` is still written, which the release notes document.
  - **p1b (`module: nodenext`, the `transpileNodeModule` path):** same error, exit 1.
  - **p1c (`--transpileOnly`):** same error, exit 1.
  - **p8 (`declaration: true`, the per-file declaration Program path):** same error printed once, exit 1.
  - **p2 (esm node profile, source with free `require`):** `out/a.js (1,18): ESM91001: … (source "src/a.ts", profile "client").`, exit 1.
  - **p3 (transformer addon injecting `require`):** `… (source "src/a.ts", profile "client", addons: req-tx).`, exit 1.
  - **p5 (two files):** each diagnostic names its own source: `src/a.ts` for ESM91001 and `src/b.ts` for ESM91003.
  - **p6 (`--watch`):** an edit that introduces `require` gives ESM91001 with `(source "src/a.ts", …)`. A later edit that introduces a syntax error prints `src/a.ts (1,18): Expression expected.` once.
  - **p7 (`declaration: true`):** the ESM91001 diagnostic names `source "src/a.ts"`.
  - **p4 (broken profile with unknown `depends` and `esm` combined with `module: CommonJS`):**
    - `--profile valid`: exit 0, nothing printed.
    - `--profile broken`: exit 1, each of the two config errors printed once.
    - No `--profile`: exit 0.
  - **p9:**
    - `esm.ignore` with `--debug` prints `ESM check skipped "out/shim.js": matches esm.ignore pattern`.
    - ESM91010 (missing extension) fires as an error.
    - `check: "warn"` turns it into a warning and the exit code becomes 0.
  - **p10 (`depends`):**
    - The server profile's esm reports only on server output.
    - A client profile with esm that depends on a server profile without esm is not failed by the server's output.

### Read

- The plan in full and round 1's `panel.md` and `deliverable.md`.
- `gh pr view` and `gh pr diff` for #126, #127, #128 and #129: titles, file lists and all non-context hunks.
- Hunks:
  - **#127:** `Compiler.ts` `AttributedOutput.source`, the `writtenFiles` and watch call sites, and `checkEsmOutput` building `sources`; `check-esm.ts` `describeOrigin`; `TsCompiler.ts:243`.
  - **#129:** `transpileModule(..., reportDiagnostics: true)`; `emitSkipped` only for file-less diagnostics; `getSyntacticDiagnostics` in `transpileNodeModule` and in the per-file declaration Programs; dedup with `getDiagnosticKey` in `report()`; `emitWatchedFile`.
  - **#128:** `getUsedProfiles`, with validation gated on `isUsed`; the profile threaded through `ResolvedCompilerOptions.ts` and `webpack/src/options.ts`; `command.ts` using `NoReporter` for the first options pass.
  - **#126:** the watch harness waits for a rebuild whose `modifiedFiles` contains the edited files, fails after 25 s, and asserts exactly `steps + 1` builds.
- `packages/compiler/src/command.ts:140-147`, to check the warning seen in p4.
- I did not re-read #115 and #119–#125 hunk by hunk. For those deliverables I rely on round 1's per-hunk mapping, re-confirmed by the full test and e2e runs and the probes above.

## Findings

| # | Deliverable | Status | Evidence |
|---|-------------|--------|----------|
| 1 | CLI exits non-zero on error-level diagnostics | SUPPORTED | `command.ts` `reporter.hasErrors()`. Probes p1–p5 and p8 exit 1; p9 with `warn` exits 0 |
| 2 | `processOutput` written set; `ResultProcessor`s keep today's list | SUPPORTED | round 1 mapping; #127 extends the `writtenFiles` entries with `source`; tests green |
| 3 | Loader reports through the per-call `this.emitError` / `emitWarning` | SUPPORTED | round 1 mapping; webpack-esm-check e2e green |
| 4–6 | `esm` option, validation, no `depends` inheritance, `ignore` with `--debug` | SUPPORTED | probes p4, p9 and p10 |
| 7–13 | Classification, scope walk, `checkEsm`, rules 91001–91033 | SUPPORTED | round 1 mapping; probes 91001, 91003 and 91010; core suite of 919 green |
| 14 | Best-effort TypeScript `nodenext` labels | SUPPORTED | round 1 mapping; tests green |
| 15–16 | `watch()` coverage; `ResultProcessor` writes | SUPPORTED | probe p6; #127 spec "names no source … result processor creating file" |
| 17 | Per-addon attribution | SUPPORTED | probe p3 `addons: req-tx` |
| 18 | **Diagnostics name the source file** (refuted in round 1) | **SUPPORTED** | #127: `check-esm.ts` `describeOrigin(context, context.sources?.get(cur.name))`, with the source taken from `AttributedOutput.source` at `Compiler.ts` `processOutput`, watch, and `TsCompiler.ts:243`. Executed on the full, watch and declaration paths (p2, p3, p5, p6, p7). Loader target covered by the e2e assertion `(source "src/a.ts", profile "target", addons: require-injector)`, which passed |
| 19–21 | Loader target and dependents, no 91012 in the loader, `addDependency`, `.mjs`/`.cjs` | SUPPORTED | round 1 mapping; webpack e2e green |
| 22–23 | Caching; ≤10% watch gate (amended) | SUPPORTED (amended) | round 1; not re-measured |
| 24 | Changelog items and README docs | SUPPORTED | #127 and #128 update `compiler/README.md`, `webpack/README.md` and `Release-Notes.md`; the plan's Changelog loader line is reworded as round 1 asked |
| 25 | Definition of Done | SUPPORTED | all four targets executed green on `3de39b1` |
| W5a | `feature/esm-check-source-file` → #127 | SUPPORTED | item 18 |
| W5b | `bug/fast-path-syntax-errors` → #129: reported and the build fails | SUPPORTED | `Compiler.ts` `reportDiagnostics: true` plus `getSyntacticDiagnostics`; probes p1, p1b, p1c, p8 and p6 exit 1 with the error printed once |
| W5c | `bug/validate-selected-profile` → #128: only the selected profile and its dependencies, printed once | SUPPORTED | `resolve-compiler-config.ts` `getUsedProfiles` and `isUsed`; probe p4 (valid: exit 0; broken: exit 1, each error once) |
| W5d | `bug/flaky-webpack-watch-tests` → #126 | SUPPORTED | the harness waits on `modifiedFiles`; 3 of 3 passes under CPU load, plus the full e2e pass |

Residual observations. None of them is a plan deliverable, and none changes the position:

- **A TypeScript option error is printed once per emitted file on the fast path.** Example: TS5070, `resolveJsonModule` combined with the classic `moduleResolution`, set in the profile's `tsConfig`. Probe p9 printed it 3 times for 3 files. The duplication comes from #129: it now reports file-less diagnostics from `transpileModule`, and `report()` deduplicates only diagnostics that carry a file (`key` is `undefined` for global ones). The plan's "printed once" belongs to #128 and the `websmith.config.json` resolution errors, which do print once. This is new behaviour from #129, so it is worth a follow-up.
- **`--profile broken` also prints `Custom profile configuration "broken" found, but no profile provided.`** This comes from `command.ts:140-147` `hasInvalidProfile`, which predates the plan. The text is misleading but cosmetic.

## Verdict

Every deliverable the plan names, including the four Wave 5 slices, is in the merged code. The behaviours were run, not only read. Both round 1 refutations are fixed on develop `3de39b1`: the source file in diagnostics, and fast-path syntax errors failing the build. So is the profile-scoped config validation.

Position: supported
Evidence: executed
