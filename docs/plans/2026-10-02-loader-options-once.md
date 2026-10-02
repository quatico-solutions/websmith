<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# Resolve webpack loader options once per build

> Resolve the webpack loader's options once per compilation instead of once per module, then fix the loader gaps that
> per-module resolution hid or caused: unconverted `tsConfig` names, repeated option errors, an unconfigured profile's
> stack trace, dropped diagnostics of dependent profiles, `package.json` rebuilds, and config errors lost on a cached
> build.

## Status

- **State:** Approved
- **Type:** bug
- **Story:** node24-esm-support
- **Review:** pr
- **Impl:** own branches
- **Rounds:** 1
- **Approved:** 2026-10-02, Jan Wloka, plan-PR #134 merged
- **Started:** 2026-10-02, Jan Wloka, `infra/esm-bench-watchdog`
<!-- Transition records — written by the workflow commands, not by hand:
- **Approved:** <date>, <who>, <channel>
- **Started:** <date>, <who>, <branch>   (one line per started branch)
-->

## Changelog

- The webpack loader resolves its options and `websmith.config.json` once per compilation and loader instance instead
  of once per module. The story measured 150–300 ms per module on `develop`; the gain shows in large initial builds
  and mass rebuilds, not in projects of a few dozen modules.
- In watch mode the loader picks up edits to `tsconfig.json` and the files it `extends`, and a persistent-cache build
  is invalidated by them and by `websmith.config.json`.
- Addons are loaded once per compilation instead of once per module: an addon instance is reused for all modules of
  a compilation, and an edited addon is reloaded on the next rebuild.
- Loader-option `tsConfig` and inline `config.profiles` accept option names such as `module: "NodeNext"`, as
  `tsconfig.json` does, and report unknown names as configuration errors.
- **Breaking:** the top-level `profiles` loader option is removed from `WebpackLoaderOptions`; the loader has
  ignored it since `profile` and `config.profiles` replaced it. Passing it now fails the build with a configuration
  error that points to `config.profiles`.
- The loader reports a TypeScript option error (e.g. TS5053, TS5070) once per compilation instead of once per module.
- An unconfigured profile name fails the build with one configuration error that names the available profiles,
  instead of a `Module build failed` stack trace per module.
- **Behaviour change:** TypeScript errors that only a dependent profile produces, e.g. a declaration-emit error, now
  fail the webpack build; an error both profiles produce is reported once.
- Under `module: node16`/`nodenext` the loader rebuilds a module when the `"type"` of its `package.json` changes, and
  no longer rebuilds it when another field changes, e.g. on `npm install`.
- A build restored entirely from webpack's persistent cache still reports configuration errors.

## Motivation

The story `node24-esm-support` collected loader findings across five session-log entries (2026-09-26 "Loader gaps…",
2026-09-30 "Follow-ups from the esm-check-webpack review", 2026-09-30 "Found while scoping config validation",
2026-10-01 "Found while reviewing bug/fast-path-syntax-errors", 2026-10-01 "Follow-ups from the third delivery
panel"). Checked against `develop` at `d7ffdf4`:

| # | Finding | Still holds on `develop`? |
|---|---|---|
| 1 | Options re-resolved per module | **Yes, twice.** `getCompilerInstance` calls `instance.updateLoaderConfig(options)` for every module (`packages/webpack/src/compiler-instances.ts:44`); `updateLoaderConfig` (`TsCompiler.ts:177`) runs `setOptions`, which re-runs `resolveCompilerOptions`, clears the baseline caches and `packageJsonInfoCache` and refreshes the addon registry (`packages/core/src/compiler/Compiler.ts:315-338`), then rebuilds the `WebpackAddonService`. In addition, the `NormalModule` `loader` hook reads and parses `websmith.config.json` for every module and calls `updateLoaderConfig` again (`webpack-hooks.ts:163-182`). Measured cost: 150–300 ms per module (story, 2026-09-30). |
| 2 | Loader-option `tsConfig` names not converted | **Yes.** `createOptions` spreads `tsConfig` unconverted (`packages/webpack/src/options.ts:51`) and merges an inline `config` unconverted (`options.ts:66`). Only profiles read from a file go through `convertEnumOptions` (`packages/core/src/compiler/config/resolve-compiler-config.ts:81`, `:186`). |
| 3 | No `package.json` dependency under node16/nodenext | **Partly fixed by #125.** The ESM check registers the nearest `package.json` (and the missing ones above it) through `onDependency` (`packages/core/src/compiler/esm/classify-module.ts:103-108`, forwarded by `loader.ts:32-33`). A node16/nodenext profile without `esm` runs no check (`TsCompiler.ts:307`), so its module format still depends on a `package.json` webpack does not watch. The CLI's equivalent is `registerPackageJsonWatches` (`Compiler.ts:929`), watch only. |
| 4 | Any `package.json` edit rebuilds its modules | **Yes.** The dependency from #125 is a plain file dependency, which webpack invalidates on any change of the file. |
| 5 | Dependent profiles' TypeScript diagnostics dropped | **Yes.** `build` emits each dependent profile (`TsCompiler.ts:258`) and keeps only its ESM findings (`:260`); `fragment.diagnostics` is discarded. Only the target's `result.diagnostics` reach webpack (`:283`). |
| 6 | Option errors once per module | **Yes.** #130 deduplicates file-less diagnostics in the core `report` path (`Compiler.ts:827`), which the loader does not use: `build` returns `result.diagnostics` per module (`TsCompiler.ts:283`) and the loader emits each on its module (`loader.ts:34`). Without compilation hooks (thread-loader) the loader also emits every config error on every module (`loader.ts:36-38`). |
| 7 | Unconfigured profile name: raw stack trace | **Yes.** `getFragmentProfile` only warns (`TsCompiler.ts:362-368`, and not at all without `config.profiles`); `createOptions` resolves the profile with a `NoReporter` (`options.ts:89`); `emitSourceFile` then throws `No profile with name "x" configured.` (`Compiler.ts:571`), which webpack prints as `Module build failed`. |
| 8 | Persistent cache: no configuration errors | **To reproduce first.** By reading: the compilation hooks that report config errors (`webpack-hooks.ts:115-136`) are registered only when the loader creates the compiler instance (`compiler-instances.ts:35-41`), so a build that runs no loader registers none. |
| 9 | `scanCache` never evicted under thread-loader | **Fixed by #125** (commit `2094e0c`): `CompilationScanCache` caps each generation at 5000 files and starts a new one when full (`TsCompiler.ts:54-85`). Dropped. |

Item 1 is the root: it costs about 150 s on a 1000-module initial build, it is why option and config errors repeat
per module, and its cache clearing currently masks stale-state problems that resolving once would expose. So it goes
first, right after the benchmark that measures it is trustworthy.

## Design

### Approach

- **Resolve once per compilation (item 1).** `getCompilerInstance` stops calling `updateLoaderConfig` for a cached
  instance. Options are resolved when the instance is created and again only when an input changed: the
  `websmith.config.json`, the `tsconfig.json` or a file in its `extends` chain in `compiler.modifiedFiles`, or a
  change of the loader options' hash (`loader-options.ts:66`), which already selects a different instance. The
  per-module `NormalModule` `loader` tap (`webpack-hooks.ts:163-182`), which re-reads the config file as loader
  options and reports through `console.warn`, is removed; it only filled the unused `profiles` field.
  - **Inputs as dependencies.** `tsconfig.json` is not a webpack dependency on `develop` (only the config file is,
    `webpack-hooks.ts:120-125`), so `modifiedFiles` would never contain it and a `tsconfig.json` edit would be
    silently ignored once resolution stops running per module. The loader therefore adds the config file, the
    `tsconfig.json` and every `extends` target (`parsedCommandLine`'s `extendedSourceFiles`) as **module** file
    dependencies (missing dependencies when absent) through the loader context. That makes them appear in
    `modifiedFiles`, rebuild every websmith module when they change (their options changed), and invalidate the
    persistent cache across processes (part of item 8). The compilation-level registration in `afterCompile` stays
    for builds where no module is rebuilt.
  - **Without a webpack compiler** (thread-loader) each worker holds its own instance and re-resolves when the mtime
    of any file in that same list (config, `tsconfig.json`, `extends` targets) changed; one `stat` per file per
    module costs microseconds.
  - **Caches `setOptions` clears today**, each decided (`Compiler.ts:318-338`):

    | Cache / effect | Today | After |
    |---|---|---|
    | `packageJsonInfoCache` | cleared per module | reset per compilation (`resetCompilationCaches`, `thisCompilation`) |
    | `rootFilesCacheInvalidated` | set per module, `src/` walked again (`Compiler.ts:1519-1533`) | set per compilation, so files added under watch are seen |
    | `baselineEmitCache`, `baselineEmitCacheFileTimes` | cleared per module, so the mtime eviction (`Compiler.ts:1143-1161`) never ran in the loader | reset per compilation and on options change; the key is per file text, but a declaration or type-dependent emit also depends on imported files, so it must not outlive a compilation. The eviction path gets a unit test. |
    | `baselineTranspileCache` | cleared per module | kept across compilations, cleared on options change: a transpile depends only on the file text and options, both in the key |
    | `reportedWatchDiagnostics` | cleared per module | reset per compilation, so each rebuild reports current file-less diagnostics once (feeds item 6) |
    | addon registry `refresh()` + `WebpackAddonService` rebuild (`TsCompiler.ts:181`) | per module | per compilation and on options change (see addon lifetime) |
    | `getCheckedEsm` "not ESM" report (`TsCompiler.ts:305` relies on per-module re-resolution) | reported per module | reported once per options resolution; the comment and coupling are removed and a unit test pins it |

  - **Addon lifetime.** Today every module reloads the addon registry and re-activates the addons, so addon state
    lives one module and an edited addon is picked up on the next module. After this slice the registry refreshes in
    `thisCompilation` (cheap: its file-time cache skips unchanged addons) and the `WebpackAddonService` is rebuilt
    only when the registry or the options changed. Addon instances live for a compilation and across rebuilds while
    unchanged; an addon edit under watch is picked up on the next rebuild. This is stated in `packages/api`'s
    `AddonContext` docs and `packages/webpack/README.md`: addons must not rely on being re-activated per module. Before
    the slice merges, qs-magellan's `magellan-addons` (`client-function-transform` and the generators) are checked for
    per-module state.
  - **Scope of "once".** Resolution is once per loader instance per compilation. Two loader rules with different
    options are two instances; a `MultiCompiler` (client + server) has one instance per child compiler, each with its
    own `watchRun`, `afterCompile` and dedup. Slice tests cover both shapes.
  - **Benchmark first.** `packages/webpack-test/perf/esm-watch-bench.cjs` measures the gain once its watchdog race
    is fixed in its own preceding branch (a generation token, not only a cleared timer, `:240`, `:265-269`).
- **`depends` closure in core (prerequisite of item 7).** The closure exists four times: `getUsedProfiles`
  (`resolve-compiler-config.ts:138`, a `Set`), `getDependentProfiles` (`options/ResolvedCompilerOptions.ts:318`, a
  reverse-order array that decides the `tsConfig` merge order, `:347-349`), `WebpackAddonService.getAddonsWithDependencies`
  (`WebpackAddonService.ts:518`, addon order) and `AddonRegistry.getExpectedAddonsWithDependencies`
  (`compiler/addons/AddonRegistry.ts:194`). One core function returns the ordered closure, with the cycle and
  missing-profile handling made explicit; the four callers use it and keep their observable order. It is a
  behaviour-neutral refactor in its own branch, pinned by characterisation tests written first. #136
  `cli-error-exit-gaps` leaves these copies to this plan.
- **Convert names (item 2).** `convertEnumOptions` moves from `resolve-compiler-config.ts` (module-private) into its
  own exported core module, `packages/core/src/compiler/config/convert-enum-options.ts`, re-exported from
  `@quatico/websmith-core`. `ResolvedCompilerOptions` calls it before `getTsConfig` (`:178`) on the loader-option
  `tsConfig` and on each profile's `tsConfig` of the **merged** config (an inline `config.profiles` replaces file
  profiles wholesale through `Object.assign`, `options.ts:66`), with `this.reporter`, which is the collecting
  `ConfigErrorReporter` in the loader. `createOptions` does not convert: it reports to a `NoReporter`
  (`loader-options.ts:59`, `options.ts:15`), so errors raised there would be lost. File profiles keep their conversion
  with the file path. The conversion is idempotent (values that are already numbers pass through), because loader
  options can pass through it more than once. Error wording, in the #131 format:
  - file profile: `Invalid 'tsConfig.module' value 'x' in profile 'p' of '<configFile>'.` (unchanged);
  - inline profile: `Invalid 'tsConfig.module' value 'x' in profile 'p' of the loader options.`;
  - loader-option `tsConfig`: `Invalid 'tsConfig.module' value 'x' in the loader options.`.
  #135 `tsc-option-parity` (`bug/profile-lib-names`) extends this function to string arrays such as `lib` after this
  slice lands, and keeps it idempotent for the `lib.*.d.ts` form.
- **The top-level `profiles` loader option.** `WebpackLoaderOptions.profiles` is declared and documented but dropped by
  `createOptions` and read nowhere; it was superseded by `profile` + `config.profiles` in `2c7aab3a`. It is removed
  from the type, the README and `createOptions`; since webpack configs are often untyped JavaScript, a loader
  options object that still carries `profiles` gets a configuration error: `'profiles' is not a loader option; use
  'config.profiles'.`. `Release-Notes.md` gets a Breaking line. Part of the option-names slice.
- **Errors once (item 6).** File-less TypeScript diagnostics from `build` join the config errors and are reported once
  per compilation through the existing dedup in `afterCompile` (`webpack-hooks.ts:126-135`); without hooks the loader
  remembers what it reported until the options change, as #130 does for CLI watch. The dedup key is the formatted
  message, so option diagnostics that #136's `bug/report-file-less-diagnostics` adds to per-file fragments are
  covered too.
- **Unconfigured profile (item 7).** Profile validation moves from `getFragmentProfile` (a warning) into core option
  resolution as a config error in the #131 format, reported once: `Profile 'x' is not configured in '<configFile>'.
  Available profiles: a, b.`, and `Profile 'x' is passed but no websmith.config.json was found.` when there is no
  config (today `resolveProfile`, `resolve-profile.ts:9-24`, returns early on `!config`, and `getFragmentProfile`
  checks only `config?.profiles`). The validation walks the unified closure, so a missing `depends` target is the same
  error. Modules then fail with that error instead of the thrown `Error` from `Compiler.emitSourceFile`
  (`Compiler.ts:571`). Boundary: the CLI's handling of the same throw stays with #136; this slice changes the shared
  validation, the loader's reporting and the loader's skip of the emit.
- **Dependent-profile diagnostics (item 5).** `build` adds each dependent profile's `fragment.diagnostics`, labelled
  with the profile; a diagnostic identical (file, position, code, message) to one of the target or of another
  dependent is reported once. File-less ones go through the item-6 dedup. `Release-Notes.md` calls out that builds
  with errors only in a dependent profile now fail.
- **`package.json` by `"type"` (items 3, 4).** The loader records, per module, the nearest `package.json` and its
  `"type"` in the module's `buildInfo` for every node16/nodenext profile (ESM check or not), and no longer registers
  `package.json` as a plain file dependency. A `NormalModule.getCompilationHooks(compilation).needBuild` tap re-reads
  the recorded `package.json` (once per file per compilation) and returns `true` only if its `"type"` differs.
  Reading webpack 5.97.1 (`NormalModule.needBuild`, `lib/NormalModule.js:1474-1525`): the hook runs after the snapshot
  is found valid and a `true` result rebuilds the module, so it can force a rebuild of an unchanged module; keeping
  the recorded `"type"` in `buildInfo` lets it survive the persistent cache, which serializes `buildInfo`. Missing
  `package.json` files stay missing dependencies, since one appearing can change the format. A project without
  node16/nodenext profiles gets no tap work and no new dependency. The `"type"` reading is shared with the CLI's
  `registerPackageJsonWatches` (`Compiler.ts:929`).
- **Cached builds (item 8).** Reproduce first. The loader stays "just a loader": no plugin users must add. Invalidation
  is covered by slice 2's module dependencies. For the remaining case, an unchanged invalid config restored from the
  cache, the loader attaches each config error as a module error to one carrier module per compilation (the first
  module that reports it); webpack serializes module errors with the module and re-reports them when it is restored.
  Only if the reproduction shows a carrier module is not enough does the slice add a plugin, and then the loader
  registers it itself on the compiler.
- **Tests per slice:** unit tests in `packages/webpack/src` and `packages/core/src` (assemble/act/assert, `testObj`,
  `actual`) that fail before the change, and an end-to-end case in `packages/webpack-test/tests` for each user-visible
  change; the Definition of Done (`pnpm lint`, `pnpm test`, `pnpm build`, `pnpm test:e2e`) and a `Release-Notes.md`
  entry.

### Open Points

- [x] **Re-resolve trigger without a compiler.** — decided: under thread-loader, stat the config file, the
      `tsconfig.json` and every `extends` target per module; with a compiler, register the same list as module
      dependencies. Reason: one list serves both paths, statting it costs microseconds, and registering it is the only
      way `modifiedFiles` sees a `tsconfig.json` edit; addon-directory changes under thread-loader still need a worker
      restart, as they do today through the require cache. Pending approval.
- [x] **Measured gate for resolve-once.** — decided: (a) the 1000-module initial build drops by at least 80% against a
      `develop` build of the same generated project, measured by a documented manual procedure the watchdog branch adds
      to the benchmark header (same `--modules`, `--processes`, median of 3, both numbers in the PR), since the bench is
      not run in CI; (b) a 20-module starter-shaped build is not slower than on `develop` (within 5%); (c) the
      ESM-check gate becomes absolute ms per rebuilt module, no higher than on `develop`, and the variant C flip text is
      rewritten. Reason: the share gate's denominator shrinks with this change, so the share rises without a
      regression; an absolute bound guards the same thing. Pending approval.
- [x] **`convertEnumOptions` location.** — decided: an exported core module
      (`packages/core/src/compiler/config/convert-enum-options.ts`) called from `ResolvedCompilerOptions` with the
      collecting reporter, moved in this plan's option-names slice; #135's `lib` slice builds on it afterwards.
      Reason: only core holds the reporter that reaches webpack, and the CLI's `--tsConfig` JSON gets the same
      behaviour. Pending approval.
- [x] **`needBuild` for `"type"` changes.** — decided: use the `needBuild` tap with the `"type"` kept in `buildInfo`.
      Reason: webpack 5.97.1's source calls the hook after a valid snapshot and rebuilds on `true`, and `buildInfo`
      survives the persistent cache. This is a reading, not a run, so the slice's first step is the red e2e that proves
      it; only if that fails does the slice fall back to a stamp file per `package.json` that changes with `"type"`.
      Pending approval.
- [x] **Item 8 mechanism.** — decided: no user-added plugin; config, `tsconfig.json` and `extends` targets as module
      dependencies for invalidation (slice 2), config errors carried as module errors of one carrier module; a
      loader-registered plugin only if the reproduction shows that is not enough. Reason: the starter and qs-magellan
      use the loader alone, and a required plugin would break that contract. Pending approval.
- [x] **Top-level `profiles` loader option.** — decided: remove it from `WebpackLoaderOptions` and report a config error
      when it is still passed, with a Breaking line in `Release-Notes.md`. Reason: it has been ignored since `2c7aab3a`,
      wiring it through would duplicate `config.profiles`, and a silent drop turns into a confusing "unconfigured
      profile" error. Pending approval.
- [x] **Addon reload under watch.** — decided: refresh the addon registry once per compilation; addon instances live for
      a compilation and across unchanged rebuilds; documented in `packages/api` and the webpack README. Reason: per
      compilation keeps addon edits visible under watch at a cost the registry's file-time cache keeps small. Pending
      approval.

## Slices

### Benchmark

- `infra/esm-bench-watchdog` — `esm-watch-bench.cjs` watchdog race fixed with a generation token, so a late `done` after the watchdog fired starts no second step chain; the step scheduler extracted and unit-tested (a late `done` after a timeout runs `next` once — fails before); the initial build recorded and the manual `develop` baseline procedure documented in the header; no product change <!-- builds: race-free esm-watch-bench step scheduler and documented baseline procedure -->

### Resolve once

- `bug/loader-resolve-options-once` — options resolved at instance creation and on change of config file, `tsconfig.json`, its `extends` chain (module dependencies; mtime under thread-loader) or options hash only; per-module `loader` tap removed; caches per the table; addon registry per compilation; lands before #132's Vite core extraction and #136's `bug/report-file-less-diagnostics`. Red-first unit tests: `setOptions` runs once over N modules of one compilation (`compiler-instances.spec.ts`), a `tsconfig.json` and an `extends` target are module dependencies, the baseline-emit eviction path, the `getCheckedEsm` report once. E2E: watch edit of `tsconfig.json` and of an `extends` target takes effect (fails before: not watched); break `websmith.config.json` under watch, error shown, fix, clean; edit a dependency of a transformed module under watch and the output changes; a starter-shaped build (loader scoped by `include` next to `ts-loader`, `tsConfigFile`, addon profile) edited under watch; two loader rules and a `MultiCompiler` each resolve once per compilation. Benchmark gate numbers in the PR <!-- builds: once-per-compilation option resolution, tsconfig/extends dependencies, per-compilation cache and addon lifetime --> <!-- waits: infra/esm-bench-watchdog -->

### depends closure

- `bug/depends-closure-core` — one ordered `depends` closure in core used by `getUsedProfiles`, `getDependentProfiles`, `WebpackAddonService.getAddonsWithDependencies` and `AddonRegistry.getExpectedAddonsWithDependencies`; characterisation tests written first on each caller for order, cycles and missing targets, then unit tests of the new function (fail before: it does not exist); no behaviour change, existing e2e suites green <!-- builds: shared depends closure in core -->

### Option names

- `bug/loader-tsconfig-enum-options` — `convertEnumOptions` moved to an exported core module and applied in `ResolvedCompilerOptions` to loader-option `tsConfig` and the merged `config.profiles`, unknown names reported as config errors with the loader-options wording, idempotent; top-level `profiles` removed from `WebpackLoaderOptions` and reported as a config error when passed; Breaking line in `Release-Notes.md`, README updated; lands before #135's `bug/profile-lib-names`. Unit tests in `convert-enum-options.spec.ts`, `ResolvedCompilerOptions.spec.ts`, `options.spec.ts`; e2e: `module: "NodeNext"` as a loader option takes the nodenext path, `module: "nope"` fails with one config error, a loader with `profiles` fails with the `config.profiles` hint <!-- builds: convertEnumOptions in websmith-core applied to loader options; profiles loader option removed --> <!-- waits: bug/loader-resolve-options-once -->

### Option errors once

- `bug/loader-option-errors-once` — file-less TypeScript diagnostics reported once per compilation, also without compilation hooks; unit tests on the dedup with and without hooks; e2e: an invalid `tsconfig.json` option over several modules yields one error, also with two rules <!-- builds: file-less diagnostic dedup in the loader --> <!-- waits: bug/loader-resolve-options-once -->

### Unconfigured profile

- `bug/loader-unknown-profile-error` — an unconfigured profile, a profile without a config file and a missing `depends` target are config errors in the #131 format naming the available profiles, reported once, no stack trace; `getFragmentProfile` removed; unit tests in core and `TsCompiler.spec.ts`; e2e: a loader with `profile: "missing"` and one with a profile but no `websmith.config.json` <!-- builds: profile validation as a config error in core option resolution --> <!-- waits: bug/depends-closure-core -->

### Dependent-profile diagnostics

- `bug/loader-dependent-profile-diagnostics` — dependent profiles' TypeScript diagnostics reach webpack, labelled with the profile, identical diagnostics across profiles reported once; behaviour-change line in `Release-Notes.md`; unit tests in `TsCompiler.spec.ts`; e2e: a declaration-emit error only in a dependent profile fails the build, an error in both profiles appears once <!-- builds: dependent fragment diagnostics in TsCompiler.build --> <!-- waits: bug/loader-option-errors-once -->

### package.json "type"

- `bug/loader-package-type-deps` — first step: the red e2e that a `"type"` flip under watch rebuilds through a `needBuild` tap (stamp-file fallback only if it fails); then the nearest `package.json` and its `"type"` recorded in `buildInfo` for every node16/nodenext profile, rebuild only when `"type"` changes (reproduce the non-`esm` nodenext case first); unit tests; e2e in watch mode: a `"type"` flip rebuilds, a `"version"` edit does not, a project without node16/nodenext gets no `package.json` dependency <!-- builds: package type tracking in buildInfo with a needBuild tap --> <!-- waits: bug/loader-resolve-options-once -->

### Cached builds

- `bug/loader-cached-config-errors` — to reproduce first: a build restored from the persistent cache reports config errors, and a config or `tsconfig.json` edit between two runs invalidates it; config errors carried as module errors of a carrier module; e2e with `cache: { type: "filesystem" }` built twice, and edited between runs <!-- builds: config errors restored from the persistent cache --> <!-- waits: bug/loader-resolve-options-once -->

## Notes

- Created 2026-10-02 from the story `node24-esm-support`; three sibling plans (`cli-error-exit-gaps`,
  `tsc-option-parity`, `esm-check-precision`) take the story's CLI, option-parity and ESM-check findings.
- **Amended after the draft panel** (`.plot/panels/2026-10-02-loader-options-once/`, unanimous amend):
  `tsconfig.json` and its `extends` chain registered as module dependencies; every cache `setOptions` clears listed
  and decided; addon lifetime stated and documented; the benchmark watchdog fix split into its own first branch and
  slice 1's tests made red-first; the gate re-specified (baseline procedure, starter build, absolute check time);
  `convertEnumOptions` moved into core with the collecting reporter and loader-options wording; the top-level
  `profiles` option removed with a config error; the `depends` closure split into its own branch (four copies, not
  three); unknown profile without a config file covered; dependent-profile diagnostics deduplicated across profiles;
  `needBuild` decided by reading webpack 5.97.1 with a red e2e as the slice's first step; item 8 decided without a
  user-added plugin; multi-rule and `MultiCompiler` shapes and a dependency-edit e2e added for the panel's blind
  spots. **Cross-plan order:** `bug/loader-resolve-options-once` lands before #132's Vite core extraction and before
  #136's `bug/report-file-less-diagnostics`; `bug/loader-tsconfig-enum-options` lands before #135's
  `bug/profile-lib-names`, which builds on the core `convertEnumOptions`.
- **Dropped as already fixed:**
  - Item 9, the parse cache under thread-loader: #125 caps each `CompilationScanCache` generation at 5000 files
    (commit `2094e0c`, `TsCompiler.ts:54-85`).
  - The `packages/webpack-test` lint glob: `"lint"` already covers `{src,tests,perf}` (commit `9fca238`,
    `packages/webpack-test/package.json:9`).
  - `hasInvalidProfile` no longer exists (removed by #130). The panel amendment found a fourth `depends` walk,
    `AddonRegistry.getExpectedAddonsWithDependencies`.
- **Kept, partly fixed:** item 3; #125 registers `package.json` only for profiles with the ESM check.
- **To reproduce first:** item 8 (cached builds), and the non-`esm` nodenext case of item 3.
- **Found while checking:** a second per-module re-resolution in the `NormalModule` `loader` tap
  (`webpack-hooks.ts:163-182`), which passes the parsed `websmith.config.json` as loader options and writes
  `console.warn` from production code; folded into the resolve-once slice. The benchmark watchdog race (if the
  watchdog fires and the rebuild finishes later, two step chains run, `esm-watch-bench.cjs:240`, `:265-269`) is its
  own branch.
- **Deliverable search** (`plot-deliverable-search.sh`):
  - `resolveLoaderOptions`: `packages/webpack/src/loader-options.ts:49`, the per-options-object resolution that
    the resolve-once slice builds on, not a duplicate.
  - `convertEnumOptions`: `packages/core/src/compiler/config/resolve-compiler-config.ts:81`; the option-names slice
    moves it rather than writing a second conversion.
  - `reportedConfigErrors`: `packages/webpack/src/webpack-hooks.ts:19`, the per-compilation dedup that the
    errors-once slice extends.
  - `getFragmentProfile`: `packages/webpack/src/TsCompiler.ts:362`, replaced in the unconfigured-profile slice.
  - `getUsedProfiles`: `resolve-compiler-config.ts:138`; with `getDependentProfiles`, `getAddonsWithDependencies` and
    `getExpectedAddonsWithDependencies` it is what the `depends` closure slice unifies.
  - `needBuild`: no hit in the code; the `package.json` slice adds the first tap.
  - `nextCompilation`: `TsCompiler.ts:81`, the eviction #125 already added (why item 9 is dropped).
  - `useCompilationHooks`: `TsCompiler.ts:189`, the flag the errors-once and cached-builds slices depend on.
