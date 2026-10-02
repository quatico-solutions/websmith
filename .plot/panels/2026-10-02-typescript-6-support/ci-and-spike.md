<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# CI matrix and the 7.1 spike as an experiment

Method: read the plan on `origin/idea/typescript-6-support`, `.github/workflows/pull-request.yml`, root `package.json`,
`pnpm-lock.yaml` header, `packages/core/src/compiler/Compiler.ts`, `packages/webpack-test/perf/esm-watch-bench.cjs`
(head) and the ts7 story/analysis on `origin/develop`. Nothing was built or executed; every statement below is from reading.
The strategy choice (A + 7.1 spike) is taken as given.

## Findings that change the plan

1. **The matrix is wired to the wrong place in the slice order.** The CI leg for 6.0.3 lands in slice 4, but slices 1-3
   (the ones that make 6.x pass) are validated only by a local scratch override. Slices 2 and 3 acceptance ("compile on
   6.0.3 without TS5107, unchanged on 5.7.3") cannot be checked by CI on their own PRs, so a regression back to 5.x-only
   is invisible until slice 4 and the failures then land in one PR. Move the matrix (leg may be `continue-on-error`
   or limited to build + lint) into slice 1, and turn it required in slice 4. This is the highest-value change:
   it makes every later slice's "would fail before" test real.
2. **The override mechanism is described but not specified well enough to be correct.** The plan says "apply the
   override and `pnpm install --no-frozen-lockfile`" (Design, CI matrix). Details to fix in the plan:
   - `pnpm.overrides` lives in the lockfile, so the 6.0.3 leg necessarily rewrites `pnpm-lock.yaml`; say that the
     leg must not commit it and must not use `--frozen-lockfile`, and that the leg uses `pnpm install --no-frozen-lockfile`
     only after the edit (e.g. `pnpm pkg set` or a `jq` step on the root `package.json`, or the
     `PNPM_...`-free alternative of a second workspace `.npmrc`). Pick one and write it down.
   - The leg resolves the entire transitive tree afresh, not just `typescript`: ts-jest, ts-loader, typescript-eslint,
     and every `^` range float to whatever is latest that day. A 6.x failure can then be a toolchain drift, not a
     websmith bug. State the policy: the 6.x leg uses the same lockfile plus only the `typescript` override
     (`pnpm install --frozen-lockfile=false --prefer-offline` does not guarantee this). A better wiring: commit a second
     lockfile-free approach is not needed; instead run `pnpm install --frozen-lockfile` first, then
     `pnpm add -D -w typescript@6.0.3 --ignore-scripts` is equally unfrozen. Whichever is chosen, record that
     resolution of other packages may move and that failures are triaged against the 5.7.3 leg.
   - Overrides apply to the **peer** `typescript` of every package (the plan's slice 4 makes it a peer). With
     `autoInstallPeers: true` (lockfile settings) this works, but the plan should assert, as a CI step, that exactly one
     `typescript` version is installed (`pnpm why typescript` or `node -p "require('typescript').version"` in each
     package) and that it equals the matrix value. Without that check a leg can go green on the wrong version
     (a silently ignored override is the classic failure of this design). Add the check as the first step after install.
   - CI uses `pnpm/action-setup@v3` with `version: 9` (`pull-request.yml`), while the plan's probe and the lockfile
     handling reference pnpm 10 behaviour (`ignoredBuiltDependencies` in root `package.json` is a pnpm 10 field). Confirm
     overrides resolve identically on the CI pnpm; if the repo is really on pnpm 9 in CI, say so and probe on 9.
3. **Matrix size: choose 3 jobs, not 4, but write the reason.** Today CI has 2 jobs (Node 22, 24; `pull-request.yml`).
   4 jobs doubles the e2e cost (the e2e suites are the slow part: 124+ failures in 3 suites shows their weight). Node
   22 is the engines floor and 24 the dev version, so the axes that matter independently are: TS 5.7.3 on the floor
   Node (22) and TS 6.0.3 on the dev Node (24), plus one cross cell. Recommendation: 5.7.3/22, 5.7.3/24 (unchanged
   baseline, currently what CI runs, keeps the current required-check names), 6.0.3/24, and add 6.0.3/22 only if the
   unit leg shows Node-dependent failures. Resolves open point 8 with "3 jobs, 5.7.3 on both Node versions, 6.0.3 on 24".
   (The plan proposes the opposite 3-job shape, 5.7.3 on 22 only; that drops the cell most users have, 5.x on 24, which is
   what 0.10.0 just released as supported.)
   Also: rename/keep stable job names, because branch protection keys on them; a matrix change renames the checks
   (`dist (22)` becomes `dist (22, 5.7.3)`), and the plan does not mention updating required checks.
4. **Open point 4 (lower bound) interacts with the matrix and is undecided.** The matrix tests only 5.7.3 as the lower
   end, so any `5.x` peer claim below 5.7 is untested. Recommend `>=5.7 <7`, or add a 5.0/5.4 leg (no: cost). Decide before
   approval, because the claim in Changelog ("`5.x || 6.x`") is what the matrix has to prove.
5. **Lint on the 6.x leg:** the plan states typescript-eslint 8.22 is outside its supported range and moves it in slice 1,
   yet the 5.7.3 leg then runs the newer typescript-eslint on 5.7.3 (8.71.0 peer `<6.1.0`, lower bound unstated). Verify the
   new typescript-eslint supports 5.7.3 (it does for 8.x `>=4.8.4`, but the plan should say it), otherwise the baseline leg breaks.

## The spike (slice 5) as an experiment

What is sound:
- Pinning an exact `7.1.0-dev.*` nightly and naming it; 5 runs; recording machine and Node version; harness not in any
  suite and placed beside the `esm-watch-bench.cjs` precedent (which already states gates up front and runs variants
  interleaved, a good template).
- Status checks for 3C (microsoft/TypeScript#63875) and ts-loader#1704 are dated and tied to concrete questions (phase,
  typings, migration state). The story and analysis (section 2.5) already say 3C is not in 7.1-dev and is a post-emit AST
  round trip; the spike's check is therefore a re-check, which is right.

What is wrong or missing:
1. **No decision rule is stated in advance. This is the central defect.** Open point 9 leaves the threshold ("what
   ratio is acceptable", "released 7.x or nightly enough") to be decided later, which is exactly how a measurement ends as
   "numbers". The plan says "output: a recommendation", but a recommendation without a pre-committed rule can be fitted to
   whatever comes out. Approval must fix: (a) per-file median and p95 ratio thresholds, (b) cold-start budget, (c) the
   3C gate, and (d) the mapping from outcomes to actions. Proposed, to be adjusted by the owner:
   - Reopen strategy B only if both hold: 7.1 per-file `transpileModule` median is within 1.5x of 6.x in process for
     1,000 modules AND the `createProgram` + emit loader path (workload c) within 2x; p95 not above 3x median.
   - Cold start (spawn + first call) under 1 s, otherwise report as per-loader-instance cost times the number of
     loader instances in a multi-profile build.
   - 3C counts only when shipped in a released 7.x (not a nightly) with a documented transformer phase that supports
     websmith's `before`-style transformers (Compiler.ts:1089 passes `before` transformers to `transpileModule`), because a
     nightly can regress or drop it.
   - Outcome table: all met -> plan B for the release after 3C ships; speed met, 3C missing -> stay on A, re-check at
     next 7.x minor; speed not met -> record "IPC cost blocks per-file emit" and stop re-measuring until the API
     changes. The spike's definition of done is one of these three recorded rows, not the report.
2. **Workloads under-represent what the loader does.** The loader's transpile path is `Compiler.ts:1089/1101`
   (`transpileModule` with transformers) and its Program path creates one `createProgram` and reuses it across rebuilds
   (`Compiler.ts:325`, `:1017-1034`, `cachedProgram`). Workload (c) "createProgram plus getJavaScriptEmit per file" is a
   one-shot cold build; the dominant cost in webpack watch is the **incremental rebuild with `oldProgram`/snapshot reuse**
   (the nightly has snapshots; the analysis lists `createIncrementalProgram` as planned, so this may be absent). Add: (e)
   watch-like rebuild: change one of 1,000 files, time program update + emit of the affected file, 30 edits as the existing bench
   does; if the API cannot express it, record "not measurable" as a finding that counts against B, not silently omit it.
   Also add concurrency: webpack calls the loader in parallel (thread-loader or just async); measure N concurrent in-flight
   `transpileModule` calls over one IPC channel, since serialisation on the pipe is the likely bottleneck, not single-call latency.
3. **IPC encoding and payload are unspecified.** Both MessagePack and JSON-RPC exist per the analysis; the harness must say
   which is used (default of the nightly's client), and report payload size per file. Per-file source text sent each call vs
   server-side file system access changes the result by an order of magnitude. State it.
4. **Fairness of the baseline.** In-process `transpileModule` on 5.7.3 is ~0.35 s for large projects per
   `packages/api/docs/write-your-own-addon.md:283`; the comparison should be same corpus, same Node, same machine, warmed
   (JIT) vs cold, and report both. Run order interleaved (as `esm-watch-bench.cjs` does) to cancel thermal and cache drift;
   the plan says 5 runs but not interleaving. Report median of medians with the spread; with n=5 give the min/max, not a mean.
5. **Corpus.** "`webpack-test` fixtures plus a generated corpus of realistic module sizes" is unspecified: fix a seed, module
   size distribution (e.g. lines per module drawn from a real repo's histogram) and import-graph shape, and commit the generator,
   otherwise the harness is not repeatable. The esm-watch-bench generator (binary import tree, ~10% modules touched by addons)
   can be reused; say so, and include modules that websmith transformer addons modify, since that is where 7.x lacks API.
6. **Nightly instability.** A pinned nightly may be unpublished from npm or incompatible with the story's prior reading (7.1-dev
   `api.d.ts:1163-1174`). Commit the exact version and its tarball integrity hash in the report, and note whether the harness
   installs it in an isolated directory (not the workspace, or it joins the matrix by accident).
7. **Transformer status needs a functional probe, not only a status read.** Reading #63875 gives intent; also run a
   `transpileModule` call with a `before` transformer against the nightly client and record the type error or runtime
   behaviour. One 10-line script turns "planned" into "measured missing", and the story's current claim ("missing in 7.1 nightly")
   rests on typings reading alone.
8. **Slice placement.** The spike touches no product code and its result decides future work, but the plan puts it last.
   The Notes already say it can move to the first wave. Recommend making it parallel with slice 1 (a separate branch, no
   dependency), because the result informs open points 2 and 10 (the CLI's `typescript` dependency, and fallback to
   `@typescript/typescript6`) and costs nothing in sequence.
9. **Slice size.** Slice 5 is one branch with a harness, a report, and a story decision; that is a reviewable PR if the harness
   is under ~300 lines. If workloads (e) and concurrency are added, split into harness (`infra/typescript-7-1-bench`) and report
   (`docs/typescript-7-1-measurement`, containing numbers and the decision row), so the harness can be reviewed on its own merits
   and the report cites a commit.

## Slices, from this lens

- Slice 1 gains the CI matrix (see finding 1). Its test that "fails before": the 6.0.3 leg is red on develop, green after.
- Slice 4 keeps the version guard, the peer range and the required-check update; its e2e "green on both legs" is only
  meaningful after the version-installed assertion from finding 2.
- Slice 5: acceptance is a recorded decision row, not the report. No product code: agreed.

## Overlap

- #133 dependency-updates and slice 1 both edit `pnpm-lock.yaml` and workflow files; the plan names the lockfile rebase, but
  not that #133 may also change `pull-request.yml` (Node/pnpm versions). Confirm with #133 before slice 1 starts.
- #135 slices 2-3 gate this plan's slice 2; open point 7 handles it. No overlap with the spike.
- Story `ts7-rearchitecture`: the spike answers its two ⏸️ questions (3C phase; IPC cost). The report should update those
  lines, not duplicate the analysis.

## Open points to decide before approval

- 8 (CI size): 3 jobs as above (5.7.3 on 22 and 24, 6.0.3 on 24).
- 9 (threshold): fix numeric thresholds and the 3C gate in the plan text (proposal in the spike section), not after the run.
- 4 (lower bound): `>=5.7 <7`, matching what the matrix proves.
- 1 and 2: no objection from this lens; recommendation 1 (move the pin in slice 4) is fine as long as the matrix exists from slice 1.
- New: required-check names and the "exactly one typescript version installed" assertion.

Verdict: amend
