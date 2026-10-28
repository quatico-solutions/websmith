<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — loader-asset-dep-and-cli-noemit (wave 2: Loader asset dependencies)

- **Plan (canonical):** `docs/plans/2026-10-28-loader-asset-dep-and-cli-noemit.md` on `develop`
- **Approved:** 2026-10-28, jwloka, in-session
- **Branch:** `bug/loader-asset-dependency` (base: `develop`)
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh` (on PATH). Do not merge it yourself.
- **Review of the code:** an independent review, plus uncached gates run by the maintainer's session before merge

This is wave 2. Create the branch from `develop` **after "CLI noEmit" (`bug/cli-no-emit`) has merged**: that slice
changes the write decision in `packages/core/src/compiler/Compiler.ts` and adds a Fixed bullet to `Release-Notes.md`.
Keep its bullet and add yours beside it.

### What to build

In webpack watch mode, a module whose processor calls `ctx.addAssetDependency(dataFile, fileName)` rebuilds on the
first edit of the data file and never again. Measured on `develop` `a8844130` (and identically on `2efe07fa`, before
#214), with the addon shape of `packages/webpack-test/tests/webpack-loader-resolve-once.test.ts`
(`transpileOnly: false`, `compiler.watch`), editing DATA2, DATA3, DATA4:

| Build | Bundle | `data.txt` in `compilation.fileDependencies` |
|---|---|---|
| initial | `"DATA1"` | yes |
| after DATA2 edit | `"DATA2"` | **no** |
| after DATA3 edit | no rebuild within 25 s | — |

The cause is a callback bound to the wrong loader call. `loader.ts:29-31` passes
`(path) => this.addDependency(path)` to `getCompilerInstance`; `compiler-instances.ts:22-30` returns the cached
`TsCompiler` on every later call and drops that call's callback, so the instance keeps the closure of the call that
created it (`TsCompiler.ts:46-51` → `Compiler.ts:137-147` → `registerDependencyCallback`, `Compiler.ts:479`).
`CompilationContext.addAssetDependency` (`CompilationContext.ts:196-212`) calls it and ignores `parentPath`. On a
rebuild the processor runs, but its registration lands on the first call's stale context; webpack replaces a
module's dependencies on every build, so the file falls out after one rebuild.

Make each loader call register its own module's asset dependencies on its own context, on every build.

### Settled — do not re-derive

- **Asset dependencies travel with the build result.** `ModuleCompiler.build` returns
  `ModuleBuildResult.dependencies.files` (`ModuleCompiler.ts:40`, built at `:442-534`), and `loader.ts:34-35`
  already passes every one of those to the current call's `this.addDependency`. Collect each module's asset
  dependencies during its build and add them there. Model it on the type-dependency store right beside it
  (`typeDependencies` / `lastTypeDependencies`, `:208-210`, merged at `:523-527`): a store per module keeps the files
  when a build does not run the processor again.
- **Rejected: rebinding the callback on each loader call.** All modules share one `TsCompiler`, and webpack runs
  module builds concurrently, so a mutable "current callback" credits a file to whichever call set it last. The
  same flaw likely gives a module's asset dependency to another module in one initial build (suspected, not
  measured); the two-module e2e below settles it.
- **Leave the `registerDependencyCallback` plumbing in place** for other hosts unless nothing uses it any more after
  your change; the CLI watch and the Vite plugin take the `registerDependency(childPath, parentPath)` branch and
  pass three-edit reproductions today. Prove they still do with their existing e2e cases.
- **`WebpackAddonContext.addAssetDependency` (`WebpackAddonContext.ts:124-143`) is not this path**: it calls
  `this.loaderContext.addDependency`, but the loader's compiler does not go through it. Do not "fix" it instead.

Rules carried over: absent is not false; read exit codes, not output emptiness; TypeScript-version-dependent
results are asserted against what the running TypeScript reports (CI runs a 5.7.3 leg).

### Done when

- e2e in `packages/webpack-test/tests/`: three successive edits of one data file each produce a bundle with the new
  text (DATA1 → DATA2 → DATA3 → DATA4). The existing `webpack-loader-resolve-once` edits once and passes on the broken
  code, so a one-edit test does not count.
- e2e: two modules, each with its own data file; an edit of one data file rebuilds that module with its new text and
  leaves the other module's output unchanged.
- Unit tests in core for the per-module set: a module's build result lists the asset dependencies its processors
  registered, a second build without the processor running still lists them, and another module's files are not in
  it. Follow `docs/rules/testing.md` (assemble/act/assert, `testObj`/`actual`).
- The existing asset-dependency e2e cases for the CLI watch and the Vite plugin pass unchanged.
- `Release-Notes.md`: one Fixed bullet under `## [Unreleased]`. The existing `addAssetDependency` entry says "The
  webpack loader was not affected": true of the stale-text defect #214 fixed, so leave it and describe this one on
  its own.

Plus the repo gates: `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm test:e2e` (`AGENTS.md`). pnpm is pinned to
10.8.0 through `packageManager`; run it through corepack, never a newer system pnpm. Before each push, run
`node <plot scripts>/board/plot-local-checks.mjs` and run what it prints; CI runs the full suites.

### Bookkeeping

Push the first real commit as soon as it exists. Open the PR with `plot-open-pr.sh`, never `gh pr create`, then
append `→ #<number>` to this branch's heading line in the plan's `## Slices`. Commits follow Arlo's notation without
a colon (`B …`, `t …`, `d …`).

### Scope guard

This branch owns `packages/webpack/src/loader.ts`, `compiler-instances.ts` and `TsCompiler.ts` where the callback is
wired, the asset-dependency collection in `packages/core/src/compiler/ModuleCompiler.ts` and
`compilation/CompilationContext.ts`, their specs, new e2e under `packages/webpack-test/tests/`, and one
`Release-Notes.md` bullet. Do not touch the CLI write decision in `Compiler.ts` (wave 1) beyond what the callback
wiring needs.

If you find something the plan did not anticipate, report it in the PR rather than improvising outside scope.
