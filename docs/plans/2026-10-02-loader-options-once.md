<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# Resolve webpack loader options once per build

> Resolve the webpack loader's options once per build instead of once per module, then fix the loader gaps that
> per-module resolution hid or caused: unconverted `tsConfig` names, repeated option errors, an unconfigured profile's
> stack trace, dropped diagnostics of dependent profiles, `package.json` rebuilds, and config errors lost on a cached
> build.

## Status

- **State:** Draft
- **Type:** bug
- **Story:** node24-esm-support
- **Review:** pr
- **Impl:** own branches
- **Rounds:** 1
<!-- Transition records — written by the workflow commands, not by hand:
- **Approved:** <date>, <who>, <channel>
- **Started:** <date>, <who>, <branch>   (one line per started branch)
-->

## Changelog

- The webpack loader resolves its options and `websmith.config.json` once per compilation instead of once per
  module, which removes about 150–300 ms per module from initial builds and mass rebuilds.
- Loader-option `tsConfig` and inline `config.profiles` accept option names such as `module: "NodeNext"`, as
  `tsconfig.json` does.
- The loader reports a TypeScript option error (e.g. TS5053, TS5070) once per compilation instead of once per module.
- An unconfigured profile name fails the build with a configuration error instead of a `Module build failed` stack
  trace.
- TypeScript errors that only a dependent profile produces, e.g. a declaration-emit error, fail the webpack build.
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
per module, and its cache clearing currently masks stale-state problems that resolving once would expose (the
`packageJsonInfoCache` in particular). So it goes first.

## Design

### Approach

- **Resolve once per compilation (item 1).** `getCompilerInstance` stops calling `updateLoaderConfig` for a cached
  instance. Options are resolved when the instance is created, and again only when an input changed: the
  `websmith.config.json` or `tsconfig.json` in `compiler.modifiedFiles` (the `watchRun` tap at `webpack-hooks.ts:95`
  already does this for the config file), or a change of the loader options' hash (`loader-options.ts:66`), which
  already selects a different instance. The per-module `NormalModule` `loader` tap (`webpack-hooks.ts:163-182`),
  which re-reads the config file as loader options and reports through `console.warn`, is removed. Caches that today
  survive only because every module clears them, the `packageJsonInfoCache` (`Compiler.ts:322`) first, move to the
  `thisCompilation` reset (`resetCompilationCaches`, `TsCompiler.ts:209`). Without a webpack compiler (thread-loader)
  the instance re-resolves when the config file's mtime changes. The benchmark
  `packages/webpack-test/perf/esm-watch-bench.cjs` measures the gain; its watchdog race is fixed first so the numbers
  are trustworthy.
- **Convert names (item 2).** `createOptions` passes the loader-option `tsConfig` and each inline profile's `tsConfig`
  through the same conversion as file profiles; `convertEnumOptions` is exported from core (or a thin wrapper is) and
  reports unknown names as config errors of the selected profile, as #131 does.
- **Errors once (item 6).** File-less TypeScript diagnostics from `build` join the config errors and are reported once
  per compilation through the existing dedup in `afterCompile` (`webpack-hooks.ts:126-135`); without hooks the loader
  remembers what it reported until the options change, as #130 does for CLI watch.
- **Unconfigured profile (item 7).** Validating the profile becomes a config error in the #131 format, reported once;
  modules then fail with that error instead of the thrown `Error`. The `depends` closure, which exists three times
  (`getUsedProfiles`, `resolve-compiler-config.ts:138`; `getDependentProfiles`, `ResolvedCompilerOptions.ts:318`;
  `WebpackAddonService.getAddonsWithDependencies`, `WebpackAddonService.ts:518`), is unified in core in the same
  slice, because the validation walks it.
- **Dependent-profile diagnostics (item 5).** `build` adds each dependent profile's `fragment.diagnostics`, labelled
  with the profile, and file-less ones go through the item-6 dedup.
- **`package.json` by `"type"` (items 3, 4).** The loader records, per module, the nearest `package.json` and its
  `"type"` for every node16/nodenext profile (ESM check or not), and no longer registers `package.json` as a plain
  file dependency. In `watchRun`, a modified `package.json` is re-read; only if its `"type"` changed are its modules
  rebuilt, through `NormalModule.getCompilationHooks(compilation).needBuild`. Missing `package.json` files stay
  missing dependencies, since one appearing can change the format.
- **Cached builds (item 8).** Reproduce first. If confirmed, config errors are carried by something webpack restores:
  either the hooks are registered by a small plugin independent of the loader, or the errors are recorded in a
  module's build info and replayed in `afterCompile`.
- **Tests per slice:** unit tests in `packages/webpack/src` and `packages/core/src` (assemble/act/assert, `testObj`,
  `actual`), and an end-to-end case in `packages/webpack-test/tests` for each user-visible change; the Definition of
  Done (`pnpm lint`, `pnpm test`, `pnpm build`, `pnpm test:e2e`) and a `Release-Notes.md` entry.

### Open Points

- [ ] **Re-resolve trigger without a compiler.** Under thread-loader there is no `watchRun`; mtime of the config file
      and `tsconfig.json` per module is cheap, but `extends` chains of `tsconfig.json` are not covered. Accept, or
      also stat the `extends` targets?
- [ ] **Measured gate for slice 1.** Proposed: the benchmark's initial build of 1000 modules drops by at least 80%
      against `develop`, and the ESM-check share stays within the existing ≤10% gate.
- [ ] **`convertEnumOptions` location.** Export it from `@quatico/websmith-core` as is, or move the conversion into
      `resolveCompilerOptions` so the CLI's `--tsConfig` JSON and the loader share one place.
- [ ] **`needBuild` for `"type"` changes.** Confirm that webpack 5.97's `needBuild` hook can force a rebuild of a
      module whose snapshot is valid; otherwise fall back to a generated stamp file per `package.json` that changes
      only with `"type"`.
- [ ] **Item 8 mechanism.** Plugin or build-info replay, decided after the reproduction. If it needs a plugin users
      must add, the slice also updates `packages/webpack/README.md`.

## Slices

### Resolve once

- `bug/loader-resolve-options-once` — options resolved at instance creation and on config/tsconfig change only, per-module `loader` tap removed, `packageJsonInfoCache` reset per compilation, benchmark watchdog race fixed; unit tests for the re-resolve triggers, e2e: a watch build edits `websmith.config.json` and sees the change, benchmark numbers in the PR <!-- builds: once-per-compilation option resolution in getCompilerInstance and the watchRun/thisCompilation taps -->

### Option names

- `bug/loader-tsconfig-enum-options` — loader-option `tsConfig` and inline `config.profiles` converted like file profiles, unknown names reported as config errors; unit tests in `options.spec.ts`, e2e: `module: "NodeNext"` as a loader option takes the nodenext path <!-- builds: convertEnumOptions applied in createOptions -->

### Option errors once

- `bug/loader-option-errors-once` — file-less TypeScript diagnostics reported once per compilation, also without compilation hooks; unit tests, e2e: an invalid `tsconfig.json` option over several modules yields one error <!-- builds: file-less diagnostic dedup in the loader -->

### Unconfigured profile

- `bug/loader-unknown-profile-error` — an unconfigured profile name is a config error in the #131 format, no stack trace; the `depends` closure unified in core and used by `getUsedProfiles`, `getSelectedProfiles` and `WebpackAddonService`; unit tests, e2e: a loader with `profile: "missing"` <!-- builds: unified depends closure in core and profile validation in TsCompiler -->

### Dependent-profile diagnostics

- `bug/loader-dependent-profile-diagnostics` — dependent profiles' TypeScript diagnostics reach webpack, labelled with the profile; unit tests in `TsCompiler.spec.ts`, e2e: a declaration-emit error only in a dependent profile fails the build <!-- builds: dependent fragment diagnostics in TsCompiler.build -->

### package.json "type"

- `bug/loader-package-type-deps` — nearest `package.json` tracked by `"type"` for every node16/nodenext profile; rebuild only when `"type"` changes (to reproduce first: the non-`esm` nodenext case); unit tests, e2e: in watch mode a `"type"` flip rebuilds and a `"version"` edit does not <!-- builds: package type tracking with a needBuild tap -->

### Cached builds

- `bug/loader-cached-config-errors` — to reproduce first: a build restored from the persistent cache reports config errors; e2e with `cache: { type: "filesystem" }` built twice <!-- builds: config error reporting independent of loader runs -->

## Notes

- Created 2026-10-02 from the story `node24-esm-support`; three sibling plans (`cli-error-exit-gaps`,
  `tsc-option-parity`, `esm-check-precision`) take the story's CLI, option-parity and ESM-check findings.
- **Dropped as already fixed:**
  - Item 9, the parse cache under thread-loader: #125 caps each `CompilationScanCache` generation at 5000 files
    (commit `2094e0c`, `TsCompiler.ts:54-85`).
  - The `packages/webpack-test` lint glob: `"lint"` already covers `{src,tests,perf}` (commit `9fca238`,
    `packages/webpack-test/package.json:9`).
  - `hasInvalidProfile` no longer exists (removed by #130), so the `depends` closure exists three times, not four.
- **Kept, partly fixed:** item 3; #125 registers `package.json` only for profiles with the ESM check.
- **To reproduce first:** item 8 (cached builds), and the non-`esm` nodenext case of item 3.
- **Found while checking:** a second per-module re-resolution in the `NormalModule` `loader` tap
  (`webpack-hooks.ts:163-182`), which passes the parsed `websmith.config.json` as loader options and writes
  `console.warn` from production code; folded into slice 1. The benchmark watchdog race (if the watchdog fires and the
  rebuild finishes later, two step chains run, `esm-watch-bench.cjs:240`, `:265-269`) is also folded into slice 1.
- **Deliverable search** (`plot-deliverable-search.sh`):
  - `resolveLoaderOptions`: `packages/webpack/src/loader-options.ts:49`, the per-options-object resolution that
    slice 1 builds on, not a duplicate.
  - `convertEnumOptions`: `packages/core/src/compiler/config/resolve-compiler-config.ts:81`; slice 2 reuses it rather
    than writing a second conversion.
  - `reportedConfigErrors`: `packages/webpack/src/webpack-hooks.ts:19`, the per-compilation dedup that slice 3
    extends.
  - `getFragmentProfile`: `packages/webpack/src/TsCompiler.ts:362`, replaced in slice 4.
  - `getUsedProfiles`: `resolve-compiler-config.ts:138`; with `getDependentProfiles` and
    `getAddonsWithDependencies` it is what slice 4 unifies.
  - `needBuild`: no hit in the code; slice 6 adds the first tap.
  - `nextCompilation`: `TsCompiler.ts:81`, the eviction #125 already added (why item 9 is dropped).
  - `useCompilationHooks`: `TsCompiler.ts:189`, the flag slices 3 and 7 depend on.
