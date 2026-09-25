<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# changelog

**Deliverables and verdicts** (every item was checked for signs that it was not delivered)

1. The CLI compiles into `<tsconfig dir>/.websmith-cache/addons-cli` instead of `<addonsDir>/../lib`. SUPPORTED. `command.ts` passes `addonOutDir` from `dirname(tsConfigFile)`, and `AddonRegistry.ts` swaps `DEFAULT_ADDON_LIB_DIR="lib"` for `DEFAULT_ADDON_OUT_DIR`. I ran it and the output landed in `.websmith-cache/addons-cli`. The project's own `lib/keep.txt` was left untouched.
2. The cache sits next to the tsconfig directory, not the working directory, so `-p packages/x` run from a parent directory uses the same cache. SUPPORTED. I ran it from the parent with `-p esmproj/tsconfig.json`. The cache was created in `esmproj/.websmith-cache`, and none was created in the parent.
3. `addonLibDir` still works as an explicit override. SUPPORTED. `AddonRegistry.ts` gives it precedence (`addonLibDir ? path.resolve(addonsDir,"..",addonLibDir) : ...`).
4. The CLI and the loader use separate directories (`addons-cli` and `addons`), each with its own marker. SUPPORTED. The loader keeps its `cacheDir` and calls `writeCommonJsMarker(this.cacheDir, ...)`.
5. The loader switches to `moduleResolution: Node10`. SUPPORTED. The `WebpackAddonService.ts` hunk changes `NodeNext` to `Node10`.
6. In the loader, errors 2307, 2792 and 7016 become warnings and the build still emits. SUPPORTED. `MODULE_RESOLUTION_ERRORS` is filtered into `WarnMessage` and excluded from the thrown errors. The test `webpack-esm-consumer.test.ts` asserts `WARN.*Cannot find module`.
7. The loader's cache key includes the compile options, and the marker is written before the cache check. SUPPORTED. `calculateSourceHash(allSourceFiles, compilerOptions)` runs after `ensureCacheDirectory()` and `writeCommonJsMarker`.
8. Import resolution moves with the output, and an e2e case imports a package from the project's `node_modules`. SUPPORTED. `bin.test.ts` has "importing package from project node_modules"; the Release-Notes and both READMEs state the limit.
9. A `{"type":"commonjs"}` `package.json` marker goes at the root of each output directory. SUPPORTED. I ran it: `.websmith-cache/addons-cli/package.json` = `{"type":"commonjs"}`, and a cross-addon import (`q` to `../p/addon`) loaded in a `"type":"module"` project on Node 20.19.4.
10. An existing `package.json` is never overwritten, with a warning. SUPPORTED, with a refinement. The code warns only when the existing file is not `"type":"commonjs"`, and the PR body says so.
11. Old output is left alone, and the release note says it can be deleted. SUPPORTED. Nothing is deleted, and the Release-Notes "Changed" bullet says the old `lib/` output can be deleted.
12. `lib/` is not used, and there is no `.cjs` output or per-addon marker. SUPPORTED. There is a single root marker and the output is plain `.js`.
13. Tests first: an e2e case in `compiler-test` for a `"type":"module"` consumer. PARTIAL. The CLI e2e cases are in `packages/compiler/src/bin.test.ts`, not in `compiler-test`. The substance is there (3 cases); only the location differs. The loader e2e is `webpack-test/tests/webpack-esm-consumer.test.ts` (4 cases), and the marker unit tests are in `AddonRegistry.spec.ts` and `WebpackAddonService.spec.ts`.
14. Five test files move their cleanup to the new directories. SUPPORTED. All five files named in the plan change their `rmSync` target in the diff.
15. `README.md` and `packages/compiler/README.md` tell users to gitignore `.websmith-cache/`. SUPPORTED. Both hunks say so, and this repo's `.gitignore` has it at line 14.
16. Slice `feature/fix-ts-addons-esm-projects` → #116. SUPPORTED. The PR is merged at `6f40f73` on develop.
17. Changelog bullet 1, TS addons load in `"type":"module"` projects (#111). SUPPORTED. It is in Release-Notes "Fixed", covers the CLI and the loader, and item 9 confirms it for the CLI by running it.
18. Changelog bullet 2, CLI output moves to `.websmith-cache/addons-cli` and old `lib/` output can be deleted. SUPPORTED. The Release-Notes bullet says this almost word for word, and runs 1 and 2 confirm the location.

**Changelog lens**
- Everything user-visible that the diff builds is mentioned in Release-Notes.md: the output move, the new import-resolution scope, loader `Node10`, a one-time recompile of old loader builds, and unresolved imports reported as warnings.
- Release-Notes.md makes no claim that the code does not back.
- The plan's own `## Changelog` has only 2 bullets. It leaves out the loader changes (`Node10`, one-time recompile, warnings) and the import-resolution change. Those are covered in its Decided bullets and in Release-Notes.md, so users are told, but the plan's section is incomplete. This is a gap in the plan, not in what shipped.
- Changes not mentioned in any changelog: `writeCommonJsMarker` is now exported from `@quatico/websmith-core`, and `AddonConfig` has a new `addonOutDir` field. Both are in the internal core package, so they are not user-facing. Leaving them out is acceptable.
- The README wording ("loader in `.websmith-cache/addons` in the working directory") matches the loader's cwd-based `cacheDir`.

**EXECUTED**
- I ran the built `packages/compiler/bin/bin.js` from the worktree (`grep` finds "addons-cli" in it) on Node v20.19.4, against a scratch `"type":"module"` project with a cross-addon `.ts` addon. Result: exit 0, `dist/a.js` = `export function crossDone()`, marker written, `lib/` untouched.
- I re-ran it from the parent directory with `-p`. Result: exit 0, cache created next to the tsconfig, none in the working directory.
- I did not run the webpack loader or the test suites. They write into the worktree, which is read-only for me.

**READ**
- The plan, the `gh pr view 116` metadata, and the full `gh pr diff 116` hunks: README, Release-Notes, compiler README, `docs/rules/addons.md`, `command.ts`, `AddonRegistry.ts`, `WebpackAddonService.ts`, the test files, and `.gitignore`.

**Overall**: Every deliverable is met in substance. The only gaps are the CLI e2e cases sitting in a different test package, and the plan's `## Changelog` being narrower than the Release-Notes.md that actually shipped. The release notes and READMEs describe what the diff does.

Position: supported
Evidence: executed
