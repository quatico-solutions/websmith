<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# addon author and Vite user

Executed: nothing built. Read: the plan on `origin/idea/vite-plugin`, `packages/webpack/src/{TsCompiler,loader,loader-options,WebpackAddonContext,webpack-hooks}.ts` on `origin/develop`, the Magellan addons (`qs-magellan/node/packages/addons/src`, read-only), the TS7 story, and the sibling plans' text for `TsCompiler`/`loader-options` overlap.

## Findings that change the plan

1. **Addon-context file operations have no Vite mapping.** `WebpackAddonContext` implements `addVirtualFile` (webpack `emitAsset`), `removeOutputFile` (deletes the asset), `addAssetDependency` and `addInputFile` (`WebpackAddonContext.ts` ~L105-215). The plan only speaks of "files addons write" and a possible `emitFile` (Open Point 4). An addon author needs every `AddonContext` method to behave on Vite or to fail loudly. The plan needs a `ViteAddonContext` section: `addVirtualFile` in build (`emitFile`) and in dev (served virtual module or disk), `removeOutputFile`, `addInputFile` (extra module), `addAssetDependency` (-> `addWatchFile`/HMR graph). Unsupported methods must report an error diagnostic, not no-op.
2. **Magellan runs unchanged only for the easy half.** Its addons use `ctx.getReporter()` and `ctx.getSystem().readFile/writeFile` (e.g. `client-index-generator.ts:27-68`), so they are bundler-neutral; they never touch `addVirtualFile` or webpack. But Magellan's config is two targets, `client` (`client-function-transform`, strips server code) and `server` (`service-function-generate`, writes `lib/server`), and the client index generator *reads emitted JS from `outDir`*. So (a) a Vite project needs both profiles from one build, yet the plan gives one `profile` option per plugin; (b) the client addon must run in the client environment and the server generator in SSR/server. Open Point 5 (client vs. server environment, `ssr` flag in `transform`) is the core use case for this lens, not an edge; promote it to "decide before approval" and specify the option shape (e.g. `profile: string | { client: string; ssr: string }`, or two plugin instances, documented). Also state whether the profile's `outDir` writes still happen in `vite build`/`vite dev` (the index generator depends on them).
3. **The seam should be decided in the plan, not by a tracer.** `TsCompiler` extends core `Compiler` but imports webpack (`WebpackError`, `LoaderContext`) at runtime (`TsCompiler.ts:23`), so "Vite depends on `@quatico/websmith-loader`" forces `webpack` on every Vite user. Only the core option is acceptable to a Vite user; building both to compare is wasted effort. Make the core extraction an explicit first slice (below).
4. **Inheriting the loader's per-module path inherits its known defects.** `loader-options-once` (#134) documents: options re-resolved twice per module at 150-300 ms each (`compiler-instances.ts:44`, `webpack-hooks.ts:163-182`), dependent profiles' TypeScript diagnostics dropped (`TsCompiler.ts:258-283`), config errors once per module. In `vite dev` the first would make every request slow and the second would hide errors for `depends` profiles. Either sequence this plan after #134 or state that the Vite per-module path is written against the corrected core behaviour.
5. **Failure behaviour is under-specified for the ESM check.** The loader hands `checkModuleKind` a webpack module type (`TsCompiler.ts:34-38`) and drops the missing-extension/directory rules where the bundler resolves them (`NODE_IMPORT_RULES`, `TsCompiler.ts:46`). Vite also resolves extensionless imports, but classification and which rules apply for Vite are not stated; an author with node16 profiles would otherwise get false errors on valid Vite code, or none on real ones. State the Vite mapping (kind `esm`, rule set) and that #137 `esm-check-precision` changes the same rules.
6. **`enforce: "pre"` returning JavaScript has JSX and tsconfig consequences.** For `.tsx`, websmith emits per the profile's `jsx` option; with anything but `preserve`, esbuild and `@vitejs/plugin-react` (Fast Refresh) never see JSX. Say what the plugin forces (`jsx: preserve`?) or documents. `isolatedModules`/`verbatimModuleSyntax` interplay with Vite's own tsconfig reading should be listed too.
7. **TS7.** The TS7 story records in-process per-file compile as impossible on 7.x (story L67, L112). A Vite `transform` hook is the same in-process shape, so the plan should say "TypeScript 5/6 only" and link the story, rather than leave the Vite author stuck on upgrade.

## Smaller points

- Options: the plan lists `addonsDir`/`addons`; confirm they exist in `WebpackLoaderOptions` and that the webpack `error`/`warn` callbacks are deliberately dropped. Add `include`/`exclude` precedence over `transpileOnly`. The ForkTsChecker default-`transpileOnly` heuristic (`loader-options.ts`) has no Vite analogue; say `transpileOnly` stays explicit.
- Config errors "once per build": use `buildStart` throw; in dev, re-throw on config change so the overlay clears when fixed.
- Open Point 3 (dev with Program): measure is right, but decide the default now: `vite dev` should default to `transpileOnly: true` for type-info-free profiles and document the fallback; addon authors need to know which addons lose type information in dev.

## Slices

- **Missing first slice:** `feature/vite-plugin-core-seam`, moving the bundler-neutral per-module build (`TsCompiler` minus webpack types) into `@quatico/websmith-core`, loader tests unchanged as the proof (must fail before: no core export). Without it the Tracer slice carries a package plus a refactor plus an e2e package and is too big.
- Tracer: then genuinely thin (plugin + one processor e2e). Fine.
- Diagnostics: good; add a test that a dependent profile's TS error fails the build (red today on the loader path).
- Dev server: OK after Tracer; HMR for config change is a separate failure path worth its own test.
- Addon outputs and profiles: too late and too vague. `addVirtualFile`/`removeOutputFile`/`addInputFile` mapping and the client/server environment split belong in a slice of their own, with a Magellan-shaped fixture (client transform + server generator) as the e2e.
- Release: fine.

## Overlap

- `loader-options-once` (#134): same `TsCompiler`/`compiler-instances` code; the core move conflicts with #134, #136 and #137 edits to `TsCompiler.ts`/loader. Order: #134 and #137 first, or the seam slice rebases on them.
- `esm-check-precision` (#137): rule set shared (item 5 above).
- TS7 story: same in-process constraint (item 7).
- Prior attempt `feature/60--plugin-for-vite`: reference only, as stated.

## Open points to decide before approval

1. Seam: core extraction (recommended, explicit slice). 2. Client/server mapping and option shape (item 2). 3. Vite context mapping of virtual/removed/input files (item 1). 4. Supported Vite majors: recommend 6 and 7 (Environment API), matrix deferred to a later plan. 5. `emitFile` vs disk: write to disk as the loader does, and `emitFile` only for `addVirtualFile`. 6. Ordering against #134/#137.

Verdict: amend
