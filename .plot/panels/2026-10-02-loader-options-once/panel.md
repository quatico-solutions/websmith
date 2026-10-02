<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# Panel: loader-options-once

- **Subject:** `docs/plans/2026-10-02-loader-options-once.md` (Draft, branch `idea/loader-options-once`, PR #134)
- **Date:** 2026-10-02
- **Commitment:** `Verdict: proceed | amend | reject`
- **Jurors:** downstream webpack user, loader configuration and diagnostics, loader performance and caching
- **Gate:** `plot-panel.mjs check` — all three committed; `reconcile` → **unanimous: amend**

## Process notes

- The jurors ran on Sonnet and wrote their own verdict files (`downstream-user.md`, `loader-config.md`,
  `loader-performance.md`); the moderator changed nothing in them. All three files pass the gate.
- The moderator re-ran `check` and `reconcile` on the files as committed: unanimous `amend`.
- **What each juror looked at:** all three only **read** — the plan and the cited code on `origin/develop`. The
  downstream juror also read the qs-magellan starter (`react-typescript-webpack`, read-only) as the reference user.
  Nothing was built, run or benchmarked; the 150–300 ms per module figure is the story's, not re-measured. Every
  finding below is a reading of code, which matters most for the cache-semantics findings: they describe what *would*
  go stale, not what was observed stale.

## Where the jurors converge

| Finding | Jurors | Evidence |
|---------|--------|----------|
| `tsconfig.json` is never a webpack dependency, so the planned re-resolve trigger (`compiler.modifiedFiles`) cannot fire; after slice 1 a tsconfig edit in watch mode is silently ignored — a regression | all three | `webpack-hooks.ts:120-125` registers only the config file; no `tsconfig` dependency in `loader.ts`, `TsCompiler.ts`, `compiler-instances.ts` |
| Register `tsConfigFile` and its `extends` chain as file dependencies; that also answers Open Point 1 for the compiler path | all three | `parsedCommandLine` reports `extendedSourceFiles` |
| Per-module `setOptions` does more than resolve options: it clears `baselineTranspileCache`, `baselineEmitCache`, `baselineEmitCacheFileTimes`, `reportedWatchDiagnostics`, sets `rootFilesCacheInvalidated` and refreshes the addon registry; the plan names only `packageJsonInfoCache` | all three | `Compiler.ts:315-338` |
| Addons are re-activated per module today; after slice 1 addon instances and addon-source edits live for the whole build / dev session | downstream, config | `AddonRegistry.refresh()` via `setOptions`; `TsCompiler.ts:181` |
| Slice 1 is too big: split the benchmark watchdog fix into its own first branch | downstream, performance | `esm-watch-bench.cjs:240`, `:265-269` |
| Slice 4 is two changes: the `depends` closure unification (core, CLI-visible ordering) before the loader's unknown-profile error | downstream, config | `getDependentProfiles` returns ordered array, `getUsedProfiles` a `Set` |
| Slice 1's named e2e ("edit `websmith.config.json` and see the change") passes before the change; the red test must count resolutions | config, performance | per-module re-read on develop |

## Where they differ — named, not averaged

1. **Where `convertEnumOptions` lives (Open Point 3).** The config juror shows that converting in `createOptions`
   reports to a `NoReporter` (`loader-options.ts:59`, `options.ts:15`), so the "unknown names as config errors" half of
   slice 2 is lost; it wants the conversion in core's `ResolvedCompilerOptions`. The downstream juror wants it in
   `resolveCompilerOptions` so CLI and loader share it. Same direction, different function — and it is the function
   #135 also edits (see Cross-plan conflicts). The plan must name the exact home.
2. **How to replace per-module resolution.** The plan keeps lazy instance creation plus triggers. The performance
   juror argues for an eager plugin at `beforeRun` / `watchRun` that resolves once and also registers config and
   tsconfig as `buildDependencies` — fixing persistent-cache invalidation (item 8) and the "first loader run creates the
   instance" ordering together. The downstream juror accepts a plugin only if it is **auto-registered**: a plugin users
   must add breaks the starter's "just a loader" contract. This is a real disagreement about the loader's public
   setup, not a detail of slice 7.
3. **Benchmark gate.** The plan proposes "≥80% initial-build drop and ESM-check share ≤10%". The performance juror
   says the share *rises* when rebuild time falls, so the 10% gate can fail with no regression, and asks whether it
   becomes absolute ms per module; it also wants a reproducible baseline procedure. The downstream juror accepts 80% but
   adds "a 20-module starter build is not slower". Different failure modes guarded; both are needed.
4. **`needBuild` (Open Point 4).** Performance and downstream want it spiked **before** approval (slice 6's design
   depends on it); the config juror lets it stay open until its slice starts.
5. **The dead `profiles` loader option.** Only the config juror found that `WebpackLoaderOptions.profiles` is still
   declared and documented but dropped by `createOptions` and read nowhere — a user passing it gets no error and then
   an "unconfigured profile" failure. Undisputed; needs a decision (config error now, removal later).

## Shared blind spot

All three lenses — even "downstream user" — reasoned about **webpack's** watch and cache machinery. None asked what
happens to **multi-compiler and multi-rule setups**: the performance juror notes in passing that resolution is "once
per instance, not once per build", but nobody followed it to a config with two loader rules (different options
hashes) or a `MultiCompiler` (client + server, the Magellan shape), where `watchRun`, `afterCompile` and the
per-compilation dedup run per child compiler and the shared instance cache may be keyed across them. The plan's
"once per compilation" claim is untested there.

A second: because nothing was run, the cache-staleness findings are hypotheses. The plan should add a watch e2e
that edits a *dependency* of a transformed module (downstream juror's suggestion) to observe them, rather than
designing per-cache policies on reading alone.

## Cross-plan conflicts

- **#135 `tsc-option-parity` slice 1** (`bug/profile-lib-names`) rewrites `convertEnumOptions` for string arrays in the
  same function and file as this plan's slice 2. Agree the helper's home and order before either starts; whichever
  lands second must keep the conversion idempotent (the #135 panel found the `lib.*.d.ts` form is not), because loader
  `tsConfig` may be converted more than once.
- **#136 `cli-error-exit-gaps` slice 2** makes per-file fragments carry option diagnostics; until this plan's
  "errors once" slice lands, the loader would print one per module. Order this plan's slice 3 first, or put the dedup
  key in core.
- **#132 `vite-plugin`** builds on `getCompilerInstance` / `TsCompiler.build`; this plan's slice 1 changes the contract
  it depends on and should land before the Vite core extraction.
- **The `profiles` loader option** is not covered by any plan; this plan is its only natural home.
- **#136** leaves the `depends` closure copies to this plan (its Notes); slice 4 is their only home.

## What the plan needs before approval

1. **Register `tsconfig.json` and its `extends` chain** as file dependencies in slice 1; e2e edits `tsconfig.json` under
   watch. Close Open Point 1 the same way (stat the same list under thread-loader).
2. **List every cache `setOptions` clears** and decide per cache: reset per compilation, per mtime, or on options
   change; test the baseline-emit eviction path that never ran in the loader; keep or relocate the `getCheckedEsm`
   "reported once per module" coupling (`TsCompiler.ts:305`).
3. **State the addon-lifetime change** (instances reused across modules and rebuilds), decide addon-source reload under
   watch, and document it in `packages/api` / README.
4. **Make slice 1's tests red-first** (count `setOptions` over N modules) and split the watchdog fix into its own
   preceding branch; define a reproducible baseline and re-baseline (or make absolute) the check-share gate.
5. **Name the `convertEnumOptions` home** in core where the collecting reporter lives, agreed with #135; define the
   wording for inline-config errors.
6. **Decide the `profiles` loader option:** config error now, removal in a breaking release.
7. **Split slice 4** into a characterised `depends`-closure refactor and the loader error; cover "profile given, no
   config file". Decide plugin-vs-build-info for item 8 with auto-registration as a requirement, and spike `needBuild`
   before approval.

Nothing here is acted on by the panel. The plan author amends; `/challenge-the-plan` or `/plot-approve` follows.
