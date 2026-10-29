# Deliverable lens: docs/plans/2026-10-16-addon-rebuild-gaps.md

Position: supported
Evidence: executed

Checked against `gh pr diff 214/215/216/218` and the code on origin/develop (a8844130). I did not count PR prose as evidence, with one exception: D16 asks for bench numbers in the PR, so the PR body is where that deliverable lives.

## Deliverables

### Slice 1: Stale output (#214)
- D1 SUPPORTED. `FileCache.updateSource` now replaces the snapshot when the content differs (`packages/core/src/compiler/cache/FileCache.ts`: `!file.snapshot || file.content !== content || this.hasChanged(fileName)`).
- D2 SUPPORTED. Unit tests in `FileCache.spec.ts` `describe("updateSource")`: same mtime with new content gives a new version, same content keeps the version, and different content per update gives a new version each time. `ModuleCompiler.spec.ts` "yields version bumped twice w/ two rebuilds of processor returning different text" makes the cost visible, as the Approach asks. Executed: they pass. Mutation: reverting the one-line fix makes 5 tests fail.
- D3 SUPPORTED. e2e cases for all four hosts:
  - Vite dev server: `vite-dev-invalidation.test.ts` "should serve new processor output w/ edit of asset dependency".
  - `vite build --watch`: `vite-addon-outputs.test.ts` "should bundle new processor output w/ edit of asset dependency under watch".
  - Loader watch: `webpack-loader-resolve-once.test.ts` "emits new processor output of edited asset dependency".
  - CLI watch: `bin.test.ts` "w/ --watch and processor reading an asset dependency".
  - Executed: all pass.
- D4 SUPPORTED. The `packages/vite/README.md` known-limit bullet is removed and the Dev server line is reworded.
- D5 SUPPORTED. Release-Notes entry added.

### Slice 2: noEmit in bundler hosts (#215)
- D6 SUPPORTED. The override lives in the shared bundler-host `ModuleCompiler`, which both the loader and the Vite plugin use. `getEmitMode` works from the resolved profile `tsConfig`. `IN_MEMORY_OPTIONS` removes `noEmit`, `emitDeclarationOnly` and `allowImportingTsExtensions`. `emitSourceFile(..., writeFile=false)` keeps the output in memory, and `selectWrittenFiles` writes only declarations under `emitDeclarationOnly`. The CLI `Compiler` keeps the default (`selectWrittenFiles` returns all files).
- D7 SUPPORTED. Unit tests on option resolution in both hosts, including `extends`:
  - `TsCompiler.spec.ts` "...noEmit and allowImportingTsExtensions in extended tsconfig".
  - `hooks.spec.ts` "should return processed code and write no file w/ noEmit inherited through extends".
  - `ModuleCompiler.spec.ts` "ModuleCompiler in-memory emit": 15 cases.
  - Executed: they pass.
- D8 SUPPORTED. e2e with the Vite template tsconfig (`noEmit`, `allowImportingTsExtensions`, no `outDir`):
  - `vite-no-emit.test.ts` covers build and dev on vite and vite6. It checks there are no warnings, so no TS5096, and that `src` holds only the sources.
  - `webpack-loader-no-emit.test.ts` covers transpileOnly true and false, no TS5096, and that no project file is written.
  - Executed: both pass.
- D9 SUPPORTED. `emitDeclarationOnly` gives the same bundle in both hosts, and declarations without an `outDir` go beside the sources (Vite test).
- D10 SUPPORTED. A dependent profile with `noEmit:false` and an `outDir` still writes there: Vite "should keep writing the dependent profile's output"; webpack "should keep the dependent profile's output in its outDir".
- D11 SUPPORTED. The CLI e2e is unchanged: #215 does not touch `bin.test.ts`.
- D12 SUPPORTED. In the README Configuration section, the warning is replaced by the in-memory rule and "Setting noEmit:false ... is no longer needed". The root README drops the workaround, and the webpack README gains a section. The Release-Notes entry is marked "Behaviour change".

### Slice 3: Type-only imports (#216)
- D13 SUPPORTED, with a deviation. New `type-dependencies.ts` computes the transitive closure through imports, exports, `import type`, dynamic import, import-equals and reference paths, plus the global files: scripts, ambient `.d.ts` files, and `declare global` or `declare module`. It excludes default libs and `node_modules`. The result is collected through a new `Compiler.onTypeCheckProgram` hook into `dependencies.files`.
  - Deviation: the trigger is "a Program was used for this emit". In the loader that means `declaration: true` without transpileOnly; in Vite it also covers a needsTypeInfo addon. The Approach's parenthetical says "no transpileOnly, or needsTypeInfo".
  - Why I did not refute it: the loader without `declaration` uses transpileModule and has no Program. The plan's own rule, "Without a Program ... nothing is added", therefore holds. The narrowing is documented in the README and Release-Notes.
- D14 SUPPORTED. Unit tests in `ModuleCompiler.spec.ts` "ModuleCompiler type dependencies": a type-only import, a barrel, transpileOnly giving none, and more. `type-dependencies.spec.ts` has 12 cases. Executed: they pass.
- D15 SUPPORTED, with a deviation. e2e:
  - Webpack: `webpack-loader-type-only-import.test.ts` checks that an error appears and clears again on revert, and that a barrel edit rebuilds.
  - Vite: `vite-dev-server.test.ts` "should reload the importer w/ edit of a type-only import" (through a barrel).
  - Deviation: the "type error" asserted is TS4023, a declaration-emit error, because the loader reports no semantic errors.
  - Executed: they pass.
- D16 SUPPORTED, read only. Bench: `esm-watch-bench.cjs` gained `--declaration`. The PR body reports a 1000-module initial build of 242 278 ms against 242 523 ms (ratio 1.001, under the 5% gate). I did not rerun the bench.
- D17 SUPPORTED. The Vite README known-limit lines are removed, and the webpack README and Release-Notes have entries.

### Slice 4: Build watch (#218)
- D18 SUPPORTED. `hooks.ts`:
  - `getBuildWatchInputs` covers the config, the tsconfig and its `extends` chain (including missing files), and the files in `addonsDir` outside `node_modules`. It is computed in `buildStart` when `this.meta.watchMode` is set.
  - `transform` passes these to `addWatchFile` for every module when not serving.
  - The new `watchChange` calls `forgetEnvironment` for an options input outside serve mode, and `plugin.ts` registers it.
- D19 SUPPORTED. `hooks.spec.ts` has unit tests for the build-watch inputs per module (7 cases) and `describe("watchChange")` (8 cases). Executed: 161 pass.
- D20 SUPPORTED. `vite-build-watch.test.ts`, on vite and vite6:
  - An addon edit rebuilds with the new addon (MARK_NEW in both modules).
  - A config edit that drops the addon leaves MARK_IN in every module.
  - A broken config gives exactly one ERROR in buildStart, and the fixing edit rebuilds clean.
  - Executed: 8 of 8 pass. Mutation: with `watchChange` unregistered in `plugin.ts`, 2 of 8 fail.
- D21 SUPPORTED. The "Known limit" in README "Addon context" is replaced by the build-watch rule plus its remaining limits. The Release-Notes entry is added.

## Executed (in a scratch copy of origin/develop: git archive, `pnpm install --frozen-lockfile`, `pnpm build`, 10/10 tasks OK)
- core: `jest FileCache.spec ModuleCompiler.spec type-dependencies.spec ErrorTrackingReporter.spec` gave 141/141 passed.
  - ErrorTrackingReporter failed once in a full parallel run and passed alone. It is not part of this plan.
- vite: `jest src/hooks.spec.ts` gave 161/161. webpack: `jest src/TsCompiler.spec.ts` gave 48/48.
- vite-test: `vite-build-watch` and `vite-no-emit` gave 19/19. dev-server, dev-invalidation and addon-outputs filtered to `type-only|asset dependency|own write of the generator` gave 14/14.
- webpack-test: `webpack-loader-no-emit` and `webpack-loader-type-only-import` gave 12/12. `webpack-loader-resolve-once -t 'asset dependency'` gave 1/1.
- compiler: `bin.test.ts -t 'asset dependency'` (CLI --watch) gave 1/1.
- Mutation 1: reverting the `FileCache.updateSource` condition made 5 core unit tests fail.
- Mutation 2: removing `watchChange` from `plugin.ts` and rebuilding vite made 2 of 8 `vite-build-watch` tests fail. Both mutations were restored in the scratch copy; the repository was not touched.

## Read only
- The PR diffs of #214, #215, #216 and #218, and the plan on origin/develop.
- The PR #216 body, for the bench numbers (D16) and the stated deviations (D13 and D15). I did not rerun the bench.
