<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — vite-plugin (slice: addon outputs and context)

- **Plan (canonical):** `docs/plans/2026-10-01-vite-plugin.md` on `develop`
- **Approved:** 2026-10-02, Jan Wloka, plan-PR #132 merged
- **Branch:** `feature/vite-plugin-addon-outputs` (base: `develop`, at `6f6a581a` when this brief was written)
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh` (on PATH). Do not merge it yourself.
- **Review of the code:** an independent review, plus uncached gates run by the maintainer's session before merge

**Ordering.** This is the plan's fourth slice. `## Slices` runs one branch per `###` heading, in heading order (plan
Notes: "headings run in order"), and no slice line carries a `<!-- waits: -->`. "Neutral module compiler" merged as
#174, "Tracer" as #182 and "Diagnostics" as #193 (`80a247bb`). The next heading is "Addon outputs and context", so
this branch is next. After it come "Environments", "Dev server", "Dev invalidation" and "Release".

Line numbers below are from `develop` at `6f6a581a` (#194 merged). If they move, find the code by name.

### What changed on `develop` since the plan was approved

- **#174 (`ModuleCompiler`) did not deliver the plan's "host-supplied `AddonContext` factory".** This is the one place
  where `develop` contradicts the plan. The resolution is item 1 of "What to build".
  - `ModuleCompilerHost` (`packages/core/src/compiler/ModuleCompiler.ts:39-47`) has `addons`, `dependencyCallback`,
    `debug` and `targetCompilerOptions`, and no context factory.
  - The constructor creates the compilation contexts at `:192`, through `Compiler.createProfileContextsIfNecessary`
    (`Compiler.ts:372-419`). That method activates every addon on a core `CompilationContext`
    (`new CompilationContext` at `Compiler.ts:458`, `ctx.activateAddon(addon)` at `:410`).
  - The webpack loader gets its `WebpackAddonContext` in a different way: `TsCompiler` overrides
    `prepareAddons`/`applyAddons` (`packages/webpack/src/TsCompiler.ts:87-96`), and only for its target profile.
    Leave that path alone.
  - `ModuleCompiler.runResultProcessors(files)` (`:454-465`) exists, and nothing calls it: `git grep` finds no caller
    in `packages/webpack` or `packages/vite`. It calls each processor without `runAsAddon`, so an addon that calls a
    context method from a result processor cannot be named.
  - The dependent-profile loop in `build` (`:386-411`) writes each dependent profile's files
    (`emitSourceFile(…, true)`). It also runs **that profile's** result processors per module, with the source path:
    `cur([filePath], ctx)` at `:405-409`, under a `TODO`.
- **#182 (Tracer) and #193 (Diagnostics)** shaped `packages/vite/src`. Nothing in `packages/vite`, `packages/vite-test`,
  `packages/api` or `packages/core/src/compiler/compilation` has changed since `80a247bb`.
  - `hooks.ts` holds the logic, and `plugin.ts:30-40` wires it into Vite. There is no `generateBundle` hook.
  - `HookContext` (`hooks.ts:19`) is `Pick<Rollup.PluginContext, "error" | "warn" | "addWatchFile">`.
  - `configResolved` receives only `root` and `command` (`:37`, `:99-103`).
  - `transformHandler` (`:131-141`) discards `build`'s `dependencies` (`:135`).
  - `createModuleCompiler` (`:53-57`) passes `ts.sys` and a `DiagnosticReporter`. The reporter buffers whatever the
    compiler and the addons report (`diagnostic-reporter.ts`), and `transformHandler`, `buildStart` and `buildEnd`
    drain it. **An `ErrorMessage` that an addon context reports therefore fails the hook that is running.** This
    slice relies on that.
  - `toRollupWarning` (`diagnostics.ts:56-59`) puts `formatDiagnostic(warning)`, which includes the position, into
    the message, and sets `loc` as well. #193 fixed the same problem for errors (`toRollupError`, `:45-53`,
    commit `004bcefb`) but not for warnings.
- **#191** (`bug/loader-dependent-profile-diagnostics`) is merged. Dependent profiles' TypeScript diagnostics are now
  part of `build`'s `diagnostics`, labelled `(profile "<name>")` (`ModuleCompiler.ts:396-401`, `:430-438`), so the
  Vite host reports them without work of its own. **#192** (`bug/report-file-less-diagnostics`) only changed
  `takeFileLessErrors` (`:550-567`); nothing in it affects this slice.
- **`packages/vite/README.md` does not exist yet.** `@quatico/websmith-vite` is still `"private": true`
  (`packages/vite/package.json:7`). `Release-Notes.md` `## [Unreleased]` → `### Added` holds only the placeholder
  `- TBA`.

### Current behaviour

These cases were reproduced with real `vite build` runs on Vite 7.3.7 and 6.4.4 under Node 22.17.0, on `6f6a581a`.

The fixture follows the Tracer e2e:

- `tsconfig.json` sets `ES2022`/`ESNext`/`bundler`, `rootDir: ./src` and `outDir: ./tsc-out`.
- `websmith.config.json` sets `addonsDir: ./addons` and the profile `app` with the `replacer` addon plus a probe addon.
- `src/main.ts` imports `./b`.
- A second plugin, `probe`, records `this.getWatchFiles()` in `generateBundle`.
- The probe addon logs each call to a file. Its generator runs on `main.ts`.

| Case | Result today | Plan wants |
|------|--------------|------------|
| What `activate(ctx)` receives | `ctx.constructor.name` is `CompilationContext`, the core class | a `ViteAddonContext` |
| Generator calls `ctx.addVirtualFile("virtual.json", …)` | **build fails** (Vite 6 and 7): `Only code files are supported for addInputFile. .json of virtual.json is no valid code file extension.`, which also names the wrong method | `virtual.json` is an asset in the bundle |
| `ctx.addVirtualFile(<project>/src/virtual.ts, …)` | returns; nothing in the bundle, nothing reported | error diagnostic: the path is outside Vite's `build.outDir` (see 3.) |
| `ctx.addAssetDependency(<project>/templates/t.html, main.ts)` | returns; `t.html` is not among the watch files. Editing `t.html` under `vite build --watch` triggers **no rebuild** (8 s timeout) | `this.addWatchFile`; the edit rebuilds |
| `ctx.addInputFile(<project>/src/extra.ts)` | returns; not watched | `this.addWatchFile` |
| `ctx.removeOutputFile("main.js")` | returns; the bundle is unchanged and nothing is reported | deleted from the bundle in `generateBundle`, or a diagnostic |
| Generator writes `gen/generated.txt` through `ctx.getSystem().writeFile` | on disk, not in the bundle | the same: disk only |
| `app`'s result processor | **never runs** (Vite 6 and 7) | runs once, in `buildEnd`, with the build's output files |
| `app` `depends: ["dep"]`, each with its own `outDir` | `dep-out/{main,b}.js` are written once per module. `dep`'s addon is activated in `dep`'s context **and** in `app`'s, because a profile inherits its dependencies' addons, so its generator runs twice per module. `dep`'s result processor runs once per module, with the source path (`["main.ts"]`, then `["b.ts"]`) | each file written once per file version; the per-module run of the dependent's result processor is core behaviour (see Scope guard) |
| The same under `vite build --watch`, after an edit of `b.ts` | only `b.ts` is transformed again (Rollup's cache), so `dep` emits `b` again and not `main` | the same |
| `build`'s `dependencies` (the ESM check's package.json lookups) | not passed to `addWatchFile` | `addWatchFile` (plan lifecycle table, `transform` row) |
| ESM warning (`esm: { runtime: "bundler", check: "warn" }`, `require` in the output) | `[plugin websmith] src/main.ts (1:17): /…/tsc-out/main.js (1,18): ESM91001: …`, i.e. **two positions** (Vite 6 and 7) | the position once, as for errors |
| The target profile's own output | `tsc-out/main.js` and `tsc-out/main.js.map` are written to disk during `vite build` | unchanged in this slice; see "Not in this slice" |

All the context rows share one root cause. Addons activate on the core `CompilationContext`, whose four methods follow
the CLI's semantics:

- `addVirtualFile` and `addInputFile` add **code** files to the context's root files (`CompilationContext.ts:159-178`,
  `:214-228`). A per-module host never emits those root files.
- `addAssetDependency` records the dependency in memory (`:196-212`), because the Vite host passes no
  `dependencyCallback`.
- `removeOutputFile` drops a root file (`:230-235`).

None of these reaches Rollup.

### What to build

All work is in `packages/vite`, plus two small seams in core (item 1), the `AddonContext` docs and the docs listed in
5. Every new module in `packages/vite/src` imports `vite` with `import type` only, so Jest can load it.

**1. Core seam: a context factory for the host's profile.** This is the plan's factory, which #174 left out.

- In `ModuleCompilerHost`, add
  `createContext?: (options: CompilationContextOptions) => CompilationContext`. Its doc comment: "Creates the
  compilation context of the host's profile, e.g. one whose `AddonContext` methods map to the bundler. Dependent
  profiles keep the core context."
- In `Compiler.createCompilationContext` (`Compiler.ts:426-470`), move the `new CompilationContext({...})` at `:458`
  into `protected instantiateCompilationContext(options: CompilationContextOptions, profile?: string):
  CompilationContext`, which returns `new CompilationContext(options)`. That is a pure extraction.
- `ModuleCompiler` stores the factory in its constructor **before** `createProfileContextsIfNecessary` (`:192`). It
  overrides `instantiateCompilationContext` to call the factory when `profile === this.profile` and a factory is set,
  and `super` otherwise. This is the same rule as `getContextCompilerOptions` (`:197-199`); no profile means the
  default context.
- **Why not a `ViteModuleCompiler` subclass that overrides `createCompilationContext`:** `ModuleCompiler`'s
  constructor creates the contexts, and a subclass's own fields are not yet set at that point. Do not try it.
- In `runResultProcessors` (`:454-465`), call each processor through `ctx.runAsAddon(name, …)` when
  `ctx.findAddonName(cur)` returns a name. That lets a context method called from a result processor name its addon.
  Nothing calls this method today, so no host changes behaviour.
- Specs in `ModuleCompiler.spec.ts`:
  - the factory creates the target profile's context;
  - a dependent profile gets a core `CompilationContext`;
  - without a factory, the context is a core `CompilationContext`;
  - a result processor runs as its addon.

  `TsCompiler` passes no factory, so `packages/webpack` is unchanged and its tests are the guard.

**2. `src/vite-addon-context.ts` (new): `class ViteAddonContext extends CompilationContext`.**

The constructor takes `(options: CompilationContextOptions, outputs: AddonOutputs)`. Generators, processors,
transformers, result processors, `getReporter`, `getSystem` and the rest are inherited unchanged, as the plan's table
says. The four methods behave as follows:

| Method | Vite build |
|--------|------------|
| `addInputFile(path)` | `super.addInputFile(path)`, which keeps the code-extension error and the root file a type-info addon may need. For a code file, also `outputs.addWatchFile(this.resolvePath(path))` |
| `addAssetDependency(child, parent)` | for a code-file `child`, call `super` (it reports the error) and return. Otherwise call `super`, then `outputs.addWatchFile(this.resolvePath(child))` |
| `addVirtualFile(path, content)` | `outputs.addVirtualFile(path, content, addon)`. Do **not** call `super`: in Vite this method means "into the bundle", as `emitAsset` does in webpack, for any extension. Like `WebpackAddonContext`, it does not mark files for `addonEmitOnly` |
| `removeOutputFile(path)` | `outputs.removeOutputFile(path, addon)`; no `super` |

- `addon` is the addon that is running. Override `runAsAddon` to remember the name for the duration of `fn`
  (`CompilationContext.ts:313-321`; `currentAddonName` there is private), and fall back to `"unknown addon"`.
  Generators and activation already run as their addon (`Compiler.ts:515`, `CompilationContext.ts:306`). Result
  processors do after item 1. Processors do not.
- Do not edit `CompilationContext.ts`. The open PR #196 changes `addInputFile` there (see Scope guard).

**3. `src/addon-outputs.ts` (new): `class AddonOutputs`, the bridge between the contexts and Rollup.** It holds no
Vite value import.

- **The running hook.** `run(context, moduleId | undefined, fn)` sets the current `HookContext` (and the module being
  transformed) for the duration of `fn`.
  - The hooks wrap compiler creation and refresh in `buildStart`, `compiler.build` in `transformHandler`, and
    `runResultProcessors` in `buildEnd`.
  - `addWatchFile(path)` forwards to the current context.
  - A call with no running hook, e.g. from a timer, reports an `ErrorMessage` naming the method and the addon:
    "called outside a Vite build hook".
  - In Rollup 4.64.6, the version Vite 7.3.7 and 6.4.4 bundle here, `addWatchFile` works in every hook. Inside
    `transform` it also records the file as a transform dependency, so in watch mode an edit to it re-transforms the
    module.
- **Virtual files and removals, per module.** Rollup's watch cache skips modules that did not change (reproduced
  above), so entries are kept per module id, not per build.
  - `startModule(id)` clears that module's entries before it is built again.
  - Entries made outside a transform (activation, result processors) belong to the build and are cleared in
    `buildStart`.
  - `generateBundle` applies the entries of the modules in `this.getModuleIds()` plus the build's entries. This is
    the plan's lifecycle: "`generateBundle` | `addVirtualFile` → `emitFile`, `removeOutputFile` → delete from
    bundle".
- **Bundle file names.** `toBundleFileName(path)` maps a path as follows:
  - a relative path is relative to Vite's `build.outDir`, i.e. it is the bundle `fileName` as written, with `\`
    normalised to `/`;
  - an absolute path inside `build.outDir` (resolved against `root`) becomes relative to it;
  - anything else is an error diagnostic, `addVirtualFile of addon "<name>" cannot place '<path>' in the bundle: it
    is outside build.outDir '<dir>'`. "Anything else" includes an absolute path outside `outDir` and a relative path
    that leaves it (`../`). Rollup itself rejects absolute or escaping `fileName`s.

  This deliberately differs from `WebpackAddonContext`. That class resolves relative paths against the process's
  working directory and strips the leading `/` from foreign absolute paths (`WebpackAddonContext.ts:156-176`). Do
  not port that.
- **`generateBundle(bundle)`:**
  - For each virtual file, call `this.emitFile({ type: "asset", fileName, source })`. Emit within one call; a file
    added twice keeps the last content.
  - For each removal, `delete bundle[fileName]`. A removal of a file the bundle does not hold is a `WarnMessage`
    naming the addon and the path; the loader ignores that case silently.
  - Apply the removals after the emits, so an addon can remove a virtual file. A removal also drops a pending virtual
    file with that name.
- **Serve mode.** Keep virtual files in memory and drop removed ones. Do not emit and do not report: serving them is
  `feature/vite-plugin-dev-server` (plan table: "dev: kept in memory, served by a dev-server middleware").

**4. Hooks** (`hooks.ts`, `plugin.ts`):

- `HookContext` adds `"emitFile" | "getModuleIds"`. `configResolved` takes `Pick<ResolvedConfig, "root" | "command" |
  "build">` and resolves `build.outDir` against `root`.
- `createModuleCompiler(loaderOptions, reporter, outputs)` passes
  `createContext: options => new ViteAddonContext(options, outputs)` and the deduplicating system from item 6.
  `HookDependencies.createCompiler` gets `outputs` as well.
- **`transformHandler`:**
  1. `outputs.startModule(id)`, then `build` inside `outputs.run(this, id, …)`.
  2. `this.addWatchFile` for each of `dependencies.files` and `dependencies.missing`.
  3. Record `fragment.files.map(cur => cur.name)` for `id`. This is the CLI's list of output files, maps and
     declarations included (`Compiler.ts:752-760`).
  4. The diagnostics handling stays as #193 left it.
- **`buildEnd(error)`**, in build mode only and only without `error`:
  - Keep the existing config-error raise first.
  - Then call `compiler.runResultProcessors(files)` inside `outputs.run(this, undefined, …)`. `files` are the
    recorded outputs of the ids in `this.getModuleIds()`, so a watch rebuild that transformed only `b.ts` still passes
    `main`'s outputs.
  - Raise its returned errors together with `reporter.take()` through one `this.error(toRollupError(…))`.
  - A failed build runs no result processors: the bundle they would describe does not exist.
- **`generateBundle(_options, bundle)`** (new; add it to the `Plugin` object in `plugin.ts`): in build mode, apply
  `outputs`, then drain `reporter.take()` through `report` and raise its errors.
- Update the JSDoc of `websmith()` (`plugin.ts:13-29`) with the addon-context rules. Release lifts them into the
  README.

**5. Docs.** All three are required by the Definition of Done, and the plan puts the API note in both places
(plan, "Addon context under Vite").

- **`packages/api/src/addons/AddonContext.ts`:** extend the doc comments of `addInputFile`, `addAssetDependency`,
  `addVirtualFile` and `removeOutputFile` with what each does in the CLI, the webpack loader and the Vite plugin. Use
  the plan's table and the rules from 2. and 3. Extend the interface comment (`:13-22`) as well: the Vite plugin
  activates addons once per build, like the loader per compilation.
- **`packages/vite/README.md` (new, MIT header):** a short intro and an "Addon context" section with the mapping table
  and the `build.outDir` rule. `docs/vite-plugin-release` completes it with options, environments and the rest; say so
  in one line at the end of the file.
- **`Release-Notes.md`:** under `## [Unreleased]` → `### Added`, replace `- TBA` with one bullet. It says that the
  `AddonContext` docs now describe `addInputFile`, `addAssetDependency`, `addVirtualFile` and `removeOutputFile` per
  host, the Vite plugin included. Release writes the package's own entry; keep yours to that one bullet.

**6. Writes deduplicated per file version** (slice line; plan, "Dependent-profile writes are deduplicated per file
version and profile").

- `src/write-record.ts` (new): `createDeduplicatingSystem(system)` returns
  `Object.create(system, { writeFile: … })`, the pattern of `CompilationContext.observeWrites`
  (`CompilationContext.ts:112-128`).
  - It skips a write when this plugin instance's last write to the same resolved path had identical text and the
    file still exists. The existence check matters because Vite may empty `outDir` in between.
  - Otherwise it writes and records the text, or a hash of it.
  - Because output paths differ per profile, this deduplicates per profile and file version: the same source version
    gives the same text.
- Pass it as the `ModuleCompiler`'s system. The contexts use the compiler's system (`Compiler.ts:461`), so writes by
  generators and result processors through `ctx.getSystem()` are deduplicated too.
- In a single `vite build`, each dependent output is already written once (reproduced). The record pays off when the
  same plugin instance builds again: a second `build()` with the same plugin object, the environments of the next
  slice, the dev server. **Dev invalidation** adds the change-cycle reset and ignores these writes in `hotUpdate`; it
  reuses this record and does not build a second one.

**7. `toRollupWarning` positions once** (#193 review follow-up). With a `loc`, the message is
`ts.flattenDiagnosticMessageText(…)` without the position, as `toRollupError` already does. Without one, keep
`formatDiagnostic`. This slice adds warnings (removals of absent files), and they would otherwise print two positions.

### Done when

The slice line is the specification. It asks for:

- "`ViteAddonContext` with the mapping table (`addInputFile`, `addAssetDependency` → `addWatchFile`; `addVirtualFile`
  → `emitFile`; `removeOutputFile` → bundle deletion; unsupported calls as error diagnostics)";
- "result processors once per environment in `buildEnd`";
- "dependent profiles via `depends` with writes deduplicated per file version";
- "generated files on disk only";
- "API note in `packages/api`";
- "unit tests for each mapped method";
- "e2e: a generator, a result processor run once, a dependent profile, an `addVirtualFile` asset in the bundle".

Write each red first. Cases marked **guard** already pass on `develop` (reproduced); keep them as guards and say so in
the PR.

**E2E**, in a new `packages/vite-test/tests/vite-addon-outputs.test.ts`. Extend `runVite` in `tests/vite-project.ts`,
and keep the existing callers working:

- return the bundle's assets as `{ fileName, source }` (`write: false` already returns them);
- optionally add a probe plugin whose `generateBundle` returns `this.getWatchFiles()`, made relative to the project.

Name the tests "should …". Run the main cases on `vite` and `vite6` (`it.each`), as the Tracer did.

- **Generator output on disk only** (guard). A generator writes `gen/<module>.txt` through `ctx.getSystem().writeFile`.
  The file exists on disk, and no bundle chunk or asset contains its text.
- **Generator's watch files** (red). A generator calls `ctx.addAssetDependency(ctx.resolvePath("templates/t.html"),
  file)` and `ctx.addInputFile(ctx.resolvePath("src/extra.ts"))`. The probe's watch files contain both.
- **Asset dependency rebuilds under watch** (red; today the run times out). With `runViteWatch`, write
  `templates/t.html` after the first `END`, and expect a second build that ends in `BUNDLE_END`.
- **Result processor run once** (red). `app` registers a result processor that appends its `files` to a log. Two
  modules (`main.ts` imports `./b`). Expect exactly one call, whose files include the outputs of both modules (`main.js`
  and `b.js` by basename).
- **Dependent profile** (guard). `app` `depends: ["dep"]`, and each has its own `tsConfig.outDir`. `dep-out/main.js` and
  `dep-out/b.js` exist after the build, and the bundle holds `app`'s output, not `dep`'s.
- **Dependent writes deduplicated** (red). Run two builds in one process with the **same** plugin object (a small
  runner variant). Between them, set `dep-out/main.js`'s mtime into the past with `fs.utimesSync`. After the second
  build, the mtime is unchanged. On `develop` the second build rewrites the file.
- **`addVirtualFile` asset in the bundle** (red). A generator adds `virtual.json`. The bundle's assets contain
  `virtual.json` with that content. Add the absolute-path variant (`<outDir>/nested/v.txt` → `nested/v.txt`) as a
  second case.
- **`removeOutputFile` deletes from the bundle** (red). Remove an asset that Vite emits itself, e.g. the CSS of an
  imported `.css` file. Take its file name from a run without the addon, and check it on Vite 6 and 7, since lib mode
  names the CSS differently. If that proves brittle, use two virtual files and remove one, and say so in the PR.
- **Unsupported calls fail the build** (red):
  - `addVirtualFile` with a path outside `build.outDir` fails, and the message contains `addVirtualFile`, the addon's
    name and `outside build.outDir`;
  - `removeOutputFile` of an absent file passes, with one warning naming the addon.
- In `vite-diagnostics.test.ts`, add **"should warn w/ position once"** (red): the ESM `check: "warn"` warning
  does not contain the diagnostic's own `(1,18)`-style position, only Rollup's `(1:17)` prefix from `loc`.

**Unit**, in `packages/vite/src/*.spec.ts` and core, assemble / act / assert, `testObj` / `actual`, one `actual`
each:

- `vite-addon-context.spec.ts`, one `describe` per mapped method:
  - `addInputFile` adds a watch file, and reports the core error for a non-code file;
  - `addAssetDependency` watches the child, and reports an error for a code-file child;
  - `addVirtualFile` and `removeOutputFile` reach `AddonOutputs` with the running addon's name;
  - `runAsAddon` restores the previous name.

  Use a stub `AddonOutputs` (`jest.fn()` methods) and `CompilationContextOptions` over the in-memory system that
  `CompilationContext.spec.ts` uses (`createSystem` from `packages/core/src/environment`).
- `addon-outputs.spec.ts`:
  - the bundle file name for a relative path, an absolute path in `outDir`, an absolute path outside it and a `../`
    path;
  - `addWatchFile` without a running hook reports an error;
  - `startModule` drops only that module's entries;
  - `generateBundle` emits assets, deletes removals after emits, warns for absent removals, and uses only the ids it
    is given;
  - serve mode emits nothing.
- `write-record.spec.ts`: an identical second write is skipped, a changed text is written, and a deleted file is
  written again.
- `diagnostics.spec.ts`: `toRollupWarning` with a `loc` has a message without the position; without one it is
  unchanged.
- `hooks.spec.ts`: extend the stub context with `emitFile` and `getModuleIds`, and the stub compiler with
  `runResultProcessors`. Then:
  - `transformHandler` adds the `dependencies` as watch files;
  - `buildEnd` runs the result processors once with the outputs of the module ids, not in serve mode and not after an
    error;
  - `buildEnd` raises a result processor's error;
  - `generateBundle` raises an error an addon context reported.
- `ModuleCompiler.spec.ts`: the four cases in 1.

**Also:**

- **New files carry the MIT header** (`pnpm license:add`). Do not add them to the `license:check` list.
- **No `console`** anywhere in `packages/vite/src`. Everything goes through the reporter or `this.warn`/`this.error`.
- **No `@quatico/websmith-core` import in addon code**: the e2e addons are plain CommonJS `addon.js` files that use
  only the `ctx` they are given. `packages/vite` itself is a host and imports core, as it does today.
- **Gates, all green:** `pnpm lint`, `pnpm build --skip-nx-cache`, `pnpm test --skip-nx-cache` and
  `pnpm test:e2e --skip-nx-cache`. The shared `.nx-cache` replays outputs from other worktrees, so skip it.
  - Run the Vite e2e once under Node 24 (`$HOME/.nvm/versions/node/v24.21.0/bin/node`) and say so in the PR.

### Settled decisions — do not re-derive them

- **Next slice is "Addon outputs and context".** Plan `## Slices` order, #193 merged, no `waits:`.
- **The factory is a core host option, used for the host's profile only.** That realises the plan's
  "host-supplied `AddonContext` factory", which #174 left out. A subclass override cannot work (see 1.).
- **Dependent profiles keep the core `CompilationContext`.** This is loader parity: the loader wraps only its target
  profile's context. Their files go to their `outDir`; nothing of theirs enters the bundle.
- **`ViteAddonContext` extends `CompilationContext`.** Generators, processors, transformers and result processors keep
  running through core's `emitSourceFile`, exactly as in the CLI and the loader.
- **`addVirtualFile` means "into the bundle", for any extension; paths are relative to `build.outDir`.** A path outside
  it is an error diagnostic, never a silent drop and never webpack's leading-slash stripping.
- **Virtual files and removals are applied in `generateBundle`**, per module id, so a watch rebuild that serves a
  module from Rollup's cache still emits that module's virtual files.
- **Result processors of the host's profile run once per build, in `buildEnd`, in build mode, only for a successful
  build,** with the CLI's file list (every output file of every module in the graph). "Once per environment" means
  once per plugin instance until Environments keys instances by environment.
- **The per-module run of dependent profiles' result processors** (`ModuleCompiler.ts:405-409`) stays. It is shared
  with the loader (see "Not in this slice").
- **Write deduplication is a plugin-level record in a wrapped `ts.System`.** Dev invalidation extends it and does not
  replace it.
- **`toRollupWarning` gets the same fix as `toRollupError`.** It is small, in code this slice touches, and this slice
  adds warnings.

### Repo mechanics

- **Worktree setup.** pnpm 10.34.1 refuses frozen installs in this repo, so use the corepack-cached 10.8.0 through a
  shim:

  ```sh
  mkdir -p /tmp/pnpm-shim && printf '#!/bin/sh\nexec corepack pnpm@10.8.0 "$@"\n' > /tmp/pnpm-shim/pnpm && chmod +x /tmp/pnpm-shim/pnpm
  export PATH=/tmp/pnpm-shim:$HOME/.nvm/versions/node/v22.17.0/bin:$PATH COREPACK_ENABLE_NETWORK=0 COREPACK_ENABLE_STRICT=0 NX_DAEMON=false
  pnpm install --frozen-lockfile --offline && pnpm build --skip-nx-cache
  ```

  No dependency is added. Never edit `pnpm-lock.yaml`, `~/.npmrc` or the root `package.json`.
- **Reproducing by hand:** write a fixture under `packages/vite-test/test-output-<name>` (git-ignored; bare `vite`,
  `vite6` and `@quatico/websmith-vite` imports resolve from there), and remove it afterwards with `trash`.
  - Never leave a `package.json` in a fixture. A leftover one under `packages/**` joins the workspace, and the next
    `pnpm install` adds it to `pnpm-lock.yaml`. If that happens, `git checkout -- pnpm-lock.yaml`; never commit it.
- **Commits:** Arlo's notation without a colon (`commit-notation` skill). A suggested split:
  - `F Lets a module compiler host create the context of its profile` (core seam and `runAsAddon` for result
    processors, with specs);
  - `F Maps addon context outputs to Vite builds` (`ViteAddonContext`, `AddonOutputs`, hooks);
  - `F Runs result processors once per Vite build`;
  - `F Skips identical rewrites of websmith outputs in the Vite plugin`;
  - `B Prints a Vite warning's position once`;
  - `d Documents the addon context per host`;
  - `t Covers addon outputs in Vite builds end to end`.
- **Deleting files:** use `trash`, never `rm`.

### Bookkeeping

- Push the first real commit as soon as it exists.
- Open the PR with `plot-open-pr.sh`, never `gh pr create`. Its title comes from the wave heading, "Addon outputs and
  context".
- Append `→ #<number>` to the `feature/vite-plugin-addon-outputs` line in `docs/plans/2026-10-01-vite-plugin.md`
  `## Slices`, and commit that on this branch. Change nothing else in the plan.

### Scope guard

This branch owns:

- `packages/vite/**` and `packages/vite-test/**`;
- in `packages/core/src/compiler/ModuleCompiler.ts`, the `createContext` host option, the
  `instantiateCompilationContext` override and `runResultProcessors`;
- in `packages/core/src/compiler/Compiler.ts`, only the extraction of `instantiateCompilationContext` from
  `createCompilationContext`;
- the specs for those changes, and the core `index.ts` exports if a new type needs one;
- the doc comments in `packages/api/src/addons/AddonContext.ts`, with no signature change;
- one bullet in `Release-Notes.md` `### Added`, and the `→ #<PR>` line in the plan.

Do not touch:

- `packages/core/src/compiler/compilation/CompilationContext.ts` (subclass it instead);
- the dependent-profile loop in `ModuleCompiler.build` (`:386-411`) and `Compiler.emitSourceFile`;
- `packages/webpack/**`, `packages/webpack-test/**`, `packages/compiler/**`;
- `.github/**`, the root `README.md`, the root `package.json` and `pnpm-lock.yaml`.

Concurrent work, checked against `6f6a581a`:

- **#196 `bug/watch-generator-added-files`** (open) edits `CompilationContext.ts`: `addInputFile` reports
  `Adding … to watch.` and calls the watch callback only in watch mode. It also edits `Compiler.ts` `watch()` and
  `registerWatch`.
  - `ViteAddonContext.addInputFile` calls `super`, so after #196 it reports nothing for a Vite build. Before #196 it
    reports an `InfoMessage`, which `partitionDiagnostics` drops without `debug`. Either way, nothing changes for
    Vite.
  - If #196 lands first, rebase. The two branches touch different regions of `Compiler.ts`: yours is at `:426-470`,
    theirs is in `watch()`.
- **#185/#186/#195 (Dependabot, open)** edit manifests and the lockfile. If one merges first, rebase and take
  `develop`'s lockfile; never hand-merge it.

Not in this slice. Each item has an owner; mention any you trip over in the PR, but do not build them. The five
review follow-ups from #182 and #193 were each verified on `6f6a581a`:

- **Type errors do not fail `vite build` under `transpileOnly: false`** (#182/#193 follow-up). This is by design,
  loader parity: per-module emits return syntactic diagnostics only.
  - Reproduced: `export const n: number = "MARK_IN"` with `strict` builds and bundles.
  - The plugin's JSDoc already says so (`plugin.ts:22`).
  - Owner: `docs/vite-plugin-release`, whose README must say "run `tsc --noEmit` for type errors". Nothing to build.
- **Configuration errors in serve mode** (#182/#193 follow-up). `buildStart` returns before raising when
  `command !== "build"` (`hooks.ts:120-122`), and the JSDoc says "its configuration errors are not reported yet"
  (`plugin.ts:28`). Owner: `feature/vite-plugin-dev-server` (the logger at `buildStart` plus the per-module overlay).
- **A `module: nodenext`/`node16` profile in a package without `"type": "module"` bundles CommonJS** (#193 follow-up).
  - Reproduced: the fixture under `packages/vite-test` (its nearest `package.json` has no `type`) with
    `module`/`moduleResolution: "NodeNext"` builds without a diagnostic, and the bundle holds
    `Object.defineProperty(exports, "__esModule", …)` and `require("./b.js")`.
  - Cause: `checkTargetModule` (`config-errors.ts:23-36`) treats every `module` value outside
    `NON_ESM_MODULE_KINDS` as ESM (`packages/core/src/compiler/esm/check-esm.ts:84-85`). The format of `nodenext`/`node16` depends on each file's
    extension and nearest `package.json`.
  - Owner: `feature/vite-plugin-environments`. That slice reworks the configuration checks per environment instance,
    and the check must become per module, from the emitted output or `ts.getImpliedNodeFormatForFile`, not per
    profile.
- **`toRollupWarning` doubles the position** (#193 follow-up). **In this slice** (item 7). Reproduced on Vite 6 and 7.
- **Vite 7 on exactly Node 22.12.0 is untested** (#182 follow-up), even though `packages/vite/package.json:9` sets
  `"node": ">=22.12"`. `~/.nvm/versions/node/` has 22.14.0 and 22.17.0, not 22.12.0. Owner: `docs/vite-plugin-release`,
  with the publish configuration. Do not install Node versions.
- **The dev server's virtual files and result processors.** Serving `addVirtualFile` from memory, and result
  processors after each transform, are `feature/vite-plugin-dev-server`. This slice keeps the in-memory set only.
- **The `hotUpdate` side of the write record** (own writes ignored, change cycles): `feature/vite-plugin-dev-invalidation`.
- **Instances per environment, and `build.outDir` per environment** (`this.environment.config.build.outDir`):
  `feature/vite-plugin-environments`. This slice uses the resolved top-level `build.outDir`.
- **Dependent profiles' result processors run once per module, with the source path** (`ModuleCompiler.ts:405-409`,
  the existing `TODO`), in the loader and in Vite alike. In addition, a profile inherits its dependencies' addons
  (`Compiler.ts:398`), so a dependency's result processor also runs in the host profile's `buildEnd` call, as it
  does once per profile in the CLI. No slice owns this. Report it in the PR as a possible follow-up issue, because
  changing it changes the loader.
- **The host's profile writes its own output to disk** (`tsc-out/*.js` above). `build` emits the target with
  `writeFile: true` (`ModuleCompiler.ts:425`) under the comment "do not write the file" (`:423`). The loader shares
  it. No slice owns this; report it in the PR.
- **The loader's `WebpackAddonContext` path handling** (cwd-relative paths, leading-slash stripping). Loader-only, and
  not this plan's concern.

If you find something the plan did not anticipate, report it in the PR rather than improvising outside scope. Check:

- whether Vite 6 and 7 both put an asset emitted in `generateBundle` into `build({ write: false })`'s output;
- whether a CSS asset's file name in lib mode differs between Vite 6 and 7 (for the removal e2e);
- whether a result processor that calls `addVirtualFile` in `buildEnd` gets its asset into the bundle (it should,
  since `generateBundle` runs later).
