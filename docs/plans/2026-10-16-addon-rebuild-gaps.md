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

- **State:** Draft
- **Type:** bug
- **Story:** node24-esm-support
- **Review:** pr
- **Impl:** own branches
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
- The webpack loader and the Vite plugin compile with `noEmit: false`, so addon output is no longer dropped in
  projects whose `tsconfig.json` sets `noEmit: true`, as Vite's project templates do. The CLI keeps `tsc`'s meaning.

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
  does not rebuild every module.
- **Stale output.** `FileCache.updateSource` replaces the snapshot when the content differs from the cached content,
  as well as when the file's mtime is newer. The version bump makes the language service re-read the file.
- **`vite build --watch`.** In build mode with `this.meta.watchMode`, the plugin passes `websmith.config.json`, the
  `tsconfig.json` and its `extends` chain, and the addon files to `this.addWatchFile` in `transform` for every module
  it compiles. Rollup then re-transforms every such module when one of them changes, which is what the config edit
  needs. In `watchChange` for one of those files, the plugin drops its compiler instance, as `hotUpdate` does in the
  dev server, so the next `buildStart` re-resolves options and re-activates the addons.
- **`noEmit`.** The loader and the Vite plugin set `noEmit: false` on the options they resolve, after `tsconfig.json`
  and the profile's `tsConfig` are merged. A bundler host needs the transformed code; type checking is not affected.
  The CLI keeps `tsc`'s meaning (`noEmit` emits nothing). The same slice checks `emitDeclarationOnly`, which drops
  JavaScript the same way, and treats it the same if it does.

### Open Points

- [ ] Type-only imports: is the dependency set per module (transitive imports of the source file) cheap enough on a
      1000-module build? The slice measures with `esm-watch-bench.cjs` and reports the numbers in the PR.
- [ ] `noEmit`: does a loader build with `noEmit: true` drop output, fail, or work today? Reproduce first; the slice
      line holds either way.

## Slices

- `bug/type-only-import-deps` — core returns, for a module compiled with type information, the project source files its type check depends on (transitive imports, `lib*.d.ts` and `node_modules` excluded) in `dependencies.files`; the loader and the Vite plugin forward them; unit tests in `ModuleCompiler.spec.ts` (type-only import listed with a Program, not listed under `transpileOnly`); e2e: a webpack watch edit of a type-only import that changes a diagnostic rebuilds the importer (reproduce first), and a Vite dev-server edit of `src/types.ts` reloads `main.ts`; README known-limit lines removed; Release-Notes entry; bench numbers in the PR <!-- builds: type-check dependencies in ModuleBuildResult -->
- `bug/file-cache-update-source` — `FileCache.updateSource` replaces the snapshot when the content changed; unit tests in `FileCache.spec.ts` (same mtime, new content → new version; same content → same version); e2e: a processor reading a data file through `addAssetDependency` serves the new text after the data edit in the Vite dev server, in `vite build --watch`, in the loader's watch mode and in the CLI's watch mode; README known-limit lines removed; Release-Notes entry <!-- builds: content-aware FileCache.updateSource -->
- `bug/vite-build-watch-reload` — in `vite build --watch`, the config file, the `tsconfig.json` chain and the addon files are watch files of every compiled module, and a change of one drops the compiler instance; unit tests in `hooks.spec.ts`; e2e in `vite-test`: an addon edit rebuilds with the new addon, a config edit that drops an addon removes its output from every module; README "Addon context" known limit removed; Release-Notes entry <!-- builds: build-watch invalidation in the Vite plugin --> <!-- waits: bug/type-only-import-deps -->
- `bug/bundler-no-emit` — the loader and the Vite plugin resolve options with `noEmit: false` (and `emitDeclarationOnly: false` if it drops output too); unit tests on option resolution in both hosts; e2e in `webpack-test` and `vite-test` with a `tsconfig.json` that sets `noEmit: true`: addon output is in the bundle, dev and build; the CLI e2e unchanged; README Configuration warning about `noEmit` replaced; Release-Notes behaviour-change entry <!-- builds: noEmit override in the bundler hosts -->

## Notes

- Created 2026-10-16 from the "Found, not built" table of #212 (rows 8–11), after the Vite plugin plan was
  delivered. The other rows of that table (1, 7, 12, 14) stay in the review follow-ups; they are not in this plan.
- Decided with the maintainer: one bug plan with four slices, plan PR review, own branches.
- `noEmit`: decided to emit anyway in the bundler hosts. Rejected: failing the build with a diagnostic, because Vite's
  own templates set `noEmit: true` and every Vite user would have to override it; deciding in the slice, because the
  direction changes the slice's scope.
- `bug/vite-build-watch-reload` waits for `bug/type-only-import-deps`: both add watch files in `packages/vite`'s
  `transform` and record them for the write guard.
