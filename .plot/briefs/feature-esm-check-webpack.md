<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — esm-output-check (wave 4: webpack loader)

- **Plan (canonical):** `docs/plans/2026-09-24-esm-output-check.md` on `develop`
- **Approved:** 2026-09-25, Jan Wloka, plan-PR #112 merged (decisions below settled 2026-09-25, in-session)
- **Branch:** `feature/esm-check-webpack` (base: `develop`). claimed 2026-09-26 after wave 3 (#120–#123) and #124 merged; worktree `.worktrees/feature-esm-check-webpack`.
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh`; do not merge
- **Review of the code:** per repo convention; CI green

Line numbers are from `develop` at `3e32ddc` and the wave 2 worktree. Waves 2 and 3 will move them; re-find by name.

### What to build

After wave 3, the ESM check runs on every CLI path. In `websmith-loader` it runs nowhere, and the loader cannot
yet report per module:

- **Diagnostics are dropped.** Diagnostics go to the `error`/`warn` loader options, which default to no-ops
  (`TsCompiler.ts:33-34`, used at `:99-104`), so today no loader diagnostic fails a build.
- **Reports reach the wrong module.** The loader context is captured once, when the compiler instance is created
  (`TsCompiler.ts:35`, `compiler-instances.ts:23-43`), and so is the `dependencyCallback` closure
  (`loader.ts:24-26`). Every later `addDependency` lands on the **first** module's context.
- **`.mts`/`.cts` fail.** `processResultAndFinish` matches only `/\.jsx?$/` (`result-handling.ts:389-390`, `:400`).
  A `.mts` entry fails with *No processed output found* (reproduced with the built loader). `.mjs.map` would also
  be emitted as a stray asset.

Pieces:

1. **A `build` contract.** `TsCompiler.build(resourcePath)` returns `{ fragment, diagnostics, dependencies: { files,
   missing } }`. `loader.ts` does all reporting and registration through the **per-call** `this`:
   - `Error` → `this.emitError`;
   - `Warning` → `this.emitWarning`;
   - `Message`/`Suggestion` → `emitWarning` only under `debug`;
   - `this.addDependency` / `this.addMissingDependency`.

   Format with location (`formatDiagnostic`, `WebpackAddonService.ts:33-40`). This also routes the existing
   `fragment.diagnostics`, which is the plan's intended behaviour change (plan § failure semantics). The
   `error`/`warn` options are still called as secondary sinks after `emitError`/`emitWarning`, and documented as
   such.
2. **Where the check runs**: once per module request, inside `build`, never in a compilation-level hook. webpack
   keeps a module's errors while the module is cached; measured: an unchanged module's error still counts on a
   watch rebuild.
   - **Dependent profiles** (`TsCompiler.ts:77-89`, whose fragment is discarded today at `:82`): check
     `fragment.writtenFiles` with the dependent profile's own `esm` (not inherited), using wave 2's file
     classification. These are files on disk that another runtime loads.
   - **Target profile** (`:97`): check the JavaScript in `fragment.files`, **not** `writtenFiles`. webpack bundles
     `files`, and under `addonEmitOnly` `writtenFiles` is empty for a file no addon touched.
3. **Classification of the target under `runtime: "bundler"`: webpack's own module type.**
   - Map `this._module.type`: `javascript/esm` → esm, `javascript/dynamic` → `dynamic`, `javascript/auto` → auto.
   - When `_module` is missing (thread-loader), fall back to wave 2's classification; `instance-cache.ts:10-12`
     guards the same case.
   - Under `runtime: "node"` the target is honoured as declared: the loader also writes it to `outDir`, where Node
     may load it.
   - Add an optional module-kind override to `EsmCheckContext`.
4. **Which rules run in the loader.** Add a call-site mode to `EsmCheckContext` (e.g. `mode: "cli" | "loader"`) so
   rules can decline:

   | Rule | Loader |
   |------|--------|
   | 91001–91004 | yes |
   | 91005 | only under `runtime: "node"` |
   | 91010 / 91011 | **only under `runtime: "node"`** |
   | 91012 | **never** |
   | 91013 | only under `runtime: "node"` |
   | 91020 / 91021 | yes, with a per-compilation memo and dependencies |
   | 91030–91033 | yes |

5. **Dependencies.**
   - Wave 2's `EsmCheckContext.onDependency(fileName, exists)` reports every `package.json` probed, found or
     missing, and replays them on a cache hit.
   - The cjs-names resolver exposes the `package.json` files, entries and re-export targets it read.
   - Found files → `addDependency`; probes that missed → `addMissingDependency`, so creating a nearer
     `package.json` re-checks.
   - Make the `package.json` lookup injectable (e.g. `lookupPackageType?` on `EsmCheckContext`). Hold one
     **per-compilation** memo, reset in `compiler.hooks.thisCompilation` next to the taps in
     `webpack-hooks.ts:82-94`.
6. **`.mts`/`.cts`.**
   - Match `/\.(?:[cm]?js|jsx)$/i` and `/\.(?:[cm]?js|jsx)\.map$/i` in all three places. `.mjs.map` then becomes
     the source map.
   - `.d.mts`/`.d.cts` keep going through `emitAdditionalFile`.
   - README: users add `.mts`/`.cts` to `resolve.extensions`.
7. **Attribution in the loader.**
   - `WebpackAddonService.applyAddonsToContext` calls `activate` without setting the current addon
     (`WebpackAddonService.ts:113-122`), so coverage's attribution would read "unknown".
   - Use the activation API that `esm-check-coverage` provides.
   - Expose the active addon names; `getActiveAddons` is private (`:489`), and `this.addons` is undefined in the
     loader (`TsCompiler.ts:32`).
8. **Performance gate (≤10% watch rebuild).**
   - A manual benchmark `packages/webpack-test/perf/esm-watch-bench.cjs` (`perf:esm` script, not in CI).
   - Fixture: 1000 modules generated into a temp directory; about 10% carry processor or transformer addons;
     `"type": "module"` plus a few nested `package.json` files.
   - Variants: A without `esm`, B `bundler`, C `node` on a dependent profile.
   - Scenarios: 30 leaf edits, and 5 `"type"` flips.
   - At least 5 interleaved processes per variant; gate on **median(B or C) / median(A) ≤ 1.10** in both scenarios.
   - Also print the time spent inside `checkEsm` (hrtime, under `debug`).
   - Results go into the PR.
9. **Caching.**
   - A parse cache keyed by `fileName`, holding `{ hash(text), scan }` and replaced in place (`ts.sys.createHash`).
   - Classification and rules run on every call: a `"type"` flip leaves the output hash unchanged, so cached
     diagnostics would go stale.
   - The per-compilation `package.json` memo with replay (5).
   - cjs-names memo keyed by (importer dir, specifier), and a lexer cache keyed by entry path.
10. **Docs**: `packages/webpack/README.md` (ESM check in the loader, which rules run, `.mts`/`.cts`, the `error`/`warn`
    options as secondary sinks); `Release-Notes.md` `[Unreleased]`.
    - Changed: loader diagnostics now fail builds.
    - Added: `.mts`/`.cts` support.

### Wave 2 as merged (#119): what exists and what this slice adds

Checked against `develop` after #119 merged.

**What exists:**
- `EsmCheckContext` (`packages/core/src/compiler/esm/check-esm.ts:14-28`): `system`, `reporter`, `projectDir`, `debug?`,
  `profile?`, `addons?`, `onDependency?`, `platform?`.
- The kinds are `esm | commonjs | auto | dynamic`. `.cjs` files and `.js` under `"type": "commonjs"` are `dynamic`
  under `bundler`.
- `isEsmModuleKind` and `getEmittedModuleKind` exist.
- The core index exports `checkEsm`, `EsmDiagnosticCode` and `EsmCheckContext` (`packages/core/src/compiler/index.ts:11-12`).
  Export anything else the loader needs from there, not by deep import.

**The shared memo needs a per-call callback.** `createPackageTypeLookup(system, onDependency?)`
(`classify-module.ts:68`) binds `onDependency` **when the lookup is created**. The cache replays the probed paths
on a hit, but always to that one callback. A per-compilation memo shared across modules would send every module's
dependencies to the first module's context, which is the same bug as the cached `loaderContext`.
- Change the lookup to take the callback per call, for example `lookup(fileName, onDependency?)`, keeping the
  cache inside.
- `checkEsm` then passes `context.onDependency` on each call, and wave 4 injects one lookup per compilation.
- Test: two modules sharing one lookup each receive their own full dependency list.

**Additive context fields this slice adds:**
- the module-kind override for the target;
- the call-site `mode`;
- the injectable `lookupPackageType`.

Coordinate the names with whatever wave 3 added to `EsmCheckContext` by the time this slice starts: re-read the
file, don't trust this list.

**Wave 3 inputs to confirm at claim time**, when the preflight re-validates them:
- coverage's activation API (`runAsAddon` or its final name);
- how imports keeps each rule separately callable;
- cjs-names' injectable caches;
- package-type's rules taking `(classification, scan)`.

### Settled decisions — do not re-derive them

- **webpack's module type decides for the bundler target.** webpack's default rules key on the resource path, and
  none match `.ts`/`.mts`/`.cts`. Measured: `index.ts`, `m.mts`, `a.ts` and `s.ts` under `"type": "module"` were
  all `javascript/auto`. Wave 2's file classification would flag `require` that webpack bundles and runs.
  Rejected alternatives: wave 2 only (false positives), always strict ESM (more false positives).
- **91010/91011 are skipped under `bundler` in the loader.** Measured: a `type: "javascript/esm"` rule on `.ts`
  does not enforce `fullySpecified`, and where webpack does enforce it, it reports *Can't resolve … fully
  specified* itself. Rejected alternatives: keying on module type (false positives), reading the effective
  `resolve.fullySpecified` (exact but complex).
- **cjs-names runs in the loader** with a per-compilation memo and registered dependencies. Its resolver uses
  Node's conditions (`node`, `import`, `default`), not webpack's; document the possible mismatch. Rejected
  alternatives: skipping it, or running it only for `runtime: "node"`.
- **The performance gate is manual, with deterministic CI proxies.** Measured: rebuild medians swing 90–180 ms
  across identical runs, more noise than the 10% budget, so a CI threshold would flake. A proxy check (parse plus
  walk) cost about 0.3–0.5 ms per module. The risk is I/O (`package.json`, `node_modules`, the lexer) and
  per-call `getOptions(profile)`, not parsing.
- **Never call `getOptions(profile)` per module.** It runs `getTsConfig` (`ResolvedCompilerOptions.ts:287`).
  Read `esm` from `this.getOptions().config?.profiles?.[profile]?.esm`.
- **Never use the cached `loaderContext` or `dependencyCallback`** for anything this slice adds.
- **Do not set `this.version = fragment.version`** as a cache key (`loader.ts:32`). It overwrites the loader-API
  field and does nothing for webpack's cache. Leave the existing line alone unless it blocks the work.
- **"Fails the build"** (measured, webpack 5.97.1):
  - `emitError` → `stats.hasErrors()` and webpack-cli exits 1;
  - `emitWarning` → exit 0;
  - watch keeps running, and the error clears only on a clean rebuild of that module;
  - the in-process helper rejects on `hasErrors()` (`packages/node/src/webpack/WebpackBuild.ts:193`).
- **Behaviour change to call out.** Under `transpileOnly: false`, language-service syntax errors now fail loader
  builds. `websmith-loader.test.ts:536-562` (invalid file under `transpileOnly`) stays green, because
  `transpileModule` reports no syntax diagnostics (`Compiler.ts:1111-1115`).

### Done when

Assertions that exist because a naive implementation would pass without them:

- Two modules with the error in the second → `stats.compilation.errors[0].module.resource` ends with the second
  file, and the build fails. Catches `this.error` or the cached context.
- `addonEmitOnly`, a file no addon touched containing `require` under a `type: "javascript/esm"` rule → 91001.
  Catches checking `writtenFiles` for the target.
- `.ts` under `"type": "module"` with `require`, `runtime: "bundler"` → **nothing**. The same code under a
  `type: "javascript/esm"` rule → 91001. Catches wave 2's classification being used for the target.
- A loader context without `_module` → no crash, and wave 2's classification is used.
- `.mts` and `.cts` entries build, the source map is attached, and no `*.mjs.map` asset is emitted.
- Two modules in one directory under a `runtime: "node"` dependent profile; flip `"type"` in watch → **both**
  rebuild and their diagnostics flip. Catches a memo without dependency replay.
- Create `sub/package.json` during watch → only the module in `sub` rebuilds. Catches a missing
  `addMissingDependency`.
- A target with `esm` whose dependent has none → the dependent is not checked, and the reverse holds too.
- `check: "warn"` → `emitWarning` and a passing build.
- `import "./gone.js"` → only webpack's *Module not found*, no 91012.
- `runtime: "bundler"`, `import "./b"` → no 91010 from the loader.
- A second `build` with unchanged output text does not re-parse (spy on the scan). A leaf edit rebuilds exactly
  one module (`stats.compilation.builtModules`).
- Attribution: a diagnostic from a loader-activated transformer addon names that addon.
- Benchmark results in the PR for both scenarios and all variants, each ≤ 1.10.
- Repo gates: `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm test:e2e`; tests per `docs/rules/testing.md`.
  e2e in a new `packages/webpack-test/tests/webpack-esm-check.test.ts`, reusing the child-process harness of
  `webpack-esm-consumer.test.ts:116-150`.

### Bookkeeping

- Push the first real commit as soon as it exists.
- Open the PR with `plot-open-pr.sh`, then give it a descriptive title; the wave heading alone reads "Wave 4".
- Append `→ #<number>` to this branch's line in the plan's `## Slices`.

### Scope guard

This branch owns:
- in `packages/webpack/src/`: `loader.ts`, `TsCompiler.ts`, `result-handling.ts`, `webpack-hooks.ts`,
  `compiler-instances.ts`, `WebpackAddonService.ts`, `WebsmithLoaderConfig.ts`, and their specs;
- `packages/webpack-test/tests/webpack-esm-check.test.ts` and `packages/webpack-test/perf/`;
- `packages/webpack/README.md` and the release note;
- **additive** `EsmCheckContext` fields in `packages/core/src/compiler/esm/`: the module-kind override, the
  call-site mode, and the injectable lookup.

Found and **not** in scope (report, don't fix):
- In the loader, dependent profiles run with no addons activated (`TsCompiler.ts:32`, `:169`), so their output
  differs from the CLI's.
- `logDebug` and `WebpackAddonContext.addDependency` still use the stale context (`TsCompiler.ts:220-221`,
  `WebpackAddonContext.ts:112-113`, `:136-137`).
- Dependent-profile `ResultProcessor`s receive the source path (`TsCompiler.ts:84-88`).

These go to the `node24-esm-support` story.

If you find something the plan did not anticipate, report it rather than improvising outside scope.
