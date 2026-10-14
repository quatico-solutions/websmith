<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — vite-plugin (slice: diagnostics)

- **Plan (canonical):** `docs/plans/2026-10-01-vite-plugin.md` on `develop`
- **Approved:** 2026-10-02, Jan Wloka, plan-PR #132 merged
- **Branch:** `feature/vite-plugin-diagnostics` (base: `develop`, at `a888e451` when this brief was written)
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh` (on PATH). Do not merge it yourself.
- **Review of the code:** an independent review, plus uncached gates run by the maintainer's session before merge

**Ordering.** This is the plan's third slice. `## Slices` runs one branch per `###` heading, in heading order (plan
Notes: "headings run in order"), and no slice line carries a `<!-- waits: -->`. "Neutral module compiler" merged as
#174 and "Tracer" as #182 (`fa114cbe`). The next heading is "Diagnostics", so this branch is next. After it come
"Addon outputs and context", "Environments", "Dev server", "Dev invalidation" and "Release".

Line numbers below are from `develop` at `a888e451` (#188 merged). If they move, find the code by name.

### What changed on `develop` since the plan was approved

- **#174** added `ModuleCompiler` (`packages/core/src/compiler/ModuleCompiler.ts`). This slice uses:
  - `build` (`:338-411`), which returns `{ fragment, diagnostics, dependencies }`;
  - `getConfigErrors()` (`:215-222`), which returns option-resolution errors, `tsconfig.json` errors and the
    file-less TypeScript errors that builds returned since;
  - `refreshOptions(loadOptions, modifiedFiles?)` (`:268-285`), `refreshAddons()` (`:291-296`) and
    `getOptionsFiles()` (`:258-260`).
- **#182 (Tracer)** created `packages/vite` and `packages/vite-test`. Its error handling is a stopgap, and this slice
  replaces it:
  - `packages/vite/src/plugin.ts:62-66`: `transform` raises every error diagnostic of `build` as one
    `this.error(string)`. The messages are flattened, with no file or position, and warnings are dropped.
  - `plugin.ts:82-87`: `buildEnd` raises `getConfigErrors()` once at the end of a `vite build`.
    `config-errors.ts:13-14` (`selectConfigErrors`) returns nothing in serve mode or after an earlier build error.
  - `plugin.ts:44-55`: `buildStart` creates the compiler once. On later builds (`vite build --watch`) it only calls
    `resetCompilationCaches()`, so the options are never resolved again.
  - `plugin.ts` has no unit test, because Jest cannot load the ESM-only `vite` (Tracer brief, "Runtime import of
    `vite`"). The output pick and the `sourceMappingURL` strip (`:67-75`) are tested only end to end.
- **#181** (`bug/loader-option-errors-once`) and **#187** (`bug/report-config-option-errors`) made file-less
  TypeScript errors, i.e. option errors such as TS5053, configuration errors reported once per compilation. In
  `ModuleCompiler` this is `takeFileLessErrors` (`:510-518`, applied to the target at `:401`). The Tracer e2e
  `should fail w/ option error of tsconfig` (`vite-build.test.ts:93-101`) relies on it. Keep that test green.
- **#188** (`bug/loader-unknown-profile-error`, merged as `a888e451`) made these three cases configuration errors of
  option resolution, in the #131 format, naming the available profiles:
  - an unconfigured profile;
  - a profile without a config file;
  - a missing `depends` target.

  `ModuleCompiler` gained `isProfileConfigured()` (`:192-194`), and `build` returns an empty fragment with no
  diagnostics when it is false (`:362-364`). `checkProfile` and the loader's `getFragmentProfile` are gone. For Vite,
  the three cases now fail cleanly, but in `buildEnd` (reproduced, see the table).
- **#137 (`esm-check-precision`) is Delivered**, so the "after #137" condition on the slice line is met. Under
  `runtime: "bundler"` the Vite host already passes `moduleKind: "esm"` (`plugin.ts:62`), and the bundler rule set
  applies (`ModuleCompiler.ts:498`).
- `packages/vite/**` and `packages/vite-test/**` are unchanged since #182.

### Current behaviour

Reproduced with real `vite build` runs on Vite 7.3.7 and 6.4.4 under Node 22.17.0, on `9dccca77`. The three profile
cases were re-run on `a888e451`.

Each run used a fixture like the Tracer e2e: a `tsconfig.json` with `strict`, and a `websmith.config.json` with
`addonsDir: "./addons"` and profile `app`. The plugin was imported by its default import in a child process.

| Case | Result today | Plan wants |
|------|--------------|------------|
| Syntax error (`export const x = ;`) | fails: `[plugin websmith] src/main.ts: Expression expected.`, with no line or column (also on Vite 6) | fails, with position |
| Type error (`const n: number = "x"`), default `transpileOnly: false` | **passes**, and the bundle contains the code | see "Type errors" below: stays passing (loader parity) |
| Declaration emit error in the target profile (`isolatedDeclarations`, TS9007, fast-path addon) | fails | fails, with position |
| Same error only in a dependent profile (target overrides `declaration`/`isolatedDeclarations` to `false`) | **passes silently**: `dep-out/main.d.ts` is written and nothing is reported | not this slice: `bug/loader-dependent-profile-diagnostics` (see Scope guard) |
| Processor throws | **passes**; the bundle is unprocessed, and `DefaultReporter` prints `[ERROR] Error in processor "thrower"` outside Vite | fails |
| Generator throws | **passes**, and `Error in generator …` is printed | fails |
| `activate` throws | **passes**, and `Error activating addon …` is printed | fails |
| Transformer throws | fails: `Transpilation failed: Error: BOOM_TRANSFORMER` | fails |
| Addon reports a warning through `ctx.getReporter()` | `DefaultReporter` prints it; it does not go through Vite | `this.warn` |
| Unknown addon name in the profile | `Missing addons for profile "app": "nope"` printed **twice**, not through Vite | `this.warn`, once |
| `depends: ["missing"]` | fails in **`buildEnd`** (`hook: 'buildEnd'`), after every module has been compiled | fails in `buildStart`, once |
| `profile: "nope"` (unconfigured) | after #188: fails in **`buildEnd`** with `Profile 'nope' is not configured in '…/websmith.config.json'`, after every module was passed to Vite uncompiled (`build` returns an empty fragment, so the handler returns `null`) | fails in `buildStart`, once |
| Profile but no `websmith.config.json` | after #188: fails in **`buildEnd`** with `No configuration file found at "…"` | fails in `buildStart`, once |
| Profile `tsConfig.module: "commonjs"`, no `esm` | **passes**; Rollup bundles `exports.greeting = …` | configuration error |
| Same with `esm: { runtime: "bundler" }` | fails: `Profile 'app' … sets 'esm', but its 'tsConfig.module' is 'commonjs'` (core's existing check) | fails, once |
| ESM check under `bundler` (`require("./x")` in the output) | fails: `ESM91001 …` | fails, with position |
| Same with `esm.check: "warn"` | passes, and **the warning is dropped** | passes with `this.warn` |
| ESM check in a dependent `node` profile (`import "./b"`) | fails: `ESM91010 …`. Dependent profiles' ESM diagnostics already reach `build`'s result (`ModuleCompiler.ts:376`) | fails, with position |
| `vite build --watch`: the config is broken after the first build and a source file is touched | **the second build passes** (stale options) | the rebuild reports the configuration error |

The addon-throw rows share one root cause. `Compiler.emitSourceFile` reports generator, processor and activation
throws with `this.reporter.reportDiagnostic(new ErrorMessage(…))` (`Compiler.ts:513`, `:533`, `:381`, `:405`) and
continues. `AddonRegistry`'s warnings take the same route (`AddonRegistry.ts:222`). `ModuleCompiler`'s
`ConfigErrorReporter` (`:97-135`) catches them only while option resolution runs. Otherwise it passes them to the
host's reporter, which the Vite host creates as a printing `DefaultReporter` (`plugin.ts:48`). **This slice fixes
that in the Vite host, without touching core** (see 1. below).

A note for fixtures: a profile **inherits the `tsConfig` of the profiles it `depends` on** (`getTsConfig`,
`ResolvedCompilerOptions.ts:377-381`, closure "dependencies-first"). This matters for the dependent `node` ESM case:
the target profile must set its own `outDir`, or it writes into the dependent's.

### What to build

All work is in `packages/vite/src`, plus one export line in core. Every new module imports `vite` with
`import type` only, so Jest can load it.

**1. Diagnostics through Vite instead of printed output.**

- `src/diagnostic-reporter.ts` (new): `class DiagnosticReporter implements Reporter` (from `@quatico/websmith-api`).
  - It buffers every diagnostic passed to `reportDiagnostic`, and `take(): ts.Diagnostic[]` drains the buffer.
  - `reportWatchStatus`, `indent` and `unindent` delegate to a `DefaultReporter(ts.sys)`; nothing in a Vite build
    calls them.
  - Pass it as `options.reporter` and as the `AddonRegistry`'s reporter, replacing `DefaultReporter`
    (`plugin.ts:48-50`). `ModuleCompiler` wraps it in `ConfigErrorReporter` (`:169`), so option-resolution errors still
    go to `getConfigErrors()` and everything else reaches the buffer.

  After this, a processor, generator or activation throw is an `ErrorMessage` in the buffer.
- `src/diagnostics.ts` (new, pure):
  - `formatDiagnostic(d)`: `file (line,col): message`, or just the message when there is no file. Port the four lines
    of the loader's `formatDiagnostic` (`packages/webpack/src/WebpackAddonService.ts:52-59`); do not import the
    loader.
  - `toRollupError(errors)`: one `{ message, loc? }`. `message` holds every error, formatted and joined by newlines.
    `loc` is `{ file, line: line + 1, column }` of the first error that has a file and a `start`. Rollup lines are
    1-based and columns 0-based (`RollupLog.loc` in `rollup.d.ts`). Rollup's `this.error` throws, so all errors go
    into one call.
  - `partitionDiagnostics(diagnostics, debug)`: `{ errors, warnings }`. Warnings are the `Warning` diagnostics, plus
    `Message`/`Suggestion` with `debug` only, as in the loader's rule (`packages/webpack/src/loader.ts:64-79`). It
    drops exact duplicates by `file`/`start`/`code`/message, so the doubled `Missing addons` warning becomes one.
- `src/output.ts` (new, pure): `pickOutput(fragment)` → `{ code, map } | null`. Move the JS/map pick and the
  `sourceMappingURL` strip out of `plugin.ts:16-18` and `:67-75`, unchanged. A fragment without JS still gives
  `null`. That includes the empty fragment `build` returns for an unconfigured profile; the configuration error fails
  the build in `buildStart` before any transform.
- `src/config-errors.ts`: keep `selectConfigErrors` and add `checkTargetModule(profile, tsConfig, hasEsm)`.
  - It returns an `ErrorMessage` when the profile's effective module is not ESM:
    `!isEsmModuleKind(getEmittedModuleKind(tsConfig))`. Both helpers are in
    `packages/core/src/compiler/esm/check-esm.ts` (`:83-84`, `:97-103`). Export them from
    `packages/core/src/compiler/index.ts:12` by adding the two names to that export line, nothing else.
  - It returns nothing when the profile sets `esm`. Core already reports that case (`Compiler.ts:818-840`, message
    "sets 'esm', but …"), and two errors for one cause is noise.
  - Suggested wording: `Profile 'app' emits CommonJS ('tsConfig.module' is 'commonjs'), which Vite cannot bundle as an
    ES module. Use "ESNext" or "ES2022".`
  - The host reads `tsConfig` from `compiler.getOptions().getOptions(compiler.getProfile()).tsConfig` (public,
    `ResolvedCompilerOptions.ts:302`): the merged profile `tsConfig`, with `module` and `target` as enums. The host's
    `targetCompilerOptions` set only `jsx`/`sourceMap`/`inlineSourceMap`, so they do not change the module.
- `src/hooks.ts` (new): `createWebsmithHooks(options, { createFilter, createCompiler })`.
  - It holds everything `plugin.ts` does today and returns `configResolved`, `buildStart`, `transformHandler` and
    `buildEnd`, acting on a `HookContext = Pick<Rollup.PluginContext, "error" | "warn" | "addWatchFile">` (a type
    import).
  - `createCompiler` builds the `ModuleCompiler` with the `DiagnosticReporter`, so a spec can inject a stub.
  - `plugin.ts` shrinks to the Vite wiring: the `createFilter` value import, the `Plugin` object, `name`, `enforce`
    and the `{ filter, handler }` form.

  **This answers the review finding "plugin.ts has no unit test":** all the logic is now in modules Jest can load.

**2. Hook behaviour** (build mode unless stated).

- **`buildStart`**:
  1. Create the compiler on the first build. On a rebuild, call `refreshOptions(() => loaderOptions)` and
     `refreshAddons()` before `resetCompilationCaches()`. `refreshOptions` compares the modification times of the
     options files (`:271-272`), so an unchanged config costs one `stat` per file.
  2. `this.addWatchFile` for each file of `compiler.getOptionsFiles()` (`files` and `missing`), so a
     `vite build --watch` rebuilds when `websmith.config.json` or `tsconfig.json` changes. Only when
     `command === "build"`: dev-server reloads are Dev invalidation's `hotUpdate`.
  3. Collect the `getConfigErrors()` errors (since #188 this includes an unconfigured profile, a missing config file
     and a missing `depends` target), `checkTargetModule(…)`, and the reporter buffer (activation errors and
     `Missing addons` warnings). Send the errors to one `this.error(toRollupError(…))` and each warning to `this.warn`.
     In serve mode, do **not** raise. Keep the Tracer's rule that `selectConfigErrors` returns nothing for `serve`:
     `this.error` in `buildStart` stops the dev server, and reporting config errors in dev belongs to
     `feature/vite-plugin-dev-server`.
  4. Remember the keys of the configuration errors raised here, so `buildEnd` does not raise them again.
- **`transform` handler**: call `build(id, { moduleKind: "esm" })`, then partition `diagnostics` plus `reporter.take()`.
  Send each warning to `this.warn`, as a string or as `{ message, loc }` when it has a position. If there are errors,
  call `this.error(toRollupError(errors))`; otherwise return `pickOutput(fragment)`. Module diagnostics in serve mode
  are reported the same way: the plan wants errors as the overlay in dev, and these belong to a module, not to the
  configuration.
- **`buildEnd`**: same purpose as today. In build mode only, and only without an earlier error
  (`selectConfigErrors`), it raises the file-less errors that `build` collected during this build:
  `getConfigErrors()` minus the keys raised in `buildStart`. This is the TS5053 path of the existing e2e. It also
  drains the reporter buffer as warnings, for anything reported after the last transform.

**3. What this slice leaves to the loader's semantics.**

- **Type errors.** The loader does not report semantic diagnostics. Its README says: "The TypeScript diagnostics are
  those of the module's emit, so these errors fail the build: syntax errors … declaration emit errors"
  (`packages/webpack/README.md:88-94`).
  - The cause is in core: every per-module emit path returns `getSyntacticDiagnostics` only (`Compiler.ts:1205`,
    `:1269`, `:1286`). `getPreEmitDiagnostics` runs only in the CLI's `report` (`Compiler.ts:679`).
  - Vite never type-checks either; its docs tell users to run `tsc --noEmit`.
  - So under the default `transpileOnly: false`, a type error **does not fail `vite build`**, just as it does not
    fail a webpack build. The plan's "a TS error fails `vite build`" is a **syntax error** in this slice's e2e.
- **Addon throws in the loader** stay warnings (plan Open Point "Addon throws", a stated divergence). Do not touch
  `packages/webpack/src/TsCompiler.ts:183-186`.

### Done when

The slice line is the specification: "unit tests for the diagnostic mapping; e2e: a TS error fails `vite build`, a
dependent profile's TS error fails it, a throwing addon fails it (not swallowed), a broken profile reported once, an
ESM finding, a `module: commonjs` profile rejected". Write each red first.

"A dependent profile's TS error fails it" is covered here by the dependent `node` profile's **ESM** error. That works
today, and its position is new. The TypeScript case (declaration emit) waits on
`bug/loader-dependent-profile-diagnostics` (see Scope guard). Add it as `it.todo` naming that branch, so the gap stays
visible.

Two cases already fail on `develop`: the syntax error and the bundler ESM error. Make them red by asserting the
position, which `develop` does not report. Every other case below is red on `develop`, as the table shows.

**E2E**, in a new `packages/vite-test/tests/vite-diagnostics.test.ts`.

Move `writeFile`, `writeTsConfig`, `writeConfig`, `toSource` and the runner from `vite-build.test.ts:104-184` into a
shared `tests/vite-project.ts`, and import them in both files. The runner must now also return failures and warnings.
Change the generated `build.mjs` so that it:

- collects plugin warnings with `build.rollupOptions.onwarn: (w) => warnings.push(w.message)`. Verify on Vite 6 and 7
  that `this.warn` reaches `onwarn`; if not, use a `customLogger` and say so in the PR;
- catches the build error;
- prints one JSON line `{ code, error: { message, loc, hook }, warnings }`.

Each fixture copies the Tracer's (`rootDir: "./src"` stays; TypeScript 6 needs it). Name the tests "should …":

- **Syntax error fails the build with its position.** `src/main.ts` holds `export const x = ;` on line 2. The error
  contains `Expression expected`, and `loc.line` is `2`. Run it on `vite` and `vite6` (`it.each`), as the Tracer did
  for its main case.
- **Dependent profile's ESM error fails the build with its position.** `app` `depends: ["dep"]` and has its own
  `tsConfig.outDir`. `dep` has `esm: { runtime: "node" }` and its own `outDir`. `main.ts` imports `./b`. The error
  contains `ESM91010` and `profile "dep"`, and has a `loc`.
- **Throwing processor fails the build.** An addon whose processor throws `BOOM_PROCESSOR`; the error contains
  `Error in processor` and `BOOM_PROCESSOR`. Add a separate case for a throwing `activate` (`Error activating addon`),
  because it surfaces in `buildStart`, not in `transform`.
- **Broken profile reported once, in `buildStart`.** Use `depends: ["missing"]` with two modules (`main.ts` imports
  `./b`). Check two things: the message contains `Unknown profile 'missing'` exactly once, and `hook` is
  `buildStart`. Add the same check for `profile: "nope"`: `Profile 'nope' is not configured` once, in `buildStart`.
- **ESM finding.** Under `esm: { runtime: "bundler" }`, `declare const require: …; export const x = require("./x");`
  fails with `ESM91001` and a `loc`. With `check: "warn"`, the build passes and `warnings` contains `ESM91001`.
- **CommonJS profile rejected.** `app.tsConfig: { module: "commonjs", moduleResolution: "node10" }` without `esm`:
  the build fails in `buildStart`, and the message names the profile and `commonjs`.
- **Addon warning goes through Vite.** An addon calls `ctx.getReporter().reportDiagnostic` with a `Warning`
  diagnostic `ADDON_WARNING`. The build passes, and `warnings` holds `ADDON_WARNING` once.
- **Watch rebuild reports a broken config.** `build({ build: { watch: {} } })` returns a `RollupWatcher`.
  - After the first `END` event, write the `depends: ["missing"]` config. Expect an `ERROR` event whose message
    contains `Unknown profile`.
  - Wait on watcher events only, never on sleeps (plan Tests), and close the watcher in a `finally`.
  - Today the second build ends with `END` (reproduced). With the `addWatchFile` from `buildStart`, the config edit
    alone should trigger the rebuild. If it does not, touch a source file too and say so in the PR.
- The Tracer e2e (`vite-build.test.ts`) stays green and unedited apart from the helper move. That includes
  `should fail w/ option error of tsconfig`.

**Unit**, in `packages/vite/src/*.spec.ts`, assemble / act / assert, `testObj` / `actual`, one `actual` each:

- `diagnostics.spec.ts`:
  - `formatDiagnostic` with and without a file;
  - `toRollupError` joins every error and takes `loc` from the first one with a position (1-based line, 0-based
    column);
  - `partitionDiagnostics` with errors, warnings, and messages with and without `debug`, and drops duplicate
    warnings.
- `diagnostic-reporter.spec.ts`: `take` returns the buffered diagnostics in order and empties the buffer.
- `output.spec.ts`: picks `.js`/`.jsx`/`.mjs`/`.cjs` with its map; strips `//# sourceMappingURL=`; returns `null` for
  a fragment without JS, including the empty fragment of an unconfigured profile.
- `config-errors.spec.ts`: the existing cases, plus `checkTargetModule` for:
  - `commonjs`, `amd`, `umd` and `system`;
  - unset `module` with `target` ES5 (CommonJS), and unset `module` with ES2022;
  - `ESNext`;
  - a profile with `esm` (no error).
- `hooks.spec.ts` with a stub compiler (`jest.fn()` methods) and a stub context (`error: jest.fn(() => { throw … })`,
  `warn: jest.fn()`, `addWatchFile: jest.fn()`):
  - the handler raises one `this.error` with `loc` for error diagnostics;
  - the handler warns once per warning;
  - the handler returns `null` for a fragment without JS;
  - `buildStart` raises configuration errors in build mode, not in serve mode;
  - `buildStart` calls `refreshOptions` and `refreshAddons` on a rebuild, not on the first build;
  - `buildStart` adds watch files for the options files in build mode only;
  - `buildEnd` does not raise errors `buildStart` raised;
  - reporter-buffered errors (a processor throw) fail the handler.

**Also:**

- **No Release-Notes entry and no README.** `@quatico/websmith-vite` is still private, and this slice changes no
  loader, CLI or core behaviour. The two core helpers become exports, but nothing user-visible changes.
  - The Vite package's README and changelog entry belong to `docs/vite-plugin-release`.
  - Document the Vite diagnostic rules in the JSDoc of `websmith()`, so that slice can lift them: positions,
    `this.warn`, type errors are not checked, CommonJS is rejected, and config errors are raised in `buildStart`.
  - Say all of this in the PR.
- **New files carry the MIT header** (`pnpm license:add`). Do not add them to the `license:check` list.
- **No `console`** anywhere in `packages/vite/src`.
- **Gates, all green:** `pnpm lint`, `pnpm build`, `pnpm test --skip-nx-cache` and
  `pnpm test:e2e --skip-nx-cache`.
  - Use `--skip-nx-cache` for `build` too. The shared `.nx-cache` replays outputs from other worktrees; while writing
    this brief it reported "read the output from the cache … 10 out of 10 tasks".
  - Run the Vite e2e once under Node 24 (`$HOME/.nvm/versions/node/v24.21.0/bin/node`) and say so in the PR.

### Settled decisions — do not re-derive them

- **Next slice is Diagnostics.** Plan `## Slices` order, #182 merged, no `waits:`, #137 delivered.
- **Type errors do not fail `vite build`** under any `transpileOnly`, as with the loader and with Vite itself. The
  plan's "TS error" e2e is a syntax error.
- **Dependent profiles' TypeScript diagnostics are not this slice's.** `bug/loader-dependent-profile-diagnostics`
  owns them (see Scope guard). This slice does not edit the dependent-profile loop in `ModuleCompiler.build`.
- **Addon throws become errors in the Vite host, through its reporter, not in core.** Core keeps reporting them via
  `reportDiagnostic`: the CLI prints them, and the loader keeps them as warnings (plan Open Point "Addon throws").
- **Configuration errors are raised in `buildStart` in build mode**, as the plan says. File-less TypeScript errors
  only exist after a module was emitted, so they stay in `buildEnd`. Each error is raised once.
- **`vite build --watch` re-resolves options in `buildStart`.** Without that, the configuration-error reporting this
  slice adds would report stale results on every rebuild. The dev server's `hotUpdate` path stays with Dev
  invalidation.
- **One `this.error` per hook call**, with every error in the message and the first position as `loc`. Rollup's
  `this.error` throws.
- **One compiler instance per plugin.** Environments keys the instances by environment.

### Repo mechanics

- **Worktree setup:** `export PATH=$HOME/.nvm/versions/node/v22.17.0/bin:$PATH NX_DAEMON=false` and check that
  `pnpm --version` prints `10.34.1`. Then run `pnpm install --frozen-lockfile --offline` and
  `pnpm build --skip-nx-cache`. No dependency is added, so the lockfile stays unchanged.
- **Reproducing by hand:** write a fixture under `packages/vite-test/test-output-<name>` (git-ignored; bare
  `vite`/`vite6`/`@quatico/websmith-vite` imports resolve from there), and remove it afterwards. A leftover
  `package.json` under `packages/**` joins the workspace.
- **Commits:** Arlo's notation without a colon (`commit-notation` skill). A suggested split:
  - `r Moves the Vite plugin's logic into modules Jest can load` (pure moves: `hooks.ts`, `output.ts`, and specs for
    the moved behaviour);
  - `F Reports websmith diagnostics through Vite with positions and warnings`;
  - `F Raises websmith configuration errors in buildStart of vite build`;
  - `F Rejects CommonJS-emitting profiles in the Vite plugin`;
  - `B Re-resolves websmith options on vite build --watch rebuilds`;
  - `t Covers Vite diagnostics end to end`.
- **Deleting files:** use `trash`, never `rm`.

### Bookkeeping

- Push the first real commit as soon as it exists.
- Open the PR with `plot-open-pr.sh`, never `gh pr create`. Its title comes from the wave heading, "Diagnostics".
- Append `→ #<number>` to the `feature/vite-plugin-diagnostics` line in `docs/plans/2026-10-01-vite-plugin.md`
  `## Slices`, and commit that on this branch.

### Scope guard

This branch owns:

- `packages/vite/**` and `packages/vite-test/**`;
- `packages/core/src/compiler/index.ts:12`, only the two added export names (`isEsmModuleKind`,
  `getEmittedModuleKind`);
- the `→ #<PR>` line in the plan.

Do not touch:

- `packages/core/src/compiler/ModuleCompiler.ts`, in particular the dependent-profile loop in `build` (`:366-384`);
- `packages/core/src/compiler/Compiler.ts`, `check-esm.ts`, `ResolvedCompilerOptions.ts` and `AddonRegistry.ts`;
- `packages/webpack/**`, `packages/webpack-test/**` and `packages/api/**`;
- `.github/**`, `Release-Notes.md`, READMEs, the root `package.json` and `pnpm-lock.yaml`.

Concurrent work, checked against `a888e451`:

- **`bug/loader-dependent-profile-diagnostics`** (`docs/plans/2026-10-02-loader-options-once.md:255`) owns
  dependent profiles' TypeScript diagnostics: they "reach webpack, labelled with the profile, identical diagnostics
  across profiles reported once", with a behaviour-change line in `Release-Notes.md`. Its `builds:` note names
  `TsCompiler.build`.
  - What Vite gets depends on where that slice puts the diagnostics. If it adds them to `ModuleCompiler.build`'s
    `diagnostics`, the Vite host reports them with no further work: through `partitionDiagnostics` → `this.error` /
    `this.warn`, like any other build diagnostic.
  - **This slice adds nothing for labelling.** If that slice labels in the message text (as the ESM check does with
    `profile "dep"`), `formatDiagnostic` passes it through. Keep `formatDiagnostic` free of profile logic.
  - The one thing to keep compatible: `partitionDiagnostics` drops duplicates by `file`/`start`/`code`/message, which
    matches "identical diagnostics across profiles reported once" only if the profile label is not in the message.
    That slice decides.
  - If that slice only changes `TsCompiler.build`, Vite gets nothing. Say so in the PR, so the maintainer can extend
    that slice or file a follow-up.
  - Until then, the e2e carries an `it.todo("should fail w/ declaration error in dependent profile — bug/loader-dependent-profile-diagnostics")`.
- **`bug/report-file-less-diagnostics`** (#136 `cli-error-exit-gaps`, running in parallel) edits `Compiler.ts`:
  `report()` (`:674-680`), the per-file declaration Programs, and `watch()`. This slice does not touch `Compiler.ts`.
  Once that branch lands, the target's per-file declaration Programs return `getOptionsDiagnostics()` in
  `fragment.diagnostics`, `takeFileLessErrors` (`:401`) turns them into configuration errors, and this slice's
  `buildEnd` raises them once. If it lands first, rebase and check that the "option error of tsconfig" e2e still
  reports once.
- **`bug/typescript-6-own-compilations`** (#144, running in parallel; `origin/bug/typescript-6-own-compilations`)
  changes `check-esm.ts` near `getEmittedModuleKind` (`:97-103`): the `target` fallback through #135's
  `getEffectiveTarget`. This slice only **exports and calls** the function. If that branch lands first, rebase and
  re-run `config-errors.spec.ts`; the case "unset `module` with ES5 target" may need the new fallback's answer. Do not
  edit `check-esm.ts`.
- **#188 `bug/loader-unknown-profile-error` is merged** (`a888e451`). No overlap remains. Its config errors are
  among the inputs this slice moves from `buildEnd` to `buildStart`.
- **#185/#186 (Dependabot, open)** edit every manifest and the lockfile. If one merges first, rebase and take
  `develop`'s lockfile; never hand-merge it.

Not in this slice. Each item has an owner; mention any you trip over in the PR, but do not build them.

- **Dependent profiles' TypeScript diagnostics.** Owner: `bug/loader-dependent-profile-diagnostics` (see above).
  Reproduced on `9dccca77`: a declaration-emit error only in a dependent profile passes `vite build` silently,
  because `build` pushes only the ESM check's result for dependent profiles (`ModuleCompiler.ts:376`).
- **Type checking (semantic diagnostics) in either host.** No owner in any plan, because it would change
  `ModuleCompiler.build` for the loader. Report it to the maintainer as a possible follow-up issue.
  `docs/vite-plugin-release` must state it in `packages/vite/README.md` ("run `tsc --noEmit` for type errors").
- **Configuration errors in serve mode** (the logger at `buildStart` plus the per-module overlay). Owner:
  `feature/vite-plugin-dev-server`. Keep `selectConfigErrors`' serve rule.
- **Options and addons re-resolved on `hotUpdate`** in the dev server. Owner: `feature/vite-plugin-dev-invalidation`.
- **`addWatchFile` for `build`'s `dependencies`, and `ViteAddonContext`.** Owner:
  `feature/vite-plugin-addon-outputs`. This slice watches only the options files.
- **Instances per environment, the profile map, and the "unnamed environment" error.** Owner:
  `feature/vite-plugin-environments`.
- **Vite 7 on Node 22.12.0 exactly** (the `engines` floor). It is not installed here; `~/.nvm/versions/node/` has
  22.14.0 and 22.17.0. Owner: `docs/vite-plugin-release`, alongside the publish configuration. If
  `nvm install 22.12.0` works on your machine, run the Vite e2e once under it and report the result in the PR.
  Otherwise do not install it.
- **The loader's addon throws as warnings** (plan: a stated divergence) and its "No processed output" error.

If you find something the plan did not anticipate, report it in the PR rather than improvising outside scope. Check:

- whether `this.warn` with a `loc` prints the position on Vite 6 and 7;
- whether a processor that throws in a **dependent** profile's emit is attributed to the module (it shares the
  buffer, so it should be);
- whether `refreshOptions` on a watch rebuild re-reports `Missing addons` warnings once per rebuild, not
  cumulatively.
