<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# Webpack loader performance and caching

Executed: nothing built or benchmarked; I read the plan and the cited code on `origin/develop` only. The 150-300 ms per
module figure is taken from the story, not re-measured.

## Findings that change the plan

1. **`tsconfig.json` is never a webpack dependency, so the proposed trigger cannot fire.** The plan re-resolves when
   `websmith.config.json` or `tsconfig.json` is in `compiler.modifiedFiles`. `modifiedFiles` holds only files webpack
   watches. `afterCompile` registers the config file (`webpack-hooks.ts:120-125`); a grep for `tsconfig` /
   `tsConfigFile` in `webpack-hooks.ts`, `loader.ts` and `TsCompiler.ts` finds only the type guard at
   `webpack-hooks.ts:38`. Today the per-module `updateLoaderConfig` hides this, because each module re-reads the
   tsconfig. After slice 1 an edit to `tsconfig.json` (and its `extends` chain) in watch mode is silently ignored.
   Slice 1 must add the resolved tsconfig and every `extends` target to `compilation.fileDependencies`, and say so;
   the thread-loader open point then shrinks, because the same list can be stat-ed.

2. **Per-module `setOptions` does more than resolve options; slice 1 must list what it stops doing.**
   `Compiler.ts:315-338` also sets `rootFilesCacheInvalidated = true` (so `getRootFiles` walks `src/` with
   `recursiveFindByFilter` again, `Compiler.ts:1519-1533`, a likely large share of the 150-300 ms), clears
   `baselineTranspileCache`, `baselineEmitCache`, `baselineEmitCacheFileTimes`, `reportedWatchDiagnostics`, and
   refreshes the addon registry. After the change these survive across modules and across watch rebuilds:
   - the root file list goes stale when a file is added in watch mode (program rebuilds only when the options key
     changes, `Compiler.ts:1029`, so this matters only if programs are rebuilt, but state it);
   - the baseline emit cache is then kept for the process lifetime. The mtime-based eviction
     (`Compiler.ts:1143-1161`) was designed for this, but its time map is cleared today on every module, so the
     eviction path has never run in the loader. Needs a unit test and a memory check in the 1000-module watch run;
   - `TsCompiler.ts:305` documents a hidden coupling: "updateLoaderConfig runs for every module, so a profile that is
     not ESM is not reported here again". Reporting inside `getCheckedEsm` changes behaviour once resolution happens
     once. Slice 1 needs a test for that.
   The plan names only `packageJsonInfoCache`. Name these too, and decide per cache: reset per compilation, per
   file mtime, or on options change.

3. **Persistent cache correctness is wider than item 8.** With `cache: { type: "filesystem" }` a module restored from
   cache never runs the loader. The loader adds no dependency on `websmith.config.json` per module (only
   `afterCompile` adds a compilation-level file dependency, `webpack-hooks.ts:120-125`), no `buildDependencies`
   entry exists (grep in `packages`: none), and `tsconfig.json` is not a dependency. So a config or tsconfig edit
   between two process runs can serve stale module output. The slice 7 plugin / build-info idea should cover
   invalidation as well as error replay: register config, tsconfig and its `extends` chain as `buildDependencies`
   (or as module file dependencies). Resolve-once makes the instance lazy, which is also why item 8 exists; the
   plugin that resolves eagerly at `beforeRun` / `watchRun` (one resolution) is the cleaner way to get both and also
   removes the "instance created by the first loader run" ordering.

4. **The benchmark gate is mis-specified in two ways.** (a) "Initial build drops at least 80% against `develop`" has
   no stated baseline procedure: `esm-watch-bench.cjs` measures edit and flip scenarios and the check share
   (`esm-watch-bench.cjs:13-22`); its initial build is recorded (`results.initial`) but not gated. Add the
   comparison against a `develop` build of the same generated project as a documented manual step, since the file
   header states it is not run in CI (noise). (b) The bench's header says flip scenario cost "is each at the loader's
   existing per-module cost (compiler-instances.ts)": after slice 1 that cost changes, so the gate text for variant C
   must be rewritten in the same PR, or the check-share gate (<=10%) becomes easier to pass for the wrong reason (the
   denominator shrinks, the numerator is unchanged, so the share actually rises; re-baseline it). Expect the share to
   grow when rebuild time falls; 10% may then fail with no regression. Decide whether the gate stays a share or
   becomes absolute ms per module.

5. **Watchdog race (bench, `:240`, `:265-269`).** Confirmed by reading: the watchdog callback sets `pending =
   undefined` and calls `next()`; a late `done` callback then runs `next()` again, giving two chains. The fix is
   small and belongs first, as the plan says; add a generation token rather than only clearing the timer.

## Per-question

**Problem.** Item 1 is real on develop: `compiler-instances.ts:44` calls `updateLoaderConfig` for every module and the
`loader` tap (`webpack-hooks.ts:163-182`) reads and parses the config file and calls it again, so two resolutions per
module (read; the second one is the config re-read). The cost figure is plausible: `setOptions` re-resolves options and
re-walks `src/`, `setupWebpackAddonService` is rebuilt (`TsCompiler.ts:181`). Items 2-8 are outside my lens except the
persistent-cache one (item 8), which is plausible by reading (hooks are registered only in the instance creation,
`compiler-instances.ts:35-41`) but unreproduced.

**Approach.** Resolve-once at instance creation plus triggered re-resolve is the right design. Gaps: finding 1 (trigger
cannot fire for tsconfig), finding 2 (cache semantics), and thread-loader. Thread-loader: each worker has its own
instance (`instance-cache.ts` marker key), so each resolves once, which is fine; an `mtime` stat per module costs
microseconds, but `extends` chains must be included or the mtime check is an incomplete answer. Recommend: stat config +
tsconfig + extends targets, accept that addons dir changes need a worker restart (they already do through the require
cache). Also multi-instance setups (several rules, differing options hash) resolve once per instance, not once per
build: say "per instance".

**Slices.** Slice 1 is too big for one reviewable PR: it carries the watchdog fix, resolve-once, the removal of the
`loader` tap (with its `console.warn` behaviour), the cache reset move and the re-resolve triggers. Split the bench
watchdog fix into its own first branch (it unblocks measuring) and keep resolve-once separate. Tests for slice 1 must
fail before: count `setOptions` calls over N modules (unit), and the e2e watch edit of `websmith.config.json` and of
`tsconfig.json`. Slices 2-5 do not depend on slice 1 for correctness, but slice 3 (errors once without hooks) is
cheaper after it; keep the order. Slice 6 (`needBuild`) is performance-sensitive: a tap per module on every rebuild
must stay O(modules with a package.json dependency); an unconfirmed `needBuild` semantics (open point 4) should be
spiked before approval, not during the slice. Slice 7 should be merged with the invalidation work in finding 3.

**Overlap.** `Compiler.ts:929 registerPackageJsonWatches` (CLI) is similar to slice 6's tracking; share the `"type"`
reading. The `depends` closure unification (slice 4) is core, and tsc-option-parity may touch `resolveCompilerOptions`
(open point 3): coordinate which plan owns moving enum conversion. No overlap with the TS7 story seen on my lens beyond
`ts.createProgram` use in the cached program.

**Open points to decide before approval.**
- Thread-loader re-resolve trigger: stat config, tsconfig and `extends` targets (recommended; accept addons).
- Gate: replace "80% against develop" with a recorded, reproducible baseline procedure and re-baseline the check
  share (finding 4).
- `needBuild`: spike it now; the open point cannot stay open at approval, since slice 6's design depends on it.
- Add: which caches survive across modules (finding 2) and the tsconfig dependency (finding 1).

Verdict: amend
