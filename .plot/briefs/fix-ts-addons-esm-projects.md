<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — fix-ts-addons-esm-projects

- **Plan (canonical):** `docs/plans/2026-09-24-fix-ts-addons-esm-projects.md` on this branch (same-branch flow)
- **Approved:** 2026-09-25, Jan Wloka, in-session · **Issue:** #111
- **Branch:** `feature/fix-ts-addons-esm-projects` (base: `develop`)
- **Ends as:** one PR to `develop` carrying plan and code, opened with `plot-open-pr.sh`; the body links the plan,
  mirrors its approval and says `Closes #111`
- **Review of the code:** per repo convention; CI green

### What to build

A `.ts` addon fails to load when the consumer's `package.json` says `"type": "module"`:
`ADDON_STRUCTURE_ERROR: exports is not defined in ES module scope` (reproduced with the bundled CLI on Node 24.21.0
and 20.19.4). websmith compiles addons to CommonJS `.js`, and Node reads those as ESM under `"type": "module"`.

Keep compiling to CommonJS. Write compiled addons into a websmith-owned directory with `{"type": "commonjs"}` as
`package.json` at its root:

- **CLI (`AddonRegistry`):** default output moves from `<addonsDir>/../lib` (`AddonRegistry.ts:389-390`) to
  `<tsconfig.json directory>/.websmith-cache/addons-cli`. `addonLibDir` is a *name* resolved against the addons
  directory's parent, so it cannot express this: add an absolute output directory to `AddonConfig`
  (e.g. `addonOutDir`), set it in `addonConfig()` (`packages/compiler/src/command.ts:175`) from the directory of the
  resolved `tsconfig.json` (`args.project ?? "./tsconfig.json"`, `command.ts:89`). Without it (API callers), fall
  back to `<system.getCurrentDirectory()>/.websmith-cache/addons-cli`. An explicit `addonLibDir` keeps its old
  meaning and wins.
- **Loader (`WebpackAddonService`):** keeps its directory `<cwd>/.websmith-cache/addons` (`WebpackAddonService.ts:46`,
  `TsCompiler.ts:133`); add the same marker there.

### Settled decisions — do not re-derive them

- **A root marker, not `.cjs` output.** `.cjs` breaks CommonJS `require("./helper")` in multi-file addons and
  cross-addon imports (`foobar-replace-processor` → `../foobar-replace-transformer`): `require` does not resolve
  `.cjs` without the extension.
- **Not in `lib/`.** `<addonsDir>/../lib` can be the client's own build output; in this repo
  `packages/example-addons` publishes `main: lib/index.js` from the same `lib/`. A marker there would turn the
  client's ESM into CommonJS.
- **Never overwrite an existing `package.json`** in the output directory; with an explicit `addonLibDir` that has
  one, report a `WarnMessage` and leave it.
- **Separate directories for CLI and loader.** They compile with different options (CLI: `Classic` + `noResolve`,
  `AddonRegistry.ts:553-563`; loader: `NodeNext`, `WebpackAddonService.ts:288-304`), and the registry skips
  recompiling when output is newer than source, so a shared directory would let one load the other's build.
- **tsconfig directory, not the working directory, for the CLI**, so `websmith -p packages/x` from a monorepo root
  and from inside `packages/x` share one cache.
- **Old output in `<addonsDir>/../lib` is left alone**; no warning, no deletion. The release note says it can be
  deleted.

### Done when

- e2e (`packages/compiler-test` or `bin.test.ts`): a consumer with `"type": "module"` and a `.ts` addon compiles and
  applies the addon, exit 0 — fails today with `ADDON_STRUCTURE_ERROR`. With the wave 1 exit code not yet merged,
  assert the addon's effect on the output, not only the status.
- The same for the webpack loader in `packages/webpack-test`. Whether it fails before the fix is unverified (#111
  infers it); record what you observe in the red phase.
- A multi-file addon with a cross-addon import still loads (guards against a per-directory or `.cjs` shortcut).
- Unit tests: the marker is written once, an existing `package.json` is not overwritten (warning reported), and
  the default output directory is derived from the tsconfig directory.
- The five fixture cleanups that remove `example-addons/lib` point at the new directories:
  `compiler-test/tests/compile-websmith.test.ts:34`, `webpack-test/tests/webpack-websmith.test.ts:55`,
  `webpack-test/tests/compile-module-date.test.ts:64`, `webpack-test/tests/websmith-loader.test.ts:29`,
  `webpack/src/webpack.test.ts:35`.
- `README.md` and `packages/compiler/README.md`: `.websmith-cache/` belongs in the client's `.gitignore`.
  `Release-Notes.md`: `Fixed` (#111) and `Changed` (new output location, old `lib/` output can be deleted).
- Repo gates: `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm test:e2e`; tests follow `docs/rules/testing.md`.

### Scope guard

`packages/core/src/compiler/addons/AddonRegistry.ts` (+ spec), `packages/compiler/src/command.ts` (+ spec),
`packages/webpack/src/WebpackAddonService.ts` (+ spec), the five fixture files above, e2e fixtures and tests,
READMEs, `Release-Notes.md`, the plan.

In flight (2026-09-25): #115 (`feature/cli-exit-and-written-set`) also edits `packages/compiler/src/command.ts`
(the reporter wrap, around line 88, and the exit code after `compile()`) and `Release-Notes.md`. Keep edits in
`command.ts` to `addonConfig()` so the merge stays trivial. #114 (`feature/node-24-support`) touches manifests and
workflows only.
