<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# deliverable

Plan: docs/plans/2026-09-24-fix-ts-addons-esm-projects.md. Evidence: PR #116 diff (21 files), plus the merged worktree .worktrees/feature-fix-ts-addons-esm-projects.

## Deliverables

1. Approach: CLI (`AddonRegistry`) output is treated as CommonJS even when the consumer is ESM. SUPPORTED. `AddonRegistry.ts` adds `writeCommonJsMarker` and calls it on `libDir` before `compileSourceFiles`.
2. Approach: loader (`WebpackAddonService`) output is treated as CommonJS. SUPPORTED. The `WebpackAddonService.ts` hunk imports `writeCommonJsMarker` and writes it to `cacheDir`.
3. Decided: the CLI default output is `<tsconfig dir>/.websmith-cache/addons-cli`, and `addonLibDir` still overrides it. SUPPORTED. `command.ts` sets `addonOutDir` from `dirname(resolvePath(tsConfigFile))`. `AddonRegistry` uses `addonLibDir` first when it is set. The `command.spec.ts` cases "tsconfig.json directory" and "resolved relative tsconfig.json directory" cover this. One caveat: the registry's own fallback is cwd, not the tsconfig directory. The CLI always passes `addonOutDir`, so CLI behaviour matches the plan.
4. Decided: the CLI and the loader keep separate directories (`addons-cli` and `addons`). SUPPORTED. The constant is `DEFAULT_ADDON_OUT_DIR`. The loader's `cacheDir` is unchanged, and the updated test cleanups point at `.websmith-cache/addons`.
5. Decided: the loader uses `moduleResolution: Node10`. SUPPORTED. The diff changes `NodeNext` to `Node10`.
6. Decided: loader errors 2307, 2792 and 7016 become warnings and emit continues. SUPPORTED. `MODULE_RESOLUTION_ERRORS` is added, those codes are reported as `WarnMessage` and filtered out of the thrown errors. Two tests cover it: the spec "should report module resolution error as warning" and the e2e "should warn about unresolved package…", which passed.
7. Decided: the loader cache key includes the compile options, and the marker is written before the cache check. SUPPORTED. `calculateSourceHash(allSourceFiles, compilerOptions)` now hashes the options, and the marker block moved above the cache lookup. Covered by the spec block "cache from earlier compile options".
8. Decided: import resolution moves with the output; the README and release note say so, and an e2e case imports a package from the project's `node_modules`. SUPPORTED. The README, the compiler README and the Release-Notes all carry the paragraph. `bin.test.ts` adds "importing package from project node_modules", which passed.
9. Decided: `{"type":"commonjs"}` is written at the directory root, so cross-addon imports also load as CommonJS. SUPPORTED. Both cross-addon e2e cases passed (CLI and loader).
10. Decided: an existing `package.json` is never overwritten, and a warning is reported instead. SUPPORTED. `writeCommonJsMarker` returns early when the file exists and warns if its type is not commonjs. Both specs cover this ("does not overwrite…", "reports warning…").
11. Decided: old output is left alone. SUPPORTED. Nothing in `AddonRegistry.ts` deletes files: I found no `rmSync`, `unlink` or `trash`. The release note says the old `lib/` can be deleted.
12. Decided: do not write to `lib/`; reject `.cjs` and per-addon markers. SUPPORTED. Output goes to `.js` in a single root directory.
13. Tests: CLI e2e case for a `"type": "module"` consumer "in `compiler-test`". PARTIAL (location). The three ESM cases are in `packages/compiler/src/bin.test.ts`, which runs the built CLI. `packages/compiler-test` gained only a one-line cleanup change. The behaviour is tested, but not where the plan said.
14. Tests: loader e2e case in `webpack-test`. SUPPORTED. The new `webpack-esm-consumer.test.ts` has 4 cases, all passing.
15. Tests: unit tests for the marker logic. SUPPORTED. 11 new cases in `AddonRegistry.spec.ts` and 8 in `WebpackAddonService.spec.ts`.
16. Fixtures: the 5 listed cleanup sites move off `example-addons/lib`. SUPPORTED. Each of the 5 files has a one-line change to `.websmith-cache/...`.
17. Docs: `README.md` and `packages/compiler/README.md` tell users to add `.websmith-cache/` to `.gitignore`. SUPPORTED. Both diffs contain the sentence. The repo's `.gitignore:14` already has `.websmith-cache`.
18. Slice `feature/fix-ts-addons-esm-projects` is delivered by #116. SUPPORTED. The PR carries this branch.
19. Changelog, both bullets. SUPPORTED. `Release-Notes.md` has the #111 "now load" entry and the `.websmith-cache/addons-cli` move entry, plus a note on the Node10 switch.

I did not run the Definition of Done commands (`pnpm lint`, the full `pnpm test`, `pnpm build`, the full `pnpm test:e2e`). They are checklist items, not deliverables, and they are still unchecked in the plan.

## Executed vs read

EXECUTED in the worktree:
- `jest bin.test.ts -t 'type module'`: 3 passed.
- `jest tests/webpack-esm-consumer.test.ts`: 4 passed.
- `AddonRegistry.spec.ts`: 59 passed.
- `WebpackAddonService.spec.ts`: 20 passed.
- `command.spec.ts`: 33 passed.
- Grep of `.gitignore` and `AddonRegistry.ts`, which is how items 11 and 17 were checked.

READ: the plan, `gh pr view 116` (file list), `gh pr diff 116`, the diffs of `AddonRegistry.ts`, `WebpackAddonService.ts`, `command.ts`, the READMEs, `Release-Notes.md`, `docs/rules/addons.md` and the test files.

## Overall

All 19 deliverables are present in the merged diff. The one discrepancy is item 13: the CLI ESM e2e cases are in `packages/compiler/src/bin.test.ts` instead of `compiler-test`. They drive the CLI end to end and they pass, so the function is delivered and only the named location differs. I found nothing absent or contradicted.

Position: supported
Evidence: executed
