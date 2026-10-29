<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# Fix the loader's lost asset dependencies and the CLI's ignored noEmit

> Two defects the addon-rebuild-gaps delivery panel found and two independent runs reproduced: the webpack loader
> stops watching an addon's data file after the first rebuild, and the `websmith` command writes JavaScript under
> `noEmit` when no addon needs type information.

## Status

- **State:** Delivered
- **Type:** bug
- **Story:** node24-esm-support
- **Review:** in-session
- **Impl:** own branches
- **Approved:** 2026-10-28, jwloka, in-session
- **Started:** 2026-10-28, Jan Wloka, `bug/cli-no-emit`
- **Started:** 2026-10-28, Jan Wloka, `bug/loader-asset-dependency`
- **Delivered:** 2026-10-28
<!-- Transition records — written by the workflow commands, not by hand:
- **Approved:** <date>, <who>, <channel>
- **Started:** <date>, <who>, <branch>   (one line per started branch)
-->

## Changelog

- In watch mode, the webpack loader rebuilds a module on every edit of a file an addon registered with
  `addAssetDependency`. Before, it rebuilt on the first edit only and then stopped watching the file.
- The `websmith` command writes no JavaScript under `noEmit: true` or `--noEmit`, as with `tsc`. Before, it wrote
  the JavaScript when no addon needed type information.

## Motivation

The delivery panel of `addon-rebuild-gaps` (`.plot/panels/2026-10-16-addon-rebuild-gaps-delivery/panel.md`)
refuted two claims. Both defects predate that plan; both were reproduced again on `develop` (`a8844130`) and on the
commit before the PR that touched the area.

| # | Defect | Reproduction | Cause |
|---|--------|--------------|-------|
| 1 | Loader loses an asset dependency after the first rebuild | Processor calls `ctx.addAssetDependency(data, file)`, `transpileOnly: false`, `compiler.watch`; edits DATA2, DATA3: bundle gets DATA2, then no rebuild within 25 s. `data.txt` is in `compilation.fileDependencies` after the first build and gone after the first rebuild. Same on `2efe07fa` (before #214). | `loader.ts:29-31` hands `(path) => this.addDependency(path)` to `getCompilerInstance`; `compiler-instances.ts:22-30` returns the cached instance on later calls and drops their callback. `CompilationContext.addAssetDependency` (`:196-212`) calls that first closure, so later registrations land on a stale loader context and ignore `parentPath`. Webpack resets a module's dependencies per build, so the file falls out after one rebuild. |
| 2 | CLI writes JS under `noEmit` | Project with `noEmit: true` (or `--noEmit`), no addon or only addons with `needsTypeInfo: false`: `websmith` writes `dist/a.js`, exit 0; `tsc` 6.0.3 writes nothing. With a `needsTypeInfo: true` addon both write nothing. Same on `db76de85` (before #215). | `shouldUseTranspileModuleFastPath` (`Compiler.ts:764-771`) picks `ts.transpileModule`, which forces `noEmit` off (`TRANSPILE_REMOVED_OPTIONS`, `:66-80`); `processOutput` (`~1176-1195`) writes whatever comes back, and nothing on that path reads `noEmit`. |

`Release-Notes.md` (`[Unreleased]`, the `noEmit` behaviour-change entry) states "The `websmith` command keeps
`tsc`'s meaning", which defect 2 makes false. Fixing the CLI makes the sentence true rather than retracting it.

## Design

### Approach

- **Asset dependencies travel with the build result, not through a callback.** Core records each
  `addAssetDependency(child, parent)` against its parent module and returns those files in
  `ModuleBuildResult.dependencies.files` for the module being built, which `loader.ts:34-35` already passes to
  `this.addDependency`. Every loader call then registers its own module's data files on its own context, on every
  build. The cached-instance callback stays for hosts that use it, but the loader no longer relies on it. Rejected:
  rebinding the callback on each loader call, because concurrent module builds share one instance and a mutable
  "current" callback would attribute a file to whichever call set it last.
- **The CLI honours `noEmit` on the fast path.** When a profile's resolved options (before
  `TRANSPILE_REMOVED_OPTIONS` strips them for `transpileModule`) set `noEmit`, the CLI host compiles and runs the
  processors as now but writes no output file. Generators and result processors still run, as they do on the Program
  path. The bundler hosts are not affected: they already take `noEmit` profiles through `ModuleCompiler`'s in-memory
  emit (#215), and their e2e suites prove it stays so. `emitDeclarationOnly` already writes only declarations on
  both paths and is unchanged.

### Open Points

- [ ] Whether the CLI's watch mode reaches the same write decision as a single run; the slice checks it with the
      e2e rather than by reading.
- [ ] Whether the stale first-call callback also mis-attributes asset dependencies across modules in one initial
      build (suspected, not measured); the loader slice's e2e covers two modules with separate data files.

## Slices

One slice per wave. The CLI slice goes first: the `[Unreleased]` sentence it makes true must not reach a release
false. The two slices touch different packages (`core`'s write decision; `core`'s dependency set and `webpack`'s
loader) and share only `Release-Notes.md`.

### CLI noEmit (Branch: bug/cli-no-emit) <!-- builds: noEmit write decision on the CLI fast path --> PR: #221

The CLI writes nothing under `noEmit` or `--noEmit` on the transpile fast path; unit tests in `Compiler.spec.ts` for
the write decision; e2e in `compiler-test`: `noEmit` in tsconfig, `--noEmit`, and a `needsTypeInfo: false` addon each
write no file and exit 0, with the addon still activated; a run with `--watch` writes nothing either; the webpack and
Vite `noEmit` e2e suites unchanged and passing; Release-Notes Fixed entry

### Loader asset dependencies (Branch: bug/loader-asset-dependency) <!-- builds: per-module asset dependencies in ModuleBuildResult --> PR: #222

Core returns each module's asset dependencies in its build result and the loader registers them per call; e2e in
`webpack-test`: three successive edits of one data file each rebuild with the new text, and two modules with their own
data files each rebuild only on their own; unit tests in core for the per-module dependency set; Release-Notes Fixed
entry

## Notes

- Repro sources: `repro-loader-asset-dep.spec.ts` and `repro-cli/run.sh` from the 2026-10-27/28 session; the plan
  states their observed output in Motivation, so the slices do not depend on those files.
- Not in this plan: the Vite plugin never reporting TS5096 (panel, non-blocking), and the plan-record error in
  `addon-rebuild-gaps`' own Changelog bullet 2.
