<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# Vite plugin API and dev server internals

Executed: nothing built. Read: the plan (`origin/idea/vite-plugin`), `packages/webpack/src/{TsCompiler,loader,compiler-instances,result-handling,WebpackAddonContext}.ts` on `origin/develop`, the plan of #134, the ts7 story. Vite facts below are from my knowledge of the plugin API (Vite 5 to 7, Environment API since 6, Rolldown-based Vite 8), not re-checked on the web in this session; verify the two marked "verify" before approval.

## Findings that would change the plan

1. **The seam is not an open point, it is the first slice, and "depend on the loader" is not viable.** `TsCompiler` imports `LoaderContext`, `WebpackError` (`TsCompiler.ts:23`), takes a `LoaderContext` in its constructor (`:127`) and builds `WebpackAddonService`/`WebpackAddonContext` that hand addons the webpack `Compilation` (`:362-420`, `WebpackAddonContext.ts:20,49`). A Vite plugin depending on `@quatico/websmith-loader` drags webpack in as a peer. The only workable option is moving a bundler-neutral per-module compiler into core. The tracer "decides by building both ways" wastes a slice; decide now, and make the extraction its own slice before the tracer.
2. **The addon-facing context for Vite is undefined.** Addons currently receive a webpack-flavoured context. What does an addon see under Vite (no `Compilation`, `emitAsset`, `LoaderContext`)? Needs a decision and an API note in `packages/api`, or addons that touch the webpack context silently misbehave.
3. **No mapping of webpack's per-compilation lifecycle to Vite hooks.** The loader relies on `addCompilationHooks` (once-per-compilation config errors, `resetCompilationCaches`, `CompilationQueue`, `compiler-instances.ts:35-41`). Vite equivalents: `configResolved` (resolve options once), `buildStart` (reset caches, report config errors once, run generators/result processors), `buildEnd`/`closeBundle` (result processors after write), and in dev there is no compilation at all: `buildStart` runs once per server start, so caches that the loader resets per compilation (`packageTypeCache`, `scanCache`) need an explicit invalidation trigger in `handleHotUpdate`/`hotUpdate`. The plan states "once per build" but never says where. Add this table to Design.
4. **Generator output feedback loop in dev.** Generators and result processors write into the project (plan: "keep writing to the file system as with the loader"). Vite's watcher sees those writes, fires `handleHotUpdate`, which invalidates and retransforms the module, which runs the generator again. Webpack's watch has the same hazard but the plan adds `handleHotUpdate` invalidation, which makes it a loop by construction. Needs a guard (skip writes with identical content, or `server.watcher.unwatch`/ignore the written paths) and an e2e case (HMR edit produces exactly one rewrite).
5. **Do not use `handleHotUpdate` as the main mechanism.** Since Vite 6 the Environment-API hook is `hotUpdate` and `handleHotUpdate` is the legacy path (verify against current docs). Prefer `this.addWatchFile` from `transform` (dev registers the file in the module graph so importers invalidate) and use `hotUpdate`/`handleHotUpdate` only for the non-module inputs (`websmith.config.json`, addon directories, which are not in the graph). A config change should also clear the compiler instance and trigger a full reload, since no module accepts it.
6. **"esbuild then has nothing left to transform" is inaccurate.** `vite:esbuild` (Oxc in Vite 8) still runs on every `.ts` id after a `pre` plugin and re-parses the JS (it still applies `target`, JSX and `useDefineForClassFields` settings). Harmless, but the plan should say the output must be valid input for that transform: `.tsx` output keeps JSX only if the profile's `jsx` is `preserve`; otherwise esbuild's JSX settings must be a no-op. Pin this in the tracer e2e with a `.tsx` module.
7. **Module id handling.** Vite ids carry queries (`foo.ts?v=...`, `foo.vue?vue&type=script&lang.ts`, `?raw`, `?url`). The default `include` regex `/\.(c|m)?tsx?$/` fails on queries and would match Vue/Svelte virtual script modules wrongly. Use `createFilter` from `@rollup/pluginutils` on the cleaned id and say what happens for `?worker`, `?raw`, virtual ids (`\0`). Also the loader reads the file from disk by `resourcePath` (`loader.ts:25`, `TsCompiler.build`) and ignores the `code` argument; in Vite, an earlier `pre` plugin or an unsaved/virtual module gives different `code`. State that `code` is ignored (parity) or fed in.
8. **Environments and SSR (open point 5) should be answered, not deferred, at least as a rule.** `transform` runs per environment with `this.environment`; one shared compiler instance across `client` and `ssr` mixes results and caches. Key the instance by environment name and let `profile` be a function or a map `{ client: "browser", ssr: "node" }`. This also decides ESM-check `runtime`: the loader derives `moduleKind` from webpack's module type (`TsCompiler.ts:36-41`, `loader.ts:25`); Vite has none, so the client environment is `esm`/bundler and the ssr environment depends on `ssr.target`/`noExternal`. Without this the ESM check has nothing to classify with.
9. **Dependent profiles in dev.** `build` emits every dependent profile on every module transform (`TsCompiler.ts:251-266`). In dev, per-request transforms plus concurrent requests (Vite runs transforms in parallel; Rolldown interleaves async hooks) mean repeated writes of the same files and races. Keep `build` synchronous (it is) but dedupe by file version per profile, and say so in the Addon-outputs slice.
10. **`emitFile` open point: recommend "no".** `emitFile` is a no-op in dev, and generated files are not part of the module graph unless imported, so emitting them yields different dev/build behaviour. Decide "write to disk only" (loader parity) and reconsider on demand. Closes one open point.
11. **Supported majors:** recommend Vite 6 and 7 (Node >=20.19/22.12 matches the 0.10.0 baseline), tested with one e2e matrix leg; add 8 (Rolldown) as best-effort once it is stable, since hook filters and the Oxc transform differ. Use the `transform: { filter, handler }` object form from the start (supported by Vite 6.3+ and Rollup/Rolldown), it is also where Rolldown gets its speedup.
12. **Dev type-info cost.** The plan's fallback (`transpileOnly` in dev) changes semantics: addons needing types behave differently between dev and build. Prefer measuring first as planned, but accept only if documented as a warning at startup (`this.warn` in `buildStart`), not silently.
13. **Config errors in dev.** `this.error` in `buildStart` kills the dev server start; in dev prefer reporting through `server.config.logger` and keep serving, with the error overlay on the affected modules. Specify build vs. serve behaviour for configuration errors in the Diagnostics slice. `this.error` inside `transform` does show the overlay (checked by knowledge, not run).

## Problem

Real. Issue #60 is the stated problem; the prior attempt's defects (console, swallow-on-error) were not re-verified by me. The loader-based parts of the design match `TsCompiler.build` on develop as cited.

## Approach

Fits Vite's model at the plugin-factory level (`enforce: "pre"`, `transform`, `this.error/warn`, `addWatchFile`) and is correct that websmith must run before type stripping. The gaps are the lifecycle mapping (3), dev loop (4), HMR hook choice (5), ids/environments (7, 8). Riskier than stated: the "same per-file path as the loader" inherits the loader's per-module costs and bugs listed in #134.

## Slices

- **Missing slice 0: `core` extraction** (bundler-neutral per-module compiler, reporter/config-error collection, scan cache, addon context abstraction), as its own PR with the loader migrated onto it. Without it the Tracer is two things at once (a refactor of the webpack package plus a new package) and is too big.
- **Tracer:** after slice 0 it is right-sized; it should include `.tsx` and a query-id case (findings 6, 7).
- **Diagnostics:** fine; tests must fail before (a broken module currently has no plugin at all, so "fails before" holds trivially; add an assertion that errors are not swallowed, which is what the old attempt did wrong).
- **Dev server:** biggest risk, may be two PRs: (a) transform in `createServer` with watch files, (b) config/addon-dir invalidation plus the write-loop guard. HMR e2e needs a deterministic wait on the HMR payload, not sleeps.
- **Addon outputs and profiles:** ordering is right; add environment mapping here or in its own slice if SSR is in scope.
- **Release:** fine; `packages/vite-test` should be wired into `pnpm test:e2e` in the Tracer, not here, or CI will not run it until the end.

## Overlap

- **#134 loader-options-once:** it rewrites `getCompilerInstance`, `updateLoaderConfig`, `build`'s diagnostics and `webpack-hooks.ts` (the same code the seam extraction touches), and fixes bugs 5 and 7 and 1 that the Vite plugin would inherit. Slice 0 should land after #134's first slice, or be done in it; otherwise two plans edit `TsCompiler.ts` concurrently. Options resolution once per build (`configResolved`) is the same concept; reuse its result, do not re-implement.
- **#136 cli-error-exit-gaps / #135 tsc-option-parity:** not read in depth; any option-resolution change lands in core, so the Vite plugin gets it for free via the seam.
- **ts7 story:** no direct duplication. Dependency: custom `before` transformers are missing in TS 7 (story Phase 1), so the Vite plugin inherits whatever the story decides; the new package must not add TypeScript-API coupling beyond `Compiler` in core. Also the core extraction (slice 0) touches the files the story's slices will rewrite; note the ordering.

## Open points to decide before approval

1. The seam: decide "core extraction first, separate slice" (finding 1).
2. Addon context under Vite (finding 2).
3. Supported majors: Vite 6 and 7 required, 8 best-effort (finding 11).
4. `emitFile`: no (finding 10).
5. Environments/SSR: at least the rule "one instance per environment, profile per environment name" and the ESM `runtime` source (finding 8); full SSR e2e can follow.
6. Dev write-loop policy (finding 4) and HMR hook choice (finding 5).

Verdict: amend
