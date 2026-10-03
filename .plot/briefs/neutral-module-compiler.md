<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — vite-plugin (Neutral module compiler: neutral-module-compiler)

- **Plan (canonical):** `docs/plans/2026-10-01-vite-plugin.md` on `develop`
- **Approved:** 2026-10-02, Jan Wloka, plan-PR #132 merged
- **Branch:** `feature/neutral-module-compiler` (base: `develop`)
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh` (on PATH). Do not merge it yourself.
- **Review of the code:** an independent review, plus uncached gates run by the maintainer's session before merge

**Ordering.** This is the plan's first slice. Its prerequisite, #134's `bug/loader-resolve-options-once`, merged as
#165 (`f7cc3606`). Every later slice of this plan waits on it: `feature/vite-plugin-tracer` builds the Vite host on the
`ModuleCompiler` this branch exports, and the Diagnostics, Addon outputs, Environments, Dev server and Dev invalidation
slices follow in heading order. Across plans, see Scope guard: the remaining #134 slices and #136's core slices either
start after this merges or rebase onto it.

Line numbers below are from `develop` at `accb3235`. The plan cites almost no lines; where it or its panel does, the
current location is given. Re-find code by name if lines move again.

### What to build

**The problem.** The per-module compile that a Vite plugin needs exists only inside the webpack loader, and the loader
package cannot be a dependency of a Vite plugin: it loads `webpack` at runtime.

- `packages/webpack/src/TsCompiler.ts:25` is a value import, `import { type LoaderContext, WebpackError } from "webpack"`.
  `WebpackError` is constructed at `:482` (`getFragmentProfile`), `:543` (addon failure) and `:551` (`logDebug`).
- `WebpackAddonService.ts:14` imports `LoaderContext` and `Compilation`. `WebpackAddonContext.ts:20` value-imports
  `sources` and calls `compilation.emitAsset` at `:175` and `:498`.
- `packages/webpack/package.json:2` names the package `websmith-loader` (unscoped). `:41-43` declares `webpack` as a
  peer dependency.

A Vite plugin that depended on the loader would put webpack into every Vite project. The plan therefore moves the
bundler-neutral part of `TsCompiler` into `@quatico/websmith-core` as `ModuleCompiler`. `TsCompiler` becomes the
webpack host of it, and the loader's behaviour does not change at all.

**What moves, read on `develop`.** `TsCompiler` (555 lines) is mostly neutral already. After #165 its trigger logic
holds no webpack type:

| Into core `ModuleCompiler` (neutral) | Stays in `TsCompiler` / the loader (webpack) |
|---|---|
| `LoaderBuildResult` shape (`:31-36`), as e.g. `ModuleBuildResult` | `MODULE_KINDS` (`:39-43`): webpack module type → `ModuleClassification["kind"]` |
| `CompilationScanCache` (`:54-85`), `ConfigErrorReporter` (`:91-129`) | the "Unknown webpack module type" debug `InfoMessage` (`:332-337`) |
| `setOptions` / `getConfigErrors` (`:173-184`) | `warn` / `error` callbacks typed `WebpackError` (`:133-134`, `:157-158`) |
| `updateLoaderConfig`, `getOptionsFiles`, `refreshOptions` (`:190-228`) | `loaderContext` (`:135`, `:159`) and `logDebug` via `emitWarning` (`:547-554`) |
| `refreshAddons`, `use/hasCompilationHooks`, `keepCachesPerCompilation`, `resetCompilationCaches`, `reportEsmCheckTime` (`:234-274`) | `setupWebpackAddonService` (`:448-476`) and `applyAddonFunctionality` (`:487-545`), behind the factory |
| `build` (`:280-347`) minus the module-type mapping, plus `checkLoaderOutput` (`:353-378`) with `NODE_IMPORT_RULES` (`:46`) | `getFragmentProfile` (`:478-485`): it warns with a `WebpackError` |
| `completeResolution`, `recordOptionsFiles`, `collectConfigErrors`, `getModifiedTime`, `getAddonsStamp` (`:381-433`) | `getCompilerInstance`, `isAddonsCheckDue`, `loadOptions` (`compiler-instances.ts:17-76`) |
| the `emitSourceFile` override with `skipCache` (`:444-446`) | the instance cache (`instance-cache.ts`), every hook tap (`webpack-hooks.ts:18-78`), `loader.ts` |

The trigger logic stays where #165 put it, in methods on the compiler that the webpack hooks call. Do not move it into
the hooks. The hooks stay in `webpack-hooks.ts` and only call the moved methods: `refreshOptions` from `beforeRun`
(`:21-25`) and `watchRun` (`:26-34`), `resetCompilationCaches` and `refreshAddons` from `thisCompilation` (`:42-45`),
`getOptionsFiles` and `getConfigErrors` from `afterCompile` (`:49-69`). Vite's `configResolved`, `buildStart` and
`hotUpdate` will call the same methods later.

**The contract** (plan Design → "Neutral contract"):

- `build(file, { moduleKind }) → { fragment, diagnostics, dependencies }`. `moduleKind` is
  `ModuleClassification["kind"] | undefined` (`packages/core/src/compiler/esm/classify-module.ts:27`, already exported).
  `dependencies` keeps today's `{ files, missing }`.
- `getConfigErrors()`, as today.
- `runResultProcessors(files)`: new. It runs the instance profile's result processors once over `files`, catches each
  throw separately, and returns the throws as error diagnostics. Model it on the core closure at
  `Compiler.ts:749-756`. Vite's `buildEnd` will call it. **The loader does not call it** (see Settled decisions).
- A host-supplied addon step (the plan's "`AddonContext` factory"). It is called where `build` calls
  `applyAddonFunctionality` today (`:326`): after the dependent profiles, before the target profile is emitted. Without
  a factory, the addons come from an `AddonRegistry` passed to the `Compiler` constructor. That is the CLI's path and
  the Vite host's. `TsCompiler` passes `undefined` there today (`:156`).
- `TsCompiler.build(resourcePath, moduleType?)` keeps its signature (`loader.ts:33` calls it). It maps `moduleType`
  through `MODULE_KINDS` and delegates.

Put the class in `packages/core/src/compiler/ModuleCompiler.ts` with a `ModuleCompiler.spec.ts`. Export it, its result
type and `CompilationScanCache` from `packages/core/src/compiler/index.ts`. `TsCompiler.ts` re-exports
`CompilationScanCache` and `LoaderBuildResult`: `TsCompiler.spec.ts:13` and `loader.spec.ts:16` import them from there.

The plan is canonical. This brief is orientation.

### Settled decisions — do not re-derive them

- **Core extraction, not "Vite depends on the loader".** The value imports above decide it. All three jurors read it
  that way, and the moderator verified `TsCompiler.ts:25` (panel "Where the jurors converge", row 1). Do not prototype
  the other option. `ModuleCompiler` must not import `webpack`, even as a type. `packages/core/package.json` has no
  `webpack` dependency, and pnpm's strict layout turns a stray import into a build failure, not a hidden coupling.
- **Inheritance: `Compiler` → `ModuleCompiler` → `TsCompiler`. Do not wrap a `ModuleCompiler` inside `TsCompiler`.**
  This brief takes the shape from the guard tests, not from the plan. `compiler-instances.spec.ts` and
  `webpack-hooks.spec.ts` spy on `TsCompiler.prototype.setOptions` and `refreshAddons` and count calls made from
  inside the compiler. `TsCompiler.spec.ts:27-47` subclasses `TsCompiler`, overrides `getSystem()`, and replaces
  `emitSourceFile` on the instance. With composition, those calls bypass the spies and the overrides, and the "green
  unchanged" guard fails for reasons unrelated to behaviour. `build` must keep calling the overridable
  `this.getSystem()` at the start. The error text stays exactly `TsCompiler.build() called without a valid ts.System`
  (`TsCompiler.spec.ts:77`). Write that text as a constant in core. The webpack-specific name in it is accepted for
  this slice.
- **Core `AddonRegistry` for Vite; `WebpackAddonService` stays in the loader behind the factory** (plan Open Point
  "Which registry"). `WebpackAddonService` exists to compile addons apart from webpack's TypeScript pass. It is bound to
  `LoaderContext` and `Compilation` (`applyAddonsToContext`, `WebpackAddonService.ts:103-138`). Moving the loader onto
  the core registry would change loader behaviour inside a slice that must change none. Keep these loader quirks as
  they are:
  - the `WebpackAddonContext` is cached per instance (`:504-515`) and bound to the `_compilation` of the module that
    first built it;
  - activation throws go to the reporter as `ErrorMessage` (`WebpackAddonService.ts:128-133`) and do not fail the
    build;
  - `generateAddonOutputs` (`:535`) sits behind `result.files.length > 0` (`:518`), and `build` feeds that branch a
    literal empty fragment (`:326`), so the branch never runs.

  The plan says this dead branch "stays as it is in the extraction". Aligning the loader is a follow-up issue.
- **Addon throws: the loader keeps its warning, and the core contract treats them as errors** (Open Point "Addon
  throws"). The webpack factory keeps the `try/catch` of `applyAddonFunctionality` (`:497-544`). That catch sends the
  failure only to the `warn` loader-option callback, as `Addon processing failed: …` (`:543`). It is not a module
  warning and not a diagnostic, and the build passes. `ModuleCompiler` turns a throw that escapes the factory into an
  error diagnostic, which is the Vite semantics. The webpack factory never lets one escape. Rejected: changing the rule
  for both hosts. That turns passing webpack builds red, and it belongs in its own loader issue with a release note.
- **Diagnostics are data.** `build` returns `ts.Diagnostic[]`. `loader.ts:57-72` (`reportDiagnostics`) renders them
  with `emitError` and `emitWarning`, and the `afterCompile` tap (`webpack-hooks.ts:58-68`) renders config errors once
  per compilation. Both stay in the loader. Configuration errors stay in `getConfigErrors()` and are never mixed into
  `build`'s diagnostics. Rendering them once is a host concern: `loader.ts:42-44` without hooks, `afterCompile` with
  hooks.
- **The diagnostics `build` returns stay exactly those of today.** That means the target's fragment diagnostics plus
  the ESM check of the target and of every dependent profile (`:315`, `:338`). The plan's contract says "including
  dependent profiles". For this slice that means their ESM-check findings only. Their TypeScript diagnostics are #134's
  `bug/loader-dependent-profile-diagnostics`, a behaviour change with its own release note. Do not add them here.
- **`dependencies` stays the ESM check's dependency set** (`:302-303`, `:346`). The loader adds the options files
  separately (`loader.ts:37-39`). Do not fold `getOptionsFiles()` into `build`'s result: `loader.spec.ts:478-490`
  asserts the exact `addDependency` and `addMissingDependency` calls.
- **Debug output is a host sink.** `logDebug` emits `[websmith-loader] …` as webpack warnings.
  `packages/webpack-test/tests/websmith-loader.test.ts:267-274` asserts eight of those lines, including "Addons loaded
  and ready", "Applied addon functionality for profile: default" and "Setting up WebpackAddonService - addonsDir:".
  `ModuleCompiler` takes a debug callback (no `console`; AGENTS rule 6). `TsCompiler` supplies the `emitWarning` sink,
  and the messages and their order stay byte-identical.
- **Per-module compile, not a Program per profile** (Open Point "Per-module or Program-level compile"). It is one code
  path for both hosts. The panel's blind spot is recorded as that decision. Do not add a `buildStart`-style
  whole-Program API.
- **TypeScript 5.x and 6.x only.** `ModuleCompiler` adds no TypeScript-API coupling beyond what `Compiler` already uses
  (TS 7 story `docs/stories/ts7-rearchitecture`). It must compile on 5.7.3 and on 6.0.3: #171 adds a TS 6 CI leg.

Rules carried over from #165 that this move must not break:

- **"Once" means once per instance per compilation.** `setOptions` runs once at creation (the `Compiler` constructor,
  `Compiler.ts:136`) and then only from `refreshOptions` on a change. The constructor must not resolve the options a
  second time. `compiler-instances.spec.ts` counts the `setOptions` calls.
- **`keepCachesPerCompilation` decides who resets.** With hooks, `thisCompilation` resets the caches. Without hooks,
  `build` resets them per module (`:296-300`). Keep that branch inside `build`.
- **The order inside `build` is behaviour.** Caches reset first, then the dependent profiles are emitted and checked,
  with their result processors run per file (`:305-323`). Then comes the addon step, then the target emit with
  `skipCache` (`:330`, `:444-446`), then its ESM check.

### Done when

The plan's slice line is the specification: "unit tests in core for the contract (must fail before: no core export),
existing webpack unit tests and `packages/webpack-test` green unchanged as the guard". These are the assertions a
naive extraction would pass without. Write the core ones red first:

Core (`packages/core/src/compiler/ModuleCompiler.spec.ts`; import from `../index` so the export itself is under test):

- **`build` compiles a module without webpack.** Use a real temp project or the existing test helpers, with a
  processor addon from an `AddonRegistry`. The returned fragment carries the processor's change. This is red on
  `develop`: there is no export.
- **`moduleKind` reaches the ESM check under `runtime: "bundler"` only.** Set up one bundler profile with `esm` where
  `moduleKind: "esm"` and no `moduleKind` (package.json classification) give different diagnostics. Under
  `runtime: "node"`, `moduleKind` is ignored and the node import rules (91010/91011/91013) apply. A naive move that
  drops the `esm.runtime === "bundler" && moduleKind` guard (`:373`) passes every webpack test but fails this one.
- **A throw from the host addon step is an error diagnostic in `build`'s result**, not a reporter print and not a
  crash.
- **`runResultProcessors(files)` runs each result processor of the instance profile once with `files`.** A throwing
  processor yields an error diagnostic, and the processors after it still run.
- **`getConfigErrors()` holds an unknown profile's error and the reporter does not print it.** `ConfigErrorReporter`
  must still sit between core and the target reporter after the move.
- **`refreshOptions` with a `modifiedFiles` set and with mtimes** re-resolves on a change of an options file and only
  then. This proves the trigger logic works without webpack: it is what Vite's `hotUpdate` will call.

Webpack (`packages/webpack/src`), new tests next to the unchanged ones:

- **The addon-throw divergence holds.** A `WebpackAddonService` whose context application throws calls the `warn`
  loader option with `Addon processing failed: …`. It calls neither `emitError` nor `emitWarning`, and `build`'s
  `diagnostics` stay empty. No test pins this today, so a naive move that lets the throw reach core's error path turns
  webpack builds red without any test noticing.
- **The loader never runs the own profile's result processors.** Over N `build` calls, a result processor of the
  target profile is not called. The plan keeps the dead branch, and a helpful refactor that wires up
  `runResultProcessors` here changes loader output.

Guard: **every existing test passes unedited.** That covers `packages/webpack/src/*.spec.ts`, `loader.test.ts`,
`webpack.test.ts` and every file in `packages/webpack-test/tests`, including `__snapshots__`. A diff that edits an
existing webpack test or snapshot means a behaviour change: stop and report it in the PR. Do not adjust the test.
`git diff --stat develop -- packages/webpack-test packages/webpack/src/*.spec.ts packages/webpack/src/*.test.ts` shows
additions only.

Also:

- `grep -rn '"webpack"' packages/core/src` returns nothing.
- `TsCompiler.ts` imports no `CompilationScanCache` or `ConfigErrorReporter` code of its own; it re-exports them only.
  This shows the move happened and nothing was copied.
- **Tests follow `docs/rules/testing.md`:** assemble / act / assert with no part comments, `testObj` and `actual`,
  `target` for observed objects, no shared `testObj`. `TsCompiler.spec.ts:48-58` and `compiler-instances.spec.ts`
  share instances through `beforeEach`. Do not copy that pattern, and do not refactor those files.
- **Gates, all green:** `pnpm lint`, `pnpm build`, `pnpm test --skip-nx-cache`, `pnpm test:e2e --skip-nx-cache`.
- **No `Release-Notes.md` entry and no README change.** The slice changes no user-visible behaviour, and the plan's
  Changelog lands with `docs/vite-plugin-release`. Say so in the PR. Document `ModuleCompiler` in JSDoc on the class
  and its public methods only.
- **New files carry the MIT license header** (`pnpm license:add`). Do not add them to the `license:check` list.

### Earlier branches

The plan's Motivation names two earlier branches. **Take nothing from either of them on this branch.**

- `origin/feature/60--plugin-for-vite` (`c1400fb5`, 2025-07): `packages/vite-plugin` with a `compiler-adapter.ts`
  whose `build` returns the fixed string `/* Processed by Websmith */`. It imports `WebpackLoaderOptions` from
  `@quatico/websmith-core`, logs with `console` (`/* eslint-disable no-console */`), and has a committed
  `tsconfig.tsbuildinfo`. The plan keeps its file layout and config example. Both belong to the Tracer and Release
  slices, not to this one.
- `origin/vite` (`c3eeaa94`, 2025-02): a stale integration branch of 218 files. Its only Vite content is a
  `packages/vite` skeleton whose `transform` returns `null` (`// TODO: use WebsmithCompiler`). It also matches only
  `.jsx?` and uses `handleHotUpdate`, which the plan replaces with `hotUpdate`.

### Repo mechanics

- **pnpm 10** from `$HOME/.nvm/versions/node/v22.17.0/bin`: put it first on `PATH`. The Homebrew pnpm 11 fails with
  E401.
- **Installs:** `pnpm install --offline`. The Artifactory login in `~/.npmrc` is expired. **Never edit `~/.npmrc`.**
  If a registry package is unavoidable, use an empty file as `NPM_CONFIG_USERCONFIG` plus
  `--config.registry=https://registry.npmjs.org/`. This branch needs no new package.
- **Node 24** is at `$HOME/.nvm/versions/node/v24.21.0/bin/node`, for runtime checks.
- **Commits:** Arlo's notation without a colon (`commit-notation` skill). The move is a refactoring, e.g.
  `r Extracts a bundler-neutral ModuleCompiler into websmith-core`. Use `t` for the new tests. Keep the mechanical move
  and the new contract methods (`runResultProcessors`, the addon step) in separate commits, so a reviewer can check
  the move with `git diff --color-moved`.
- **Deleting files:** use `trash`, never `rm`.

### Bookkeeping

- Push the first real commit as soon as it exists.
- Open the PR with `plot-open-pr.sh`, never `gh pr create`. Its title comes from the wave heading, "Neutral module
  compiler".
- Append `→ #<number>` to the `feature/neutral-module-compiler` line in `docs/plans/2026-10-01-vite-plugin.md`
  `## Slices` and commit that on this branch.

### Scope guard

This branch owns:

- `packages/core/src/compiler/ModuleCompiler.ts` and `ModuleCompiler.spec.ts` (new), and the export lines in
  `packages/core/src/compiler/index.ts`;
- `packages/webpack/src/TsCompiler.ts`, which shrinks to the webpack host, plus new tests in `TsCompiler.spec.ts` or a
  new spec file (existing tests unedited);
- `compiler-instances.ts`, `webpack-hooks.ts` and `loader.ts`, only where an import or a type name must follow the
  move;
- the `→ #<PR>` line in `docs/plans/2026-10-01-vite-plugin.md`.

Do not touch:

- `packages/core/src/compiler/Compiler.ts`. Everything `ModuleCompiler` needs is already `protected`: `resetCompilationCaches`
  `:330`, `recreateCompilationContexts` `:339`, `getContext` `:348`, `createProfileContextsIfNecessary` `:363`,
  `emitSourceFile` `:457`, `getCheckedEsm` `:810` and `checkEsmOutput` `:871`. If you find you must edit it, say why in
  the PR. Two open PRs edit it.
- `WebpackAddonService.ts` and `WebpackAddonContext.ts`, because #172 edits the service (below). The factory adapter
  lives in `TsCompiler.ts`.
- `options.ts`, `loader-options.ts`, `result-handling.ts`, `instance-cache.ts`, `AddonRegistry.ts`,
  `ResolvedCompilerOptions.ts`, `packages/api`;
- `package.json` files, `pnpm-lock.yaml`, tsconfigs, `eslint.config.js`, `Release-Notes.md`, READMEs, every existing
  test and snapshot.

Open PRs and branches starting now, checked with `gh pr diff <n> --name-only`:

- **#170 `bug/emit-skipped-rule`** (`cli-error-exit-gaps`) edits `Compiler.ts` at `:1253`, `:1270-1284` (the
  language-service `emitSkipped`) and `:1413-1440` (the fast path), plus `Compiler.spec.ts`, `bin.test.ts` and
  `Release-Notes.md`. There is no textual collision while you leave `Compiler.ts` alone. **Behavioural:** it changes
  `emitSkipped` in the fragments that `build` returns. If it merges first, rebase and re-run `packages/webpack-test`
  before you read any change there as yours.
- **#171 `infra/typescript-6-ci-leg`** edits `.github/workflows/pull-request.yml`, the TS 6 plan and
  `docs/rules/workflow.md`. There is no file collision. Once it merges, CI also compiles your new core module on
  TS 6.0.3.
- **#172 `bug/depends-closure-core`** (`loader-options-once`) edits `WebpackAddonService.ts` (imports at `:9`, addon
  order at `:504-530`), `AddonRegistry.ts`, `ResolvedCompilerOptions.ts`, `config/profile-closure.ts`, their specs,
  `compile-websmith.test.ts` and `Release-Notes.md`. **Collision if you edit `WebpackAddonService.ts`**, so do not. It
  reimplements `getSelectedProfiles`, which drives `build`'s dependent-profile loop; its plan calls that no behaviour
  change. Rebase if it lands first and re-run the guard.
- **#173 `bug/esm-check-package-subpaths`** (`esm-check-precision`) edits `Compiler.ts:900` (`compilerOptions` passed
  into `checkEsm` inside `checkEsmOutput`), `esm/check-esm.ts`, `esm/import-rules.ts`, `esm/cjs-names.ts`, their
  specs, `bin.test.ts`, `packages/compiler/README.md`, `packages/webpack/README.md` and `Release-Notes.md`. Its new
  rule (91022–91024) is CLI-only: it lands in `IMPORT_RULES` and leaves `NODE_IMPORT_RULES` as it is. There is no
  collision as long as `checkLoaderOutput` keeps calling `checkEsmOutput` and keeps `NODE_IMPORT_RULES` unchanged when
  it moves. #137's notes cite `TsCompiler.ts:46` and `:317` (now `:372`) as the loader's rule set. Name the new core
  location in the PR.
- **`infra/fix-transitive-alerts`** (`dependency-updates`, starting now) changes `pnpm-lock.yaml` and manifests and
  bumps webpack to `^5.104.1`. There is no collision while you add no dependency. **Behavioural:** a new webpack can
  shift `packages/webpack-test` output. If it merges first, rebase and re-run the guard on the new base before you
  attribute a red e2e to the move.

**Later #134 slices on the same code** (no branches yet; each has a `<!-- waits: -->` in
`docs/plans/2026-10-02-loader-options-once.md`):

- `bug/loader-unknown-profile-error` waits on #172. It removes `getFragmentProfile` (`TsCompiler.ts:478-485`) and adds
  core profile validation.
- `bug/loader-option-errors-once` deduplicates file-less diagnostics in `loader.ts` and `afterCompile`. Its follow-on,
  `bug/loader-dependent-profile-diagnostics`, edits the dependent-profile loop of `build` (`:305-323`), which moves
  here.
- `bug/loader-package-type-deps` uses the compilation caches and adds a `needBuild` tap. `bug/loader-cached-config-errors`
  edits `loader.ts`. `bug/loader-tsconfig-enum-options` edits `options.ts` and `ResolvedCompilerOptions.ts` and
  hardly meets this branch.

Order: these slices should be dispatched **after this branch merges**, and they edit the moved code in core, as the
plan says ("slices landing after the extraction edit the moved code in core"). `bug/loader-option-errors-once` and
`bug/loader-tsconfig-enum-options` may start earlier, because they barely touch `TsCompiler.ts`. If one of them lands
first, rebase onto it. The same applies to #136's `bug/report-config-option-errors` and
`bug/report-file-less-diagnostics`: they edit `Compiler.ts`'s `report()` and option errors, not the moved code, and
wait on #134's errors-once slice anyway.

Do not design for Vite beyond the contract above. There is no `packages/vite` and no `ViteAddonContext` on this
branch. If you find something the plan did not anticipate, report it rather than improvising outside scope. Two places
to check:

- whether `ConfigErrorReporter` can stay private to the module, since only `getConfigErrors` needs it;
- whether anything in `packages/webpack-test` depends on the class name `TsCompiler` in a stack trace or a message.
