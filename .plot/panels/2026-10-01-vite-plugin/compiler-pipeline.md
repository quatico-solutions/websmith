<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# websmith compiler pipeline

Executed: nothing (no build, no reproduction). Read: the plan on `origin/idea/vite-plugin`, and on `origin/develop`
`packages/webpack/src/{TsCompiler,loader,webpack-hooks,compiler-instances,WebpackAddonService,WebpackAddonContext,result-handling}.ts`,
`packages/core/src/compiler/Compiler.ts`, `packages/api/src/options/WebpackLoaderOptions.ts`, the TS7 story, and the old
`origin/feature/60--plugin-for-vite` adapter.

## Findings that change the plan

1. **The seam is decidable by reading, so the tracer need not build it both ways.** `TsCompiler.ts:17` has a value import
   `import { type LoaderContext, WebpackError } from "webpack"`, and the same file constructs `WebpackError` for `warn`
   (`:~329`). `WebpackAddonService.ts:14` and `WebpackAddonContext.ts:20` (`sources` is a value import) import `webpack` too.
   The loader package therefore loads `webpack` at runtime and lists it as a peer dependency
   (`packages/webpack/package.json`). "Vite plugin depends on the loader" forces webpack into every Vite project. That option is
   dead; the plan's either/or is not open. The only real design is a bundler-neutral per-module compiler in
   `@quatico/websmith-core`, with the loader as one thin host.
   Note the package is named `websmith-loader` (unscoped), not `@quatico/websmith-loader` as the Open Point says.

2. **The seam is wider than `TsCompiler`.** `TsCompiler extends core Compiler` but passes `addons = undefined` to `super`
   (`TsCompiler.ts:~121`). The core `AddonRegistry` is never used on the loader path, so `createProfileContextsIfNecessary`
   (`Compiler.ts:363`) activates nothing. Addons come in through `WebpackAddonService.applyAddonsToContext`
   (`WebpackAddonService.ts:105`), which builds a `WebpackAddonContext` bound to `LoaderContext` (`addDependency`) and webpack's
   `Compilation` (`emitAsset`), and registers the addon's generators and processors on the `CompilationContext`. A Vite host needs
   its own `AddonContext` (`addInputFile`, `addAssetDependency`, `addVirtualFile` map to `addWatchFile`/`emitFile`), plus
   either that addon loader (compiles addons to `.websmith-cache`, `require`s CJS) or the core registry that the CLI uses. Which
   registry the extraction standardises on is a decision the plan omits. Slice "Tracer" must cover it.

3. **"Generators and result processors once per build" is not what the loader does, so there is nothing to reuse.**
   - Generators run per file inside `Compiler.emitSourceFile` (`Compiler.ts:~488-505`), once per module per build.
   - Result processors never run for the loader's own profile. `generateAddonOutputs` and `executeResultProcessors` sit behind
     `result.files.length > 0` in `applyAddonFunctionality` (`TsCompiler.ts:~371`), but `build()` calls it once with a literal empty
     fragment (`TsCompiler.ts:~226`). That branch looks unreachable. For dependent profiles they run per file with a
     `// TODO ... webpack has not written the file yet` (`:~208`).
   - The core `compile()` path runs result processors once per profile (`Compiler.ts:~175`), but only for the CLI.
   The Vite slice "Addon outputs and profiles" must define "once per build" itself (Rollup `buildStart`/`buildEnd`/`closeBundle`,
   dev server `listen`/close). Say so in the plan; also say whether the dead webpack branch is fixed first, because the two hosts
   would otherwise diverge.

4. **Failure semantics are not inherited from `build()`.** `applyAddonFunctionality` catches addon errors and downgrades them to
   `warn` ("Don't break webpack builds due to addon errors", `TsCompiler.ts:~392`). `Compiler.emitSourceFile` reports generator
   and processor throws as `ErrorMessage` through the reporter (`:~500-520`), which only the loader's `ConfigErrorReporter`
   path turns into build failures for config errors, not for these. Plan says "nothing is swallowed" and "fails `vite build` on
   errors"; that needs an explicit rule for addon throws, otherwise the Vite plugin reproduces the exact flaw the plan criticises
   in the old attempt. Decide: addon throws fail the Vite build, and the extraction carries the rule for both hosts.

5. **Diagnostics need a host-neutral shape.** The loader reports with `emitError`/`emitWarning` plus the `error`/`warn` options
   typed as `WebpackError` callbacks (`loader.ts`, `WebsmithLoaderConfig.ts`). The extracted compiler should return
   `ts.Diagnostic[]` (as `LoaderBuildResult` already does) and leave rendering to each host; "configuration errors once per
   build" is `webpack-hooks.ts afterCompile` plus a per-compilation `Set` (`:~100`), i.e. a host concern for Vite too
   (`buildStart`, with a de-dup across dev-server reloads). The plan should name the neutral contract: `build(file, {moduleKind})`
   returns `{fragment, diagnostics, dependencies}`; `getConfigErrors()`.

6. **ESM check needs a Vite `moduleKind`.** `build(resourcePath, moduleType)` maps webpack module types to `esm`/`dynamic`/`auto`
   (`TsCompiler.ts:~37`); without one it falls back to package.json classification. Under `runtime: "bundler"` Vite
   resolves ESM semantics (dev and build). Choose what the Vite host passes. The plan claims "the ESM check reports per module
   like the loader" without this.

7. **`pre` plus esbuild output.** websmith's output must keep ES module syntax, but `transpileModule`/profile outputs with `module:
   commonjs` would break Vite. The plugin needs a guard (profile's module kind must be ESM, reported as a diagnostic, in line with
   the ESM check) rather than silently handing CJS to Rollup. Not in the plan.

## Approach, slices

- **Tracer** is too big as a single PR if it also extracts the neutral compiler: it must move/split `TsCompiler`,
  `WebpackAddonService` and `WebpackAddonContext`, keep `webpack-test` and `loader.test.ts` green, and add `packages/vite`
  plus `packages/vite-test`. Split into a refactor slice first, `feature/neutral-module-compiler` (extract to core, loader as
  thin host, no behaviour change, existing webpack unit and e2e tests as the guard), then the Vite tracer. The tracer proves
  the seam; the refactor is what decides it, and reading already decides the direction.
- Diagnostics: reasonably sized once the neutral contract exists. Tests that fail before: a TS error fails `vite build`; a
  broken profile reported once.
- Dev server: the HMR slice is heavy (watch inputs, invalidation, config re-resolve). Acceptable, but the type-info Open Point
  needs a measurement; the tracer cannot answer it, so move that Open Point to the Dev server slice (as the plan half does).
- Addon outputs: depends on point 3; as written it is under-specified.
- Release slice has no unit-testable failure; fine for a docs slice. `publish configuration` should be checked against the npm
  trusted-publishing workflow added in 0.10.0 (`81a0efab`).

## Overlap

- Not TS7: `docs/stories/ts7-rearchitecture` says the in-process loader is impossible on 7.x and per-file `transpileModule` has
  no transformers. A Vite plugin on the in-process API inherits the same limit; the plan should state that it targets TS 5.x/6.x
  like the loader, and not claim TS7 support. A neutral compiler in core is also the cheapest step toward a backend adapter.
- Other plans: `loader-options-once` (#134) and `cli-error-exit-gaps` (#136) touch the same loader and reporter code that the
  extraction moves; sequence them before the refactor slice, or the extraction conflicts. I did not read those plans in full.
- The old attempt's `compiler-adapter.ts` is a placeholder stub (returns a fixed comment string), so "reuse the attempt's ideas
  and tests" carries little; only the file layout and config example are worth keeping.

## Open points to decide before approval

1. The seam: decide now in favour of core extraction (point 1); drop the "depend on the loader" alternative, and drop "the tracer
   decides". Name the registry (core `AddonRegistry` vs `WebpackAddonService`) and the neutral addon context.
2. Define "once per build" for generators and result processors in Vite (point 3) and whether the webpack dead branch is fixed.
3. Addon throws must fail the build (point 4).
4. Vite `moduleKind` for the ESM check and the CJS-output guard (points 6, 7).
5. Supported Vite majors, type-info in dev, SSR/Environment API: may remain open, but the Environment API open point should block
   the profile-to-environment mapping, not the tracer.

Verdict: amend
