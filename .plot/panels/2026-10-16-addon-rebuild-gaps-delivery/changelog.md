# Delivery panel: changelog lens, 2026-10-16-addon-rebuild-gaps

Position: refuted
Evidence: executed

Subject: origin/develop @ a8844130 (PRs #214, #215, #216, #218). Built in a `git clone --shared` under the session
scratchpad. The repository checkout was not touched, except for this file.

## Deliverables (the user-facing claims this lens checks)

- D1: Stale output after an `addAssetDependency` edit is fixed (#214).
- D2: `noEmit` / `emitDeclarationOnly` handled in memory in the bundler hosts; the CLI keeps tsc's meaning (#215).
- D3: Type-only import edits rebuild or reload the importer (#216).
- D4: `vite build --watch` reloads on addon, config and tsconfig edits (#218).

## Findings

C-1: REFUTED. "The `websmith` command keeps `tsc`'s meaning." (Release-Notes.md:190; the plan's Changelog bullet 4,
"The CLI keeps `tsc`'s meaning"; the plan's Design says "(`noEmit` emits nothing)".) EXECUTED: the built CLI was
given `{"noEmit":true,"outDir":"dist","rootDir":"src"}` and `src/a.ts`, with no addons. `node packages/compiler/bin/bin.js
--project tsconfig.json` exited 0 and wrote `dist/a.js` (`export const a = 1;`). Passing `--noEmit` on the command line
gave the same result. With the same tsconfig, `tsc` 6.0.3 wrote nothing. The CLI does honour `noEmit` on the Program
path: compile-websmith.test.ts:373 uses a type-info generator and expects no `.js`. On the transpileModule fast path it
does not. #215 did not cause this, because it changed nothing in `Compiler.ts`'s write decision (`selectWrittenFiles`
is the identity in the base class). The released sentence still states something false, and no CLI e2e asserts it on
the fast path.

C-2: REFUTED (plan record only). The plan's Changelog bullet 2 says: "Before, the CLI's watch mode, the loader and the
Vite plugin kept the previous text." The loader was never stale: #214's own body says so ("The loader was never
stale ... its new e2e case is a guard: it passes before and after the fix"). The Release-Notes entry
(Release-Notes.md:260-263) correctly says "The webpack loader was not affected". The user-facing entry is right and the
plan's summary line is wrong. That line is in the frozen plan, so this is a record mismatch, not a code defect.

C-3: SUPPORTED. D1's Release-Notes entry (Release-Notes.md:260-263): the fix applies to `websmith --watch` with a
type-info addon, to the Vite dev server and to `vite build --watch`. Code: FileCache.ts:39 adds
`file.content !== content`. EXECUTED: core `FileCache.spec.ts` passed. The CLI e2e `bin.test.ts -t "asset dependency"`
passed (1 test). `webpack-loader-resolve-once.test.ts`, which includes the loader guard, passed. The vite-test runs
`-t "asset dependency"` in vite-addon-outputs and vite-dev-invalidation passed.

C-4: SUPPORTED. Known limits removed: the vite README's "can keep the old text" bullet was removed by #214. On develop,
the vite README:203 says the module reloads "with the addon's new output". No README still claims stale output.

C-5: SUPPORTED. D2 in the bundler hosts: the Release-Notes:184-190 and webpack README:149-158 claims are borne out.
`noEmit` / `emitDeclarationOnly` are dropped together with `allowImportingTsExtensions`, and `noEmitOnError` is dropped
only under `noEmit`. The JavaScript stays in memory, declarations are written under `emitDeclarationOnly`, and a
dependent profile with `noEmit:false` and an `outDir` keeps writing. Code: ModuleCompiler.ts `IN_MEMORY_OPTIONS`,
`getContextCompilerOptions`, `emitSourceFile`, `selectWrittenFiles`. EXECUTED, all passed: `webpack-loader-no-emit.test.ts`
(7 tests: no TS5096, `emitDeclarationOnly` writes `.d.ts` only, dependent profile outDir, `noEmitOnError` with `.ts`
imports), `vite-no-emit.test.ts` (template tsconfig, `extends`, declarations beside sources without outDir, dependent
profile), and the noEmit cases in ModuleCompiler.spec.

C-6: SUPPORTED. The vite README Configuration section (vite README:68-77) replaced the old `noEmit: false` workaround
with the in-memory rule and "no longer needed". The Known-limits line about `"noEmit": true` dropping output was
removed. The root README.md:142 example dropped `"noEmit": false`. No remaining README text tells users to set
`noEmit: false`. Checked with grep over README.md, packages/{vite,webpack,compiler,api}/README.md and
docs/rules/{configuration,addons}.md.

C-7: SUPPORTED. D3's Release-Notes:264-269 claim is that the loader rebuilds on a type-only edit with
`declaration: true`, and the Vite dev server also rebuilds with a type-info addon. The narrower loader wording is
accurate: webpack's `TsCompiler` passes no `AddonRegistry` (TsCompiler.ts:50), so `anyAddonNeedsTypeInfo` is false.
Only `declaration` reaches `onTypeCheckProgram` (Compiler.ts:1347/1404/1521/1566), and the transpileModule paths
never do. Re-exports, `paths`, ambient `.d.ts` files, and excluding `lib` and `node_modules` are in
type-dependencies.ts. EXECUTED: core `type-dependencies.spec.ts` passed. Full `ModuleCompiler.spec.ts` passed
(108/108). `webpack-loader-type-only-import.test.ts` passed (declaration error appears and clears, barrel, none under
transpileOnly, no node_modules or lib). vite-dev-server `-t type-only` passed (importer reloads, declarations of the
type-info addon).

C-8: SUPPORTED. The type-only Known-limits bullet and the dev-server "does not reload its importer" sentence were
removed by #216. On develop the vite README:199-203 describes the new behaviour. The webpack README:142-147 adds the
"Type-only imports" section.

C-9: SUPPORTED. D4's claims are at Release-Notes:26-28 and vite README:229-235: `vite build --watch` rebuilds on a
change to `websmith.config.json`, the tsconfig (and the files it `extends`) or any file in `addonsDir`. It activates
the addons again and transforms every module. A configuration error fails one rebuild only. Code: hooks.ts
`getBuildWatchInputs` (options files incl. extends/missing + `listFiles(addonsDir)`) added per module in `transform`
under `meta.watchMode`, and `watchChange` → `forgetEnvironment`. EXECUTED: `vite-build-watch.test.ts` passed (addon
edit, config edit removes the dropped addon's output from every module, broken config fixed, source-only edit). The
vite `hooks.spec.ts` passed (161/161).

C-10: SUPPORTED. The "Under `vite build --watch` ... restart the build" Known-limits line and the "Known limit:"
paragraph in Addon context were removed by #218. They were replaced by the limits that still hold: dependencies
outside `addonsDir` are not watched, only the entry is reloaded, and a new file is watched only from the next rebuild.
These match the code: `listFiles` runs at `buildStart` only, and there is no require tracking.

C-11: Read only, not refuted. The "Before" sentences of the noEmit entry (Release-Notes:188-189: "wrote the
JavaScript to `outDir`, or to `./lib` ..., and failed with 'No processed output found'") describe the loader before
the change. They were not reproduced, because the pre-#215 build in the clone failed in `websmith-testing`.

## Executed vs read

EXECUTED (Node 24.21.0, pnpm 10.8.0 via corepack shim):
- `pnpm install --frozen-lockfile --offline` and `pnpm build` in the scratch clone at a8844130: both exit 0.
- core jest: FileCache.spec and type-dependencies.spec (27 passed); ModuleCompiler.spec (108 passed).
- vite jest: hooks.spec (161 passed). webpack jest: TsCompiler.spec (48 passed).
- webpack-test: webpack-loader-no-emit, webpack-loader-type-only-import, webpack-loader-resolve-once (21 passed).
- vite-test: vite-no-emit and vite-build-watch (19 passed). vite-dev-server, vite-dev-invalidation and
  vite-addon-outputs with `-t "type-only|asset dependency|..."` (12 passed).
- compiler: bin.test.ts `-t "asset dependency"` (1 passed).
- CLI noEmit probe (C-1): websmith wrote dist/a.js and `tsc -p` wrote nothing.
- An attempt to build the pre-#215 parent failed (`websmith-testing` build). It was not used as evidence.

READ: the plan on origin/develop; the README, Release-Notes and architecture hunks of `gh pr diff 214/215/216/218`;
the code hunks of ModuleCompiler.ts, Compiler.ts, type-dependencies.ts and hooks.ts/plugin.ts; the #214 PR body (used
only to corroborate C-2, which also rests on the guard test passing); compile-websmith.test.ts:365-385.
