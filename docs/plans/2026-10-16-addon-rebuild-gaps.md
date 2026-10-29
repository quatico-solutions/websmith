<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# Fix addon rebuild and emit gaps found in the Vite plugin review

> Four defects that the Vite plugin's dev-server and dev-invalidation slices reproduced but did not own: type-only
> import edits rebuild nothing, an addon's data-file edit keeps the old output, `vite build --watch` ignores addon and
> config edits, and `noEmit: true` silently drops every addon's output in the bundler hosts.

## Status

- **State:** Delivered
- **Type:** bug
- **Story:** node24-esm-support
- **Review:** pr
- **Impl:** own branches
- **Rounds:** 3
- **Approved:** 2026-10-20, Jan Wloka, plan-PR #213 merged
- **Started:** 2026-10-23, Jan Wloka, `bug/type-only-import-deps`
- **Delivered:** 2026-10-23
<!-- Transition records — written by the workflow commands, not by hand:
- **Approved:** <date>, <who>, <channel>
- **Started:** <date>, <who>, <branch>   (one line per started branch)
-->

## Changelog

- An edit of a file a module imports only for its types (`import type`) rebuilds that module in the webpack loader's
  watch mode and reloads it in the Vite dev server, when the module was compiled with type information.
- After an edit of a file an addon reads through `addAssetDependency`, the rebuilt module carries the addon's new
  output. Before, the CLI's watch mode, the loader and the Vite plugin kept the previous text.
- `vite build --watch` rebuilds when an addon, `websmith.config.json` or `tsconfig.json` changes, activates the
  addons again and transforms every module with the new configuration.
- The webpack loader and the Vite plugin no longer drop addon output in projects whose `tsconfig.json` sets
  `noEmit: true` or `emitDeclarationOnly: true`, as Vite's project templates do. They use the compiled JavaScript in
  memory and write no file for it, and `allowImportingTsExtensions` no longer needs `noEmit`. A profile `tsConfig`
  with `"noEmit": false` and an `outDir` keeps writing there, but is no longer needed. The CLI keeps `tsc`'s meaning.

## Motivation

The Vite plugin plan's slices recorded these four limits under "Not in this slice" and handed them on
(`docs/vite-plugin-release`, #212, "Found, not built", rows 8–11). Each was reproduced on `develop`:

| # | Defect | Evidence | Hosts |
|---|---|---|---|
| 8 | A type-only import edit reloads nothing | Dev-server brief row 17, dev-invalidation brief row 14: edit `src/types.ts`, imported by `main.ts` with `import type`, gives `hotUpdate` with no modules and no payload. Core returns only `package.json` and ESM-check files as `dependencies` (`ModuleCompiler.ts:411-492`), never the Program files the type check read. | Vite (reproduced); loader (by reading, to reproduce first) |
| 9 | Stale output after an `addAssetDependency` edit | Dev-server brief row 16, dev-invalidation brief row 13: the processor runs again with the new data, the served module keeps the old text, also under `vite build --watch`. Cause confirmed: `FileCache.updateSource` (`cache/FileCache.ts:37-49`, called at `Compiler.ts:584`) keeps the old snapshot unless the source file's mtime is newer, even when the processors returned new text. Patching the condition to `!file.snapshot \|\| file.content !== content \|\| this.hasChanged(fileName)` served the new text on Vite 6 and 7. | core: CLI watch, loader, Vite |
| 10 | `vite build --watch` ignores addon and config edits | Dev-invalidation brief rows 15–16: an addon file is not watched, so its edit starts no rebuild; with a source edit as well, the old addon runs. A `websmith.config.json` edit that drops an addon re-activates the addons, but Rollup's cache does not transform unchanged modules again, so the bundle keeps the dropped addon's output. The README (`packages/vite/README.md`, "Addon context") states this as a known limit. | Vite build mode |
| 11 | `noEmit: true` silently drops every addon's output | Dev-invalidation brief row 17: in dev and `vite build` (Vite 7) the bundle carries the unprocessed source (`MARK_IN`, `DATA_IN`), with no diagnostic. Vite's `create-vite` templates set `noEmit: true` in `tsconfig.app.json`, so most Vite projects hit it. | Vite (reproduced); loader (to reproduce first) |

## Design

### Approach

- **Type-only imports.** When a module is compiled with type information (a Program exists: no `transpileOnly`, or
  an addon with `needsTypeInfo`), core adds the source files the Program read for that module to
  `ModuleBuildResult.dependencies.files`, minus `lib*.d.ts` and files under `node_modules`. Without a Program the
  output cannot depend on types, so nothing is added. The loader forwards them as file dependencies, which it already
  does for `dependencies`; the Vite plugin forwards them through `this.addWatchFile` and records them as its own watch
  files, so the dev-invalidation write guard keeps working. Which files "the Program read for that module" means is
  the slice's first decision: the transitive imports of the module's source file, not the whole Program, so one edit
  does not rebuild every module. It follows `import` and `export` chains through project files, so a type
  re-exported by a barrel `index.ts` is covered; direct imports alone would miss that, and every Program file would
  rebuild every typed module on any edit. An edit of a shared types file still rebuilds all its importers; that is
  the correct result, and its cost is gated: if `esm-watch-bench.cjs` shows the 1000-module initial build more than
  5% slower than on `develop`, the slice caches the import graph per compilation before it merges. In the loader
  a type-only edit can only change diagnostics (or a type-aware addon's output), so its e2e asserts that a type
  error caused by an edit of `types.ts` appears in the watch rebuild and clears when the edit is reverted.
  Type information also comes from files no import reaches: ambient `.d.ts` files, `declare global` and
  `declare module` augmentations, and global scripts pulled in by `include`, `types` or `typeRoots`. The Program's
  source files that are not modules, outside `node_modules` and not `lib*.d.ts`, are added to every typed module's
  dependencies as well. "Project file" means a Program source file outside `node_modules`, whatever resolved it, so
  `paths` aliases are covered; the `.d.ts` of a referenced project counts when it lies outside `node_modules`. If the
  loader repro shows that a type-only edit already rebuilds in webpack, the slice drops the loader e2e, keeps the
  Vite one and the unit tests of the loader's forwarding, and says so in the PR.
- **Stale output.** `FileCache.updateSource` replaces the snapshot when the content differs from the cached content,
  as well as when the file's mtime is newer. The version bump makes the language service re-read the file. A
  processor whose output differs on every run (a timestamp) now bumps the version on every rebuild and re-checks that
  file and its dependents; the new text is the right output, so correctness wins over the extra check. Bumping only
  when the edited file is one of the module's `addAssetDependency` files was rejected: it needs the changed path
  passed down into the cache for a saving that only such processors would see. A unit test makes the cost visible:
  two rebuilds with a processor that returns different text bump the version twice. The CLI's watch mode runs the
  processors on each rebuild as well and gets the same behaviour. The string comparison runs once per emitted
  module, after the processors; the slice checks with the bench that it does not show in the numbers.
- **`vite build --watch`.** In build mode with `this.meta.watchMode`, the plugin passes `websmith.config.json`, the
  `tsconfig.json` and its `extends` chain, and every file under the addons directory to `this.addWatchFile` in
  `transform` for every module it compiles. The addons directory tree is the rule the dev server's `hotUpdate`
  already uses, so dev and build watch agree; an addon's own dependencies outside that directory are not watched in
  either; the Vite README states that limit. The watch files are added in `transform`, not once in `buildStart`:
  Rollup's watcher rebuilds on a `buildStart` watch file but takes unchanged modules from its cache, and that cache is
  why a config edit leaves old output today (row 10). A watch file of a module makes Rollup transform that module
  again. Rollup keeps a module's watch files in a set, so the same paths across modules cost one entry per module. Rollup then re-transforms every such module when one of them changes, which is what the config edit
  needs. In `watchChange` for one of those files, the plugin drops its compiler instance, as `hotUpdate` does in the
  dev server, so the next `buildStart` re-resolves options and re-activates the addons. A configuration error on
  such a rebuild fails that rebuild and leaves the watcher running; the edit that fixes it rebuilds clean, as in
  the dev server and the loader's watch mode.
- **`noEmit`.** A bundler host needs the compiled JavaScript, so the loader and the Vite plugin decide per profile,
  after `tsconfig.json` and the profile's `tsConfig` are merged: a profile whose resolved `noEmit` or
  `emitDeclarationOnly` is true is compiled with both removed, as `ts.transpileModule` already removes them on the
  `transpileOnly` path (`TRANSPILE_REMOVED_OPTIONS`, `Compiler.ts:67`), together with `allowImportingTsExtensions`,
  and its JavaScript is emitted with `writeFile` false (`Compiler.ts:491`): used in memory, never written to disk.
  Two traps of a plain `noEmit: false` are avoided that way: without an `outDir` the emit would write `.js` next to
  the user's sources, and Vite's templates set `allowImportingTsExtensions`, which reports TS5096 without `noEmit`.
  Declarations are still written where the profile asks for them. A dependent profile with its own `noEmit: false`
  and `outDir` writes as it does today, so the README's current workaround keeps working; the README says it is no
  longer needed. The override is silent and documented in the README: Vite's templates set `noEmit`, so a warning
  would fire in almost every project. The CLI keeps `tsc`'s meaning (`noEmit` emits nothing). The webpack loader
  README also states the change. With `emitDeclarationOnly` removed and `declaration: true`, declarations go where
  `tsc` would put them for that profile; the e2e asserts the location without an `outDir`.

### Open Points

- [ ] `noEmit`: does a loader build with `noEmit: true` drop output, fail, or work today? Reproduce first; the slice
      line holds either way.
- [ ] Type-only imports in the loader: reproduce first that a type-only edit rebuilds nothing in watch mode today.
- [ ] `noEmitOnError: true` also drops the JavaScript of a module with a type error in the bundler hosts. The
      `noEmit` slice checks whether that differs from today's behaviour on the type-information path and from the
      `transpileOnly` path (which ignores it), and checks that `composite`, `incremental` and `tsBuildInfoFile` do not
      interact with the in-memory emit. A finding goes into the PR as a follow-up, not into this slice.

## Slices

One slice per wave, in this order: the small core fix first, then `noEmit`, which hits most Vite projects, then
the type-only dependencies, then build watch, which adds its watch files beside theirs.

### Stale output (Branch: bug/file-cache-update-source) <!-- builds: content-aware FileCache.updateSource --> PR: #214

`FileCache.updateSource` replaces the snapshot when the content changed; unit tests in `FileCache.spec.ts` (same mtime, new content → new version; same content → same version); e2e: a processor reading a data file through `addAssetDependency` serves the new text after the data edit in the Vite dev server, in `vite build --watch`, in the loader's watch mode and in the CLI's watch mode; README known-limit lines removed; Release-Notes entry

### noEmit in bundler hosts (Branch: bug/bundler-no-emit) <!-- builds: noEmit override in the bundler hosts --> PR: #215

In the loader and the Vite plugin, a profile whose resolved `noEmit` or `emitDeclarationOnly` is true compiles without them and without `allowImportingTsExtensions` and emits its JavaScript in memory only; unit tests on option resolution in both hosts, including a profile that inherits `noEmit` through `extends`; e2e in `webpack-test` and `vite-test` with Vite's template `tsconfig.json` (`noEmit`, `allowImportingTsExtensions`, no `outDir`): addon output is in the bundle in dev and build, no TS5096, no `.js` written beside the sources; `emitDeclarationOnly: true` gives the same bundle; a dependent profile with `noEmit: false` and `outDir` still writes there; the CLI e2e unchanged; README Configuration warning replaced by the in-memory rule and "the workaround is no longer needed"; Release-Notes behaviour-change entry

### Type-only imports (Branch: bug/type-only-import-deps) <!-- builds: type-check dependencies in ModuleBuildResult --> PR: #216

Core returns, for a module compiled with type information, the project source files its type check depends on (transitive imports, `lib*.d.ts` and `node_modules` excluded) in `dependencies.files`; the loader and the Vite plugin forward them; unit tests in `ModuleCompiler.spec.ts` (type-only import listed with a Program, a type re-exported through a barrel listed, nothing listed under `transpileOnly`); e2e: in webpack watch mode an edit of a type-only import makes a type error appear on the importer and reverting it clears the error (reproduce first), and a Vite dev-server edit of `src/types.ts` reloads `main.ts`; README known-limit lines removed; Release-Notes entry; bench numbers in the PR, initial build at most 5% slower than `develop` or the import graph cached per compilation

### Build watch (Branch: bug/vite-build-watch-reload) <!-- builds: build-watch invalidation in the Vite plugin --> <!-- waits: bug/type-only-import-deps --> PR: #218

In `vite build --watch`, the config file, the `tsconfig.json` chain and the addon files are watch files of every compiled module, and a change of one drops the compiler instance; unit tests in `hooks.spec.ts`; e2e in `vite-test`: an addon edit rebuilds with the new addon, a config edit that drops an addon removes its output from every module, a broken config fails one rebuild and the fixing edit rebuilds clean; README "Addon context" known limit removed; Release-Notes entry

## Notes

- Created 2026-10-16 from the "Found, not built" table of #212 (rows 8–11), after the Vite plugin plan was
  delivered. The other rows of that table (1, 7, 12, 14) stay in the review follow-ups; they are not in this plan.
- Decided with the maintainer: one bug plan with four slices, plan PR review, own branches.
- `noEmit`: decided to emit anyway in the bundler hosts. Rejected: failing the build with a diagnostic, because Vite's
  own templates set `noEmit: true` and every Vite user would have to override it; deciding in the slice, because the
  direction changes the slice's scope.
- Challenged 2026-10-17 (3 rounds). The plain `noEmit: false` override was replaced by the in-memory emit, because it
  would write `.js` beside sources without an `outDir` and report TS5096 under Vite's `allowImportingTsExtensions`.
  Rejected there: overriding only when an `outDir` is set (Vite templates set none), and going back to an error.
  Override per resolved profile, not only the host's target profile, so a dependent profile's addon output is not
  dropped either. No warning and no debug line for the override. Type-only dependencies: transitive project imports,
  with a 5% initial-build gate; rejected direct imports only and every Program file. `vite build --watch` watches the
  addons directory tree, as dev does; rejected tracking the files the registry loaded (core has no require
  tracking). The loader's type-only e2e asserts a diagnostic, not a type-aware addon's output.
- `bug/vite-build-watch-reload` waits for `bug/type-only-import-deps`: both add watch files in `packages/vite`'s
  `transform` and record them for the write guard.

<!-- CHALLENGE-THE-PLAN-METADATA
rounds: 3
last_run: 2026-10-17
categories_covered: [technical, ux-error, non-functional-performance, trade-offs]
deferred: []
-->
