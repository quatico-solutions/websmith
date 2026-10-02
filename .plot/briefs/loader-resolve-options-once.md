<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — loader-options-once (Resolve once: loader-resolve-options-once)

- **Plan (canonical):** `docs/plans/2026-10-02-loader-options-once.md` on `develop`
- **Approved:** 2026-10-02, Jan Wloka, plan-PR #134 merged
- **Branch:** `bug/loader-resolve-options-once` (base: `develop`)
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh` (on PATH). Do not merge it yourself.
- **Review of the code:** an independent review, plus uncached gates run by the maintainer's session before merge

**Ordering.** This slice waits on `infra/esm-bench-watchdog`, which merged today as #153. It is the plan's root, and
much waits on it:

- in this plan: `bug/loader-tsconfig-enum-options`, `bug/loader-option-errors-once`, `bug/loader-package-type-deps`
  and `bug/loader-cached-config-errors`. `bug/depends-closure-core` does not wait on it and may run in parallel.
- across plans: #132's Vite core extraction (`feature/neutral-module-compiler`, `docs/plans/2026-10-01-vite-plugin.md`)
  lands after this slice and reuses its once-per-compilation resolution. #136's `bug/report-file-less-diagnostics`
  lands after it. Every `esm-check-precision` slice that must edit `packages/webpack/src/TsCompiler.ts` is held until
  this one merges (that plan's `## Slices` preamble).

So a slow or half-done PR here blocks three plans. Keep the scope tight and the PR reviewable.

Line numbers below are from `develop` at `21823f79`. The plan cites `d7ffdf4`. Most have not moved;
`Compiler.ts` `setOptions` is now `:316-339` (plan `:315-338`), and the `getCheckedEsm` coupling comment is
`TsCompiler.ts:306` (plan `:305`). Re-find code by name if lines move again.

### What to build

**The failure.** The webpack loader resolves its options twice per module:

1. `getCompilerInstance` calls `instance.updateLoaderConfig(options)` on every call, also for a cached instance
   (`packages/webpack/src/compiler-instances.ts:44`). `updateLoaderConfig` (`TsCompiler.ts:177-186`) runs
   `setOptions`, which re-runs `resolveCompilerOptions`, re-reads `tsconfig.json`, clears caches and refreshes the
   addon registry (`packages/core/src/compiler/Compiler.ts:316-339`). Then it rebuilds the `WebpackAddonService`
   (`TsCompiler.ts:181`). A new instance resolves twice: once in the `Compiler` constructor (`Compiler.ts:154`) and
   once in `:44`.
2. The `NormalModule` `loader` tap (`webpack-hooks.ts:155-226`, the call at `:182`) reads and parses
   `websmith.config.json` for every module, passes it as loader options to `updateLoaderConfig`, and writes
   `console.warn` from production code.

The story measured 150–300 ms per module, about 150 s for a 1000-module initial build. Per-module resolution also
hides stale state: each module clears caches that must now get a real lifetime.

**The work** (the plan's Design → Approach, "Resolve once per compilation", and its cache table are the spec):

1. **Resolve at instance creation, then only on change.** `getCompilerInstance` stops calling `updateLoaderConfig`
   for a cached instance. A new instance resolves once, not twice: the constructor already resolves, so give the
   creation path the addon-service setup and the profile without a second `setOptions`. Re-resolve only when an input
   changed:
   - **With a webpack compiler:** in `watchRun`, when `compiler.modifiedFiles` holds the config file, the
     `tsconfig.json` or any file in its `extends` chain. `webpack-hooks.ts:90-97` already does this for the config
     file alone. Extend it to the whole list. A change of the loader-options hash already selects a different instance
     (`loader-options.ts:27`, `instance-cache.ts`).
   - **Without a webpack compiler** (thread-loader passes a stub without hooks, `instance-cache.ts:10-13`): per
     module, `stat` the same list and re-resolve when an mtime differs from the last resolution. Microseconds per
     file. Addon-directory edits under thread-loader still need a worker restart, as today through the require cache.
2. **Register the inputs as module dependencies.** `tsconfig.json` is not a webpack dependency on `develop`. Only
   the config file is, compilation-level, in `afterCompile` (`webpack-hooks.ts:120-125`). Without this step
   `modifiedFiles` never holds `tsconfig.json`, and a `tsconfig.json` edit under watch is silently ignored once
   resolution stops running per module. That would be a regression. In the loader, add the config file, the
   `tsconfig.json` and every `extends` target as **module** file dependencies through the loader context
   (`addDependency`), or as missing dependencies (`addMissingDependency`) when absent. Then they appear in
   `modifiedFiles`, rebuild every websmith module when they change, and invalidate the persistent cache across
   processes. Keep the compilation-level registration in `afterCompile` for builds that rebuild no module.
   - The `extends` targets are `extendedSourceFiles` of the parsed tsconfig. `getTsConfig` parses it through
     `parsedCommandLine` (`packages/core/src/compiler/options/ResolvedCompilerOptions.ts:351`,
     `config/parsed-command-line.ts:18`) and then drops everything except `.options`. Expose the list from core,
     e.g. on `ResolvedCompilerOptions`. Check in `typescript.d.ts` which property carries it publicly
     (`TsConfigSourceFile.extendedSourceFiles`); do not reach into `@internal` members.
3. **Remove the per-module `loader` tap.** Delete `registerCompilationHooks`, `createCompilationHandler`,
   `isValidWebsmithLoaderConfig` and the `compilation` tap (`webpack-hooks.ts:109-111`, `:148-226`). It only filled
   the unused `profiles` field (loader-config juror, "Checked and holds"). `isValidCompilation` is exported "for
   testing" (`:66`). If nothing else calls it, delete it with its tests (`webpack-hooks.spec.ts:216-330`). Do not
   keep dead code alive for its tests.
   - `comment-json` then has no import left in `packages/webpack/src`. **Leave `packages/webpack/package.json` and
     `pnpm-lock.yaml` alone.** Removing the dependency collides with two branches in flight (see Scope guard). Name
     it in the PR as a follow-up.
4. **Give each cache the lifetime the plan's table decides** (Design → "Caches `setOptions` clears today"):

   | Cache / effect | After this slice |
   |---|---|
   | `packageJsonInfoCache` | reset per compilation, in `resetCompilationCaches` (the `thisCompilation` tap, `webpack-hooks.ts:105-107`) |
   | `rootFilesCacheInvalidated` | set per compilation, so files added under watch are seen |
   | `baselineEmitCache`, `baselineEmitCacheFileTimes` | reset per compilation and on options change. The mtime eviction (`Compiler.ts:1143-1162`) never ran in the loader. It gets a unit test. |
   | `baselineTranspileCache` | kept across compilations, cleared on options change |
   | `reportedWatchDiagnostics` | reset per compilation |
   | addon registry `refresh()` + `WebpackAddonService` rebuild | registry refreshed in `thisCompilation`; service rebuilt only when the registry or the options changed |
   | `getCheckedEsm` "not ESM" report | once per options resolution; remove the comment at `TsCompiler.ts:306` and the coupling it describes |

   These are core fields and are private to `Compiler`. Add the narrowest protected or public hook that the webpack
   `TsCompiler` needs, e.g. extend `resetCompilationCaches` in `TsCompiler` to call a core
   `resetCompilationCaches`. Keep the CLI path's behaviour unchanged: `Compiler.setOptions` still clears what it
   clears today.
5. **Addon lifetime, documented.** Addon instances now live for a compilation and across unchanged rebuilds. An
   edited addon is picked up on the next rebuild. Say so in the `AddonContext` JSDoc
   (`packages/api/src/addons/AddonContext.ts:18`) and in `packages/webpack/README.md`: addons must not rely on being
   re-activated per module. **Before the PR leaves draft**, read qs-magellan's addons for per-module state (read
   only: `/Users/jwloka/Quatico/Magellan/qs-magellan/node/packages/addons`, the `client-function-transform` and
   generator addons). Put what you found in the PR, even when it is "none".
6. **Benchmark gates** (Open Point "Measured gate for resolve-once", (a)–(c)). This slice owns the gate changes that
   the watchdog branch deliberately left alone:
   - (c) In `packages/webpack-test/perf/esm-watch-bench.cjs`, the flip gate changes from the ESM-check share
     (`CHECK_SHARE_BUDGET`, `:52`, `:356`, `:373`) to **absolute ESM-check ms per rebuilt module, no higher than on
     `develop`**. Rewrite the header's flip text (`:22-25`): it says variant C rebuilds "each at the loader's existing
     per-module cost (compiler-instances.ts)", which stops being true here. `develop` prints `ESM check … ms` and
     `modules built` per scenario, so its ms per module is computable from its output without changing `develop`.
   - (a) Run the header's baseline procedure (`:30-38`) at `--modules 1000`. The initial-build median of variant A
     drops by **at least 80%** against `develop`'s merge base.
   - (b) A 20-module starter-shaped build is **not slower than on `develop`, within 5%**. Use the same procedure at
     `--modules 20` unless you build a closer starter shape. Say in the PR which one you used.
   - Put every number and the exact commands in the PR.

No `packages/*/src` change outside the loader, the minimal core hooks of step 4 and the `extends` list of step 2.

The plan is canonical. This brief is orientation.

### Settled decisions — do not re-derive them

- **Lazy instance plus triggers, not an eager plugin.** The performance juror proposed a plugin that resolves at
  `beforeRun`/`watchRun` and registers `buildDependencies`. The downstream juror accepts a plugin only if it is
  auto-registered: the qs-magellan starter (`react-typescript-webpack`) uses the loader alone, and a plugin users
  must add breaks that "just a loader" contract (panel "Where they differ", 2; Open Point "Item 8 mechanism"). Module
  dependencies give the same invalidation without a plugin. Do not add one in this slice.
- **Module dependencies for `tsconfig.json` and `extends`, not `compilation.fileDependencies` alone.** All three
  jurors found the trigger cannot fire without them. Module-level registration also rebuilds the modules whose
  options changed and invalidates the persistent cache. The compilation-level entry stays for the no-rebuild case.
- **One list for both paths** (Open Point "Re-resolve trigger without a compiler"). Registered as dependencies with a
  compiler, `stat`-ed per module without one. Rejected: statting only the config file and `tsconfig.json`. The
  performance juror showed that misses `extends` edits.
- **Per-cache lifetimes as in the table, not "keep everything" and not "reset everything per module".** Keeping the
  baseline emit cache for the process lifetime would serve stale declaration or type-dependent output when an
  imported file changes (downstream finding 2). Clearing per module is the cost this slice removes.
- **The addon registry refreshes per compilation.** Rejected: per module (today's cost) and once per process (addon
  edits under watch would go stale). The registry's file-time cache keeps the refresh cheap (loader-config finding 3).
- **The `loader` tap goes; nothing replaces it.** It parsed the whole config file as loader options, which only
  filled `ResolvedCompilerOptions.profiles`, which nothing reads. Removing the top-level `profiles` **option** and its
  config error belongs to `bug/loader-tsconfig-enum-options`. Do not do it here.
- **"Once" means once per loader instance per compilation** (Design → "Scope of 'once'"). Two loader rules with
  different options are two instances. A `MultiCompiler` has one instance per child compiler, each with its own
  `watchRun`, `afterCompile` and dedup. Do not try to share one resolution across rules or child compilers.
- **The gates read absolute numbers.** The ESM-check share rises when rebuild time falls, so the 10% share could fail
  without a regression (performance juror, finding 4).

### Done when

The plan's slice line is the specification. These are the assertions a naive implementation would pass without.
**Write each one red first.** The panel found that the draft's "edit `websmith.config.json` and see the change" e2e
passes on `develop`, so it proves nothing.

Unit tests (`packages/webpack/src`, `packages/core/src`):

- **`setOptions` runs once over N modules of one compilation** (`compiler-instances.spec.ts`). Spy on
  `TsCompiler.prototype.setOptions` and call `getCompilerInstance` three times with the same options and compiler.
  `develop` gives 4 (constructor plus 3); expect 1. A naive fix that only skips the cached path still gives 2 on
  creation.
- **Re-resolution happens on each trigger and only then** (`webpack-hooks.spec.ts`, next to `:184` and `:195`):
  `watchRun` with `tsconfig.json` in `modifiedFiles` re-resolves, so does an `extends` target, so does the config
  file; an unrelated file does not.
- **The thread-loader path** (no hooks): an mtime change of `tsconfig.json` or of an `extends` target between two
  `getCompilerInstance` calls re-resolves; no change does not.
- **`tsconfig.json` and an `extends` target are module dependencies**: the loader calls `addDependency` for both,
  and `addMissingDependency` for a missing one. Use a tsconfig that really `extends` another file.
- **The baseline-emit eviction path**: after an mtime change of a file, its `baselineEmitCache` entries are gone and
  other files' entries remain. This path has never run in the loader.
- **The cache lifetimes**: `resetCompilationCaches` resets `packageJsonInfoCache`, `reportedWatchDiagnostics` and
  the baseline emit cache, and keeps `baselineTranspileCache`. An options change clears both baseline caches.
- **The `getCheckedEsm` "not ESM" error appears once per resolution**, not once per module, over several modules
  (`TsCompiler.spec.ts`).
- **The addon registry refreshes once per compilation**, and the `WebpackAddonService` is not rebuilt when nothing
  changed.

End-to-end (`packages/webpack-test/tests`, under `pnpm test:e2e`; each must fail on `develop` unless noted):

- A watch edit of `tsconfig.json` takes effect, and so does an edit of an `extends` target. Both fail on `develop`
  because neither file is watched.
- Break `websmith.config.json` under watch: the error is shown. Fix it: the build is clean. This guards the removed
  tap's `console.warn` path and passes on `develop`; it is a guard, not a red test.
- Edit a dependency of a transformed module under watch, and the output changes. This is the stale-baseline-cache
  guard.
- A starter-shaped build edited under watch: the loader scoped by `include` next to `ts-loader`, `tsConfigFile`,
  an addon profile.
- Two loader rules, and a `MultiCompiler`, each resolve once per compilation. The webpack-test watch harness runs
  webpack in a child process (`webpack-esm-check.test.ts:296-314`), so a spy cannot count there. One way that works:
  an addon whose `activate` appends a line to a file, then count lines per instance and compilation.
- Put these in a **new** test file (e.g. `webpack-loader-resolve-once.test.ts`), not in `webpack-esm-check.test.ts`,
  and keep them snapshot-free (see Scope guard).

Also:

- **Benchmark numbers** (a), (b), (c) and their commands in the PR, run with Node 22 after `pnpm build` on both
  trees.
- **Tests follow `docs/rules/testing.md`:** assemble / act / assert with no part comments, `testObj` and `actual`,
  no shared `testObj`. `compiler-instances.spec.ts:15-34` shares a `tsCompiler` through `beforeEach`. Do not copy
  that pattern into new tests, and do not refactor the old ones in this PR.
- **Gates, all green:** `pnpm lint`, `pnpm build`, `pnpm test --skip-nx-cache`, `pnpm test:e2e --skip-nx-cache`.
- **`Release-Notes.md`**, under `## [Unreleased]`, from the plan's Changelog lines 1–3:
  - `### Changed`: options and `websmith.config.json` resolved once per compilation and loader instance (gain shows
    in large builds, not in a few dozen modules);
  - `### Changed`: addons loaded once per compilation; an addon instance is reused across modules, and an edited
    addon is reloaded on the next rebuild;
  - `### Fixed`: under watch the loader picks up edits to `tsconfig.json` and its `extends` targets, and a
    persistent-cache build is invalidated by them and by `websmith.config.json`.
- **Docs:** the addon lifetime in `packages/api/src/addons/AddonContext.ts` and `packages/webpack/README.md`.
- **New files carry the MIT license header** (`pnpm license:add`). Do not add them to the `license:check` list.

### Repo mechanics

- **pnpm 10** from `$HOME/.nvm/versions/node/v22.17.0/bin`: put it first on `PATH`. The Homebrew pnpm 11 fails with
  E401.
- **Installs:** `pnpm install --offline`. The Artifactory login in `~/.npmrc` is expired. **Never edit `~/.npmrc`.**
  If a registry package is unavoidable, use an empty file as `NPM_CONFIG_USERCONFIG` plus
  `--config.registry=https://registry.npmjs.org/`. This branch should need no new package.
- **Node 24** is at `$HOME/.nvm/versions/node/v24.21.0/bin/node`, for runtime checks.
- **Commits:** Arlo's notation without a colon (`commit-notation` skill). For example, `B Resolves loader options once
  per compilation instead of per module` (`B`: a bug fix with a behaviour change). The red tests and the fix may be
  separate commits.
- **Deleting files:** use `trash`, never `rm`.

### Bookkeeping

- Push the first real commit as soon as it exists.
- Open the PR with `plot-open-pr.sh`, never `gh pr create`. Then give it a descriptive title: the wave heading alone
  reads "Resolve once".
- Append `→ #<number>` to the `bug/loader-resolve-options-once` line in the plan's `## Slices` and commit that on
  this branch.

### Scope guard

This branch owns:

- `packages/webpack/src/compiler-instances.ts`, `loader.ts`, `webpack-hooks.ts`, `TsCompiler.ts`, and their `*.spec.ts`;
- in core, only the cache-reset hook in `Compiler.ts` and the `extends` list in
  `options/ResolvedCompilerOptions.ts` (plus their specs);
- `packages/webpack-test/perf/esm-watch-bench.cjs` (gate (c) and the flip text);
- the new e2e file in `packages/webpack-test/tests/`;
- `packages/api/src/addons/AddonContext.ts` (JSDoc only), `packages/webpack/README.md`, `Release-Notes.md`;
- the `→ #<PR>` line in `docs/plans/2026-10-02-loader-options-once.md`.

Do not touch:

- `convertEnumOptions`, `options.ts`, `WebpackLoaderOptions.profiles` (`bug/loader-tsconfig-enum-options`);
- the file-less diagnostic dedup in `loader.ts:34-38` and `afterCompile` (`bug/loader-option-errors-once`);
- `getFragmentProfile` and `resolve-profile.ts` (`bug/loader-unknown-profile-error`);
- the `package.json` dependencies from the ESM check (`bug/loader-package-type-deps`);
- `AddonRegistry.ts` and `resolve-compiler-config.ts` (see `bug/cli-config-parse-and-addons-dir` below);
- `package.json` files, `pnpm-lock.yaml`, tsconfigs, `eslint.config.js`, webpack-test snapshots.

Branches in flight or starting now, checked against their plans on `develop`:

- `bug/tsc-default-target-interop` (#161, `tsc-option-parity`), merging soon. It touches `Compiler.ts` at `:798`,
  `:802`, `:983`, `:1208`, `:1215` and `:1285`, plus `defaults.ts`, `config/effective-options.ts`, `system.ts`, the
  compiler-test fixtures, **webpack-test snapshots** and `Release-Notes.md`. **Real collision:** `:798`/`:802` are
  inside `getCheckedEsm`, whose "not ESM" report you change. Its new `getCheckedEsm` test (unset `module`/`target`)
  meets yours. Rebase onto `develop` once #161 merges, before you edit `getCheckedEsm` or `Compiler.ts`. Expect a
  `Release-Notes.md` conflict, append-only. Add no snapshot test.
- `bug/esm-check-import-misses` (#160, `esm-check-precision`), merging soon. It touches core ESM-check modules
  (`import-rules.ts`, `check-esm-imports.ts`), `bin.test.ts` and
  **`packages/webpack-test/tests/webpack-esm-check.test.ts`**. Collision only if you add e2e cases to that file, so
  use a new one. It makes no edit to `TsCompiler.ts`; later slices of that plan that must are held on this branch.
- `infra/typescript-6-toolchain` (`typescript-6-support`), in progress. It touches every package's tsconfigs,
  devDependency versions in `package.json` files, `pnpm-lock.yaml` and `fusion-fs.ts`. **Collision if you drop
  `comment-json`** from `packages/webpack/package.json`, which is why you leave it.
- `bug/trim-runtime-dependencies` (`dependency-updates`), starting now. It touches `browser-system.ts`, core,
  compiler-test and node `package.json` (`create-hash`, `path`, `lodash`), `pnpm-lock.yaml` and `Release-Notes.md`.
  **Collision:** `Release-Notes.md` (append-only), and `pnpm-lock.yaml` if you touch dependencies, which you do not.
- `bug/cli-config-parse-and-addons-dir` (`cli-error-exit-gaps`), starting now. It touches
  `resolve-compiler-config.ts`, `command.ts`, the `addonsDir` warning in `AddonRegistry`, `bin.test.ts` and
  `Release-Notes.md`. **Collision:** `Release-Notes.md`. A soft overlap too: that branch moves the `addonsDir`
  warning into the `AddonRegistry`, and the warning fires per `refresh()`. Today that is per module; after you, it is
  per compilation. Move the refresh call site, but do not edit `AddonRegistry.ts` or the warning.

Not in flight, but it depends on this branch's shape: #132's `feature/neutral-module-compiler` lifts `TsCompiler.build`
and `getConfigErrors()` into a core `ModuleCompiler` and reuses this slice's once-per-compilation resolution. Keep the
resolution and trigger logic in `TsCompiler`/`compiler-instances.ts`, with webpack types confined to the hook wiring.
That keeps it liftable. Do not design for Vite beyond that.

If you find something the plan did not anticipate, report it rather than improvising outside scope. Two places to
check: whether `extendedSourceFiles` is reachable without internals, and whether a single resolution exposes stale
state the cache table did not name.
