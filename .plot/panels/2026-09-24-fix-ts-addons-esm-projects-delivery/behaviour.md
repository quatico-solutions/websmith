<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# behaviour

Deliverables, each checked by trying to refute it:

1. Changelog: .ts addons load in "type":"module" projects (#111). SUPPORTED, executed. I set up a scratch consumer with `"type":"module"`, a single-file addon `single`, a cross-addon `cross` (imports `../xform/helper` and requires `plainpkg` from the project's node_modules), and ran `node packages/compiler/bin/bin.js --addonsDir ./addons --addons single,cross --project ./tsconfig.json`. It exited 0, and `dist/index.js` contained `single = 'SINGLE_APPLIED'`, `cross = 'CROSS_APPLIED'` and `pkg = 'PKG'`. Release-Notes.md has the matching entry.
2. Changelog: the CLI writes to `.websmith-cache/addons-cli` next to tsconfig, not `lib/`. SUPPORTED, executed. `find .websmith-cache` listed `addons-cli/{package.json,single/addon.js,cross/addon.js,xform/addon.js,xform/helper.js}`, and `ls lib` gave "No such file or directory".
3. Approach: both compile sites keep `module: CommonJS`. SUPPORTED, read and executed. The emitted `addon.js` loads as CJS, and the WebpackAddonService.ts hunk keeps `ModuleKind.CommonJS`.
4. Decided: the cache root is the tsconfig directory, not the cwd. SUPPORTED, executed. From the parent directory, `--project proj/tsconfig.json` wrote only `proj/.websmith-cache/addons-cli/...`, with nothing in the cwd. command.ts computes `addonOutDir` from `dirname(tsConfigFile)`. The spec "should yield addonOutDir … of resolved relative tsconfig.json directory" passes.
5. Decided: `addonLibDir` still works as an override. SUPPORTED, executed as a unit test. The AddonRegistry.spec case "compiles into addonLibDir w/ addonLibDir and addonOutDir" passes (59/59).
6. Decided: the CLI and loader use separate directories (`addons-cli` vs `addons`), each with its own marker. SUPPORTED. The CLI run gave `addons-cli`. The loader writes the marker into `.websmith-cache/addons`, and its e2e test passes.
7. Decided: the loader uses `moduleResolution: Node10`. SUPPORTED, read (hunk `NodeNext` to `Node10`) and executed through the loader e2e test, whose cross-addon case passes.
8. Decided: loader errors 2307/2792/7016 become warnings. SUPPORTED, executed. The e2e cases "should apply .ts addon importing package with types only under package.json exports" and "should warn about unresolved package…" pass. The unit case "should report module resolution error as warning" passes.
9. Decided: the loader cache key includes the compile options, and the marker is written before the cache check. SUPPORTED, read (the marker write now comes before the moved cache block, and `calculateSourceHash(…, compilerOptions)`). Specs "should write CommonJS package.json marker w/ cache from earlier compile options" and "should recompile addon w/ cache from earlier compile options" pass (20/20).
10. Decided: import resolution moves with the output, and an e2e case imports a package from the project's node_modules. SUPPORTED, executed. My run printed `pkg = 'PKG'`. The bin.test case "…importing package from project node_modules w/ consumer package.json type module" passes. README, compiler README and Release-Notes state the constraint.
11. Decided: `{"type":"commonjs"}` marker at the directory root, which covers cross-addon imports. SUPPORTED, executed. `cat .websmith-cache/addons-cli/package.json` gave `{"type":"commonjs"}`, and the cross-addon import applied.
12. Decided: an existing package.json is never overwritten, and a warning is printed. SUPPORTED, executed. I pre-seeded `addons-cli/package.json` with `{"type":"module"}`. The CLI printed `[WARN] … package.json" already exists and was not changed. Compiled addons may fail to load unless it declares "type": "commonjs".`, and the file still read `{"type":"module"}`. The addons then failed with the original `ADDON_STRUCTURE_ERROR: exports is not defined`, which is the expected failure without the marker.
13. Decided: old output is left alone and nothing is deleted. SUPPORTED, read (no deletion code in the diff), plus the release note saying old `lib/` output can be deleted.
14. Decided/rejected: no `.cjs` output and no marker per addon. SUPPORTED. The output is `.js` under a single root marker, as observed.
15. Tests first, part 1: an e2e case in `compiler-test` for a "type":"module" consumer. PARTIAL. No such case was added under `packages/compiler-test`; that file only changes its cleanup path. The equivalent three ESM e2e cases (single, cross-addon, node_modules) are in `packages/compiler/src/bin.test.ts`, and I ran them: 3 passed. The behaviour is covered, but not in the named package.
16. Tests first, part 2: the webpack loader e2e case. SUPPORTED, executed. `npx jest --runInBand --no-watchman tests/webpack-esm-consumer.test.ts` gave `PASS … Tests: 4 passed, 4 total` (apply .ts addon, multi-file cross-addon, exports-only types, warn on unresolved). My first run without `--runInBand` died in a jest-haste-map ENOENT on a transient `test-output-…/.websmith-cache/addons/package.json`, probably another juror running in the same worktree at the same time. It did not recur.
17. Tests first, part 3: unit tests for the marker logic. SUPPORTED, executed. AddonRegistry.spec (59 passed) and WebpackAddonService.spec (20 passed) include the marker write, write-once, no-overwrite and warning cases.
18. Tests and fixtures: five cleanup paths move to the new directories. SUPPORTED, read. compile-websmith.test.ts now cleans `addons-cli`, and the other four clean `.websmith-cache/addons`.
19. Tests and fixtures: README.md and packages/compiler/README.md tell users to add `.websmith-cache/` to `.gitignore`. SUPPORTED, read. Both diffs contain the sentence, and `.gitignore:14` already has `.websmith-cache`.
20. Slice: `feature/fix-ts-addons-esm-projects` becomes #116. SUPPORTED. It was merged as 6f40f73. `gh pr checks 116` shows claude-review, dist (22), dist (24) and license/cla all pass.

EXECUTED:
- The bundled CLI against a scratch ESM consumer: single-file addon, cross-addon, bare package, running from the tsconfig directory and from its parent, and a pre-seeded non-CJS package.json.
- The webpack ESM e2e file.
- AddonRegistry.spec, WebpackAddonService.spec, and the ESM/addonOutDir cases in command.spec and bin.test.

READ ONLY:
- The diff hunks for the cache-key ordering and no-deletion.
- Docs and release notes, the cleanup-path moves, and the CI checks.
- The bundled `bin.js` was built at 14:03, and grep finds `addons-cli` in it.

Side observation, not a deliverable: when I ran without flags, a `websmith.config.json` in the consumer was not picked up, so no addon applied. I used explicit `--addonsDir`/`--addons`. This looks unrelated to #116.

Overall: every behaviour the plan names happened when run. The only gap is where the tests live: the CLI ESM e2e cases are in `packages/compiler/src/bin.test.ts`, not `compiler-test` as the plan says. The behaviour is pinned all the same, so I don't count it as a failure to deliver.

Position: supported
Evidence: executed
