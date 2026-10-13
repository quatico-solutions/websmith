<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# Websmith plugin for Vite

> A `@quatico/websmith-vite` package runs websmith addons in `vite build` and `vite dev`, with the webpack loader's profiles, diagnostics and failure semantics.

## Status

- **State:** Approved
- **Type:** feature
- **Issue:** #60
- **Review:** pr
- **Impl:** own branches
- **Rounds:** 1
- **Approved:** 2026-10-02, Jan Wloka, plan-PR #132 merged
- **Started:** 2026-10-03, Jan Wloka, `feature/neutral-module-compiler`
<!-- Transition records — written by the workflow commands, not by hand:
- **Approved:** <date>, <who>, <channel>
- **Started:** <date>, <who>, <branch>   (one line per started branch)
-->

## Changelog

- New package `@quatico/websmith-vite`: a Vite plugin (Vite 6 and 7; Vite 8 best-effort) that compiles `.ts`,
  `.tsx`, `.mts` and `.cts` modules with websmith, so generators, processors, transformers and result processors run
  in `vite build` and in the Vite dev server. It takes the webpack loader's options (`configFile`, `profile`,
  `transpileOnly`, …), selects a profile per Vite environment (e.g. `client` and `ssr`), reports TypeScript, ESM
  check, configuration and addon errors through Vite, fails `vite build` on any error, and reloads changed modules in
  the dev server. Requires TypeScript 5.x or 6.x.

## Motivation

Issue #60 asks for websmith in Vite projects. Today websmith runs as a `tsc` drop-in CLI and as a webpack loader;
projects that build with Vite cannot use their addons (e.g. Magellan's client/server function transforms) without
a separate `websmith` step before Vite. A Vite plugin puts the addon pipeline where those projects already compile,
with Vite's dev server and HMR.

A first attempt exists on `feature/60--plugin-for-vite` (2025-07, `packages/vite-plugin`), with a skeleton on
`vite` (2025-03). It predates profiles, the Node 22.12 baseline and the ESM check, imports
`@quatico/websmith-core` types from the webpack loader, logs with `console`, and on any error returns the source
unchanged, which would let a broken build pass. Its `compiler-adapter.ts` is a placeholder that returns a fixed
string. This plan writes the package fresh off `develop` and keeps only the attempt's file layout and config example.

## Design

### Approach

- **Package:** `packages/vite`, published as `@quatico/websmith-vite`, default export `websmith(options)` returning
  a Vite `Plugin`. Peer dependencies `vite` (`^6.3.0 || ^7.0.0`) and `typescript` (5.x/6.x, as the loader). MIT
  headers, `AGENTS.md` rules (no `console`, report through the reporter). It depends on `@quatico/websmith-core` and
  `@quatico/websmith-api` only, never on `websmith-loader` (the webpack loader package, which loads `webpack` at
  runtime: `TsCompiler.ts` value-imports `WebpackError`, `WebpackAddonContext.ts` imports `sources`).
- **The seam (decided):** a bundler-neutral per-module compiler moves into `@quatico/websmith-core` as this plan's
  first slice, `feature/neutral-module-compiler`; the webpack loader becomes one thin host of it, the Vite plugin the
  second. The extraction changes no loader behaviour; the existing webpack unit tests and `packages/webpack-test`
  are its guard. It lands after #134's `bug/loader-resolve-options-once` slice and reuses that slice's
  once-per-compilation option resolution instead of re-implementing it.
- **Neutral contract:** `ModuleCompiler.build(file, { moduleKind }) → { fragment, diagnostics, dependencies }`
  (`fragment`: JavaScript and source map; `diagnostics`: `ts.Diagnostic[]` including dependent profiles and addon
  failures; `dependencies`: files the module, its rules and its addons read), plus `getConfigErrors()` and
  `runResultProcessors(files)`. Diagnostics are data; each host renders them (`emitError`/`emitWarning` in the
  loader, `this.error`/`this.warn` or the dev-server logger in Vite). Addons reach the compiler through a host-supplied
  `AddonContext` factory.
- **Registry:** the Vite host loads addons with the core `AddonRegistry` (the CLI's path); the loader keeps
  `WebpackAddonService` behind the same factory. See Open Points.
- **Options:** the loader's `WebpackLoaderOptions` minus webpack specifics: `configFile` (default
  `./websmith.config.json`), `config`, `tsConfigFile`, `tsConfig`, `profiles`, `debug`, `transpileOnly`,
  `addonEmitOnly`; `addonsDir` and `addons` come from the config file, as for the loader. `profile` is
  `string | Record<string, string>` (environment name → profile). `instanceName` and the loader's `error`/`warn`
  callbacks are dropped (instances are keyed by environment; diagnostics go through Vite). `transpileOnly` stays
  explicit: the loader's ForkTsChecker heuristic has no Vite analogue. Plus Vite's `include`/`exclude`, which decide
  whether a module is compiled at all, before `transpileOnly` applies.
- **Module ids:** `createFilter(include, exclude)` (default include `/\.(c|m)?tsx?$/`, `node_modules` excluded) on
  the id without its query. Compiled are ids with no query; skipped are `\0` virtual ids and every query id (`?raw`,
  `?url`, `?worker`, `?inline`, `?vue&type=script…`). The `code` argument is ignored and the file is read from disk,
  as the loader does: the compiler's Program reads the module's imports from disk too, so feeding one module's `code`
  would make it disagree with its own type information. The README says websmith must be the first `pre` plugin for
  TypeScript files.
- **Pipeline position and output:** `enforce: "pre"`, `transform` in the `{ filter, handler }` object form, so
  websmith sees TypeScript before Vite strips types. The plugin returns JavaScript and a source map; `vite:esbuild`
  (Oxc in Vite 8) still runs on the result and applies `target`, JSX and `useDefineForClassFields`, so the output must
  be valid input for it. For `.tsx` the plugin compiles with `jsx: "preserve"`, so Vite's JSX settings and React Fast
  Refresh work as without websmith (the override applies only to the fragment returned to Vite, not to files
  dependent profiles write). A profile whose effective `module` emits CommonJS, AMD, UMD or System is a configuration
  error for that environment, not CommonJS handed to Rollup.
- **Environments:** one compiler instance per Vite environment (`this.environment.name`), never shared between
  `client` and `ssr`. A string `profile` applies to every environment; with a map, an environment the map does not
  name is a configuration error, reported once. Magellan maps `{ client: "client", ssr: "server" }` from one build.
  Profiles' `outDir` writes (generators, result processors, dependent profiles) happen in `vite build` and `vite dev`
  as with the loader; Magellan's client index generator relies on them.
- **ESM check:** the Vite host passes `moduleKind: "esm"` for every module it compiles, in every environment: Vite
  resolves every module the plugin sees (externalised dependencies are in `node_modules` and never reach the
  plugin). It runs the rule set the loader runs under `runtime: "bundler"`, as #137 (`esm-check-precision`) leaves
  it: query and fragment stripped, extension and directory rules lenient. The Vite e2e gets a case per rule #137
  changes in the loader.
- **Diagnostics and failure:** TypeScript and ESM check errors of the module and its dependent profiles through
  `this.error` (fails `vite build`, overlay in dev), warnings through `this.warn`. An addon that throws is an error
  diagnostic and fails `vite build` and shows the overlay in dev; the loader keeps downgrading addon throws to
  warnings (`TsCompiler.ts`, "Don't break webpack builds due to addon errors"), a stated divergence (see Open Points).
  Configuration errors: in `vite build`, `this.error` in `buildStart`; in `vite dev`, the dev-server logger at
  `buildStart` (the server keeps starting) plus `this.error` in `transform` of every module of the affected
  environment, so the overlay shows them and clears once the config is fixed. Nothing is printed with `console`;
  nothing is swallowed.
- **Lifecycle (once per build):**

  | Vite hook | `vite build` | `vite dev` |
  |-----------|--------------|------------|
  | `configResolved` | resolve options once per environment (#134's resolve-once function) | same, once per server start |
  | `buildStart` | reset per-build caches (package type, scan caches), activate addons, report configuration errors | once per server start: same, errors to the logger |
  | `transform` | `build()` per module; generators run per emitted module (core `Compiler.emitSourceFile`, as in CLI and loader); `addWatchFile` for `dependencies` | same, per request |
  | `generateBundle` | `addVirtualFile` → `emitFile`, `removeOutputFile` → delete from bundle | — |
  | `buildEnd` | result processors once per environment, over the files the build emitted | — |
  | `hotUpdate` | — | non-module inputs only (see Dev server) |

  In dev there is no end of build: result processors run after each transform for that module's files, which keeps
  generated indexes current. The loader's own-profile result processor branch (`TsCompiler.ts`,
  `result.files.length > 0` fed an empty fragment) stays as it is in the extraction; aligning the loader is a
  follow-up issue, not this plan.
- **Addon context under Vite:** a `ViteAddonContext` implements `AddonContext`; the API note lands in
  `packages/api` (`AddonContext` docs) and `packages/vite/README.md`.

  | `AddonContext` method | Webpack loader | Vite |
  |-----------------------|----------------|------|
  | `addInputFile` | `loaderContext.addDependency` | `this.addWatchFile` |
  | `addAssetDependency` | `loaderContext.addDependency` (child) | `this.addWatchFile` (child) |
  | `addVirtualFile` | `compilation.emitAsset` | build: `emitFile` asset; dev: kept in memory, served by a dev-server middleware at its output path |
  | `removeOutputFile` | asset removed | build: deleted from the bundle in `generateBundle`; dev: dropped from the in-memory set |
  | `getReporter`, `getSystem`, `registerGenerator`/`Processor`/`Transformer`/`ResultProcessor` | unchanged | unchanged |

  A method the Vite host cannot honour reports an error diagnostic naming the method and the addon; none is a
  silent no-op.
- **Files addons write:** written to disk only, as with the loader. `emitFile` is used for `addVirtualFile` and
  nothing else (it is a no-op in dev, and generated files are not in the module graph unless imported).
- **Dev server and HMR:** dependencies register through `this.addWatchFile` in `transform`, so importers invalidate
  through Vite's module graph. `hotUpdate` handles only non-module inputs: `websmith.config.json`, the profile's
  `tsconfig.json`, the addons directory; a change drops the environment's compiler instance, re-resolves options,
  re-reports configuration errors and sends a full reload. Write-loop guard: the plugin records the paths and content
  hashes it wrote in the current change cycle, skips writes with identical content, and returns no modules from
  `hotUpdate` for its own writes. Dependent-profile writes are deduplicated per file version and profile; `build()`
  stays synchronous.
- **Dev with type information:** `vite dev` uses the same profile as `vite build`; there is no automatic fallback to
  `transpileOnly`. The Dev server slice measures per-request cost with a type-info addon; if a user sets
  `transpileOnly` for dev, `buildStart` warns once and names the active addons that lose type information.
- **Ordering with sibling plans:** after #134's `bug/loader-resolve-options-once`. #136 (`cli-error-exit-gaps`)
  and #137 (`esm-check-precision`) are neither waited for nor absorbed: whichever of their slices lands first, the
  other side rebases; slices landing after the extraction edit the moved code in core. `-p <directory>` and CLI exit
  codes are #136's.
- **TypeScript:** 5.x and 6.x only. The Vite host is in-process and per-module, which the TypeScript 7 story
  (`docs/stories/ts7-rearchitecture`) records as impossible on 7.x; TypeScript 7 is out of scope as in #144
  (`typescript-6-support`). The plugin adds no TypeScript-API coupling beyond `Compiler` in core.
- **Tests:** unit tests next to each changed or new module (assemble/act/assert, `testObj`/`actual`); e2e in a new
  `packages/vite-test` mirroring `webpack-test`, wired into `pnpm test:e2e` from the Tracer on. It runs against
  Vite 7 and, for the build cases, against Vite 6 through a `vite6` alias dependency, so CI needs no matrix. Dev
  e2e waits on the HMR payload, never on sleeps.

### Open Points

- [x] **The seam.** — decided: core extraction as the first slice `feature/neutral-module-compiler`, after #134's
      `bug/loader-resolve-options-once`; "depend on `websmith-loader`" is dropped, pending approval. Reason: the loader
      loads `webpack` at runtime, so depending on it puts webpack into every Vite project; reading decides this, a
      tracer need not build both.
- [x] **Which registry.** — decided: core `AddonRegistry` for Vite, `WebpackAddonService` stays in the loader behind
      the neutral context factory, pending approval. Reason: `WebpackAddonService` exists to isolate addon
      compilation from webpack's TypeScript pass and is bound to `LoaderContext`/`Compilation`; the core registry is
      the CLI's and has no bundler ties. Unifying the loader on it would change loader behaviour inside a
      no-behaviour-change slice.
- [x] **Addon throws.** — decided: they fail `vite build`; the loader keeps its warning, a stated divergence,
      pending approval. Reason: "nothing is swallowed" is the point of this plan, while turning loader warnings into
      errors breaks webpack builds that pass today and belongs in its own loader issue with a release note.
- [x] **Configuration errors in dev.** — decided: build → `this.error` in `buildStart`; dev → logger at `buildStart`
      plus `this.error` per affected module, pending approval. Reason: `this.error` in `buildStart` stops the dev
      server, so a typo in `websmith.config.json` would need a restart; per-module errors show the overlay and clear
      on the config-change reload.
- [x] **Supported Vite majors.** — decided: Vite 6.3+ and 7 required, 8 (Rolldown) best-effort; e2e on 7 plus the
      build cases on 6 via an alias, no CI matrix, pending approval. Reason: 6.3 is the first with the Environment
      API and the `transform` filter form, both match the Node 20.19/22.12 baseline; Rolldown's hook and Oxc
      differences are not stable enough to gate CI. The Tracer verifies the hook names (`hotUpdate`, filter form)
      against the current Vite docs.
- [x] **`vite dev` with type information.** — decided: dev uses the build's profile, no automatic `transpileOnly`;
      an explicit `transpileOnly` in dev warns at startup naming the affected addons, pending approval. Reason: all
      three jurors reject a silent dev/build difference; the Dev server slice measures cost and records it in the
      PR, and only a measured problem reopens the default.
- [x] **Files generated by addons in `vite build`.** — decided: disk only (loader parity); `emitFile` only for
      `addVirtualFile`, pending approval. Reason: `emitFile` is a no-op in dev, so emitting generated files would make
      dev and build differ; `addVirtualFile` is the API that means "into the bundle", as `emitAsset` does in webpack.
- [x] **SSR builds and environments.** — decided: one compiler instance per environment, `profile` as string or
      environment-name map, unnamed environment is a configuration error, ESM `moduleKind` `esm` with the bundler
      rule set in every environment, pending approval. Reason: Magellan needs `client` and `server` profiles from one
      build; a shared instance would mix both profiles' caches and results.
- [x] **Per-module or Program-level compile in `vite build`.** — decided: per-module in build and dev for this
      plan, pending approval. Reason: one code path for both modes and for both hosts; a Program compile per profile
      in `buildStart` (the CLI's shape) may be faster in build but is unproven for dev; the Tracer records build
      timings so a later plan can compare.

## Slices

### Neutral module compiler

- `feature/neutral-module-compiler` — bundler-neutral `ModuleCompiler` in `@quatico/websmith-core` (`build(file, { moduleKind })` → `{ fragment, diagnostics, dependencies }`, `getConfigErrors()`, `runResultProcessors(files)`, host-supplied `AddonContext` factory), `TsCompiler` reduced to a webpack host of it, no loader behaviour change; lands after #134's `bug/loader-resolve-options-once`; unit tests in core for the contract (must fail before: no core export), existing webpack unit tests and `packages/webpack-test` green unchanged as the guard → #174 <!-- builds: bundler-neutral ModuleCompiler in websmith-core, websmith-loader as its webpack host -->
  Layers: core module compiler → webpack loader host
  Proves: the per-module compile runs without webpack and the loader behaves as before

### Tracer

- `feature/vite-plugin-tracer` — `packages/vite` with `websmith()`, a `pre` `transform` (`{ filter, handler }`, `createFilter`, query and `\0` ids skipped) that compiles one module through `ModuleCompiler` with `configFile` and `profile`, `.tsx` compiled with `jsx: "preserve"`, addons from the core `AddonRegistry`; `packages/vite-test` wired into `pnpm test:e2e`; unit tests for id filtering and option mapping; e2e: `vite build` shows a processor addon's change in the bundle, a `.tsx` module, a `?raw` import left untouched, the build case also on Vite 6 <!-- builds: websmith() Vite plugin factory, packages/vite-test in test:e2e -->
  Layers: Vite plugin → neutral module compiler → addons → bundle
  Proves: websmith addons run inside `vite build`

### Diagnostics

- `feature/vite-plugin-diagnostics` — TypeScript and ESM check diagnostics (module and dependent profiles) through `this.error`/`this.warn`, ESM `moduleKind` `esm` with the loader's bundler rule set after #137, addon throws as errors, configuration errors once in `buildStart`, CommonJS-emitting profile as a configuration error, no `console`; unit tests for the diagnostic mapping; e2e: a TS error fails `vite build`, a dependent profile's TS error fails it, a throwing addon fails it (not swallowed), a broken profile reported once, an ESM finding, a `module: commonjs` profile rejected <!-- builds: Vite diagnostic reporting for websmith -->

### Addon outputs and context

- `feature/vite-plugin-addon-outputs` — `ViteAddonContext` with the mapping table (`addInputFile`, `addAssetDependency` → `addWatchFile`; `addVirtualFile` → `emitFile`; `removeOutputFile` → bundle deletion; unsupported calls as error diagnostics), result processors once per environment in `buildEnd`, dependent profiles via `depends` with writes deduplicated per file version, generated files on disk only; API note in `packages/api`; unit tests for each mapped method; e2e: a generator, a result processor run once, a dependent profile, an `addVirtualFile` asset in the bundle <!-- builds: ViteAddonContext and addon outputs in Vite builds -->

### Environments

- `feature/vite-plugin-environments` — one compiler instance per Vite environment, `profile` as string or environment-name map, unnamed environment as a configuration error; unit tests for instance keying and profile selection; e2e: a Magellan-shaped fixture (client transform profile, server generator profile) in a `vite build` with an SSR environment, each addon running only in its environment <!-- builds: per-environment compiler instances and profile map -->

### Dev server

- `feature/vite-plugin-dev-server` — modules compile through the plugin in `createServer`, dependencies via `addWatchFile` from `transform`, configuration errors to the logger plus per-module overlay, `addVirtualFile` served from memory, result processors after each transform, a startup warning when `transpileOnly` drops type information; per-request cost of a type-info addon measured and recorded in the PR; unit tests; e2e: dev server serves a transformed module, an edit to an imported file reloads its importer, a broken config shows the overlay without stopping the server <!-- builds: websmith compile in the Vite dev server -->

### Dev invalidation

- `feature/vite-plugin-dev-invalidation` — `hotUpdate` for `websmith.config.json`, `tsconfig.json` and the addons directory (instance dropped, options re-resolved, full reload), per-build caches invalidated on `package.json` change, write-loop guard (identical content skipped, own writes ignored in `hotUpdate`); unit tests for the guard; e2e: a config edit reloads and clears the overlay once fixed, an HMR edit with a generator produces exactly one rewrite and one HMR update <!-- builds: websmith config invalidation and write-loop guard for Vite -->

### Release

- `docs/vite-plugin-release` — `packages/vite/README.md` (options, environments, addon-context table, TypeScript 5/6, first `pre` plugin), root `README.md` mention, `Release-Notes.md` entry under `## [Unreleased]`, publish configuration for `@quatico/websmith-vite` checked against the npm trusted-publishing workflow from 0.10.0, and the example from issue #60 as a working fixture in `packages/vite-test` <!-- builds: @quatico/websmith-vite package docs and publish config -->

## Notes

- Created 2026-10-01 from issue #60 during the session that delivered `esm-output-check`. Decided in-session: Type
  `feature`, plan PR review, implementation on own branches, first delivery covers build and dev server, prior
  attempt used as reference only.
- One branch per `###` heading, so each heading is one slice the fleet can dispatch on its own; headings run in
  order.
- Amended after the draft panel (2026-10-02, `.plot/panels/2026-10-01-vite-plugin/`, unanimous amend):
  - the seam decided (core extraction) and split into its own first slice `feature/neutral-module-compiler`, after
    #134's resolve-once slice; the loader package name corrected to `websmith-loader`;
  - neutral contract (`build(file, { moduleKind })`, `getConfigErrors`, `runResultProcessors`) and registry (core
    `AddonRegistry` for Vite) named;
  - `ViteAddonContext` mapping table and API note added; new slice "Addon outputs and context" absorbs it;
  - lifecycle table defining "once per build" for build and dev; addon throws fail the Vite build (stated loader
    divergence);
  - environments: instance per environment, `profile` map, ESM `moduleKind`/rule set per #137, CommonJS-output guard,
    `jsx: "preserve"` for `.tsx`; new slice "Environments" with a Magellan-shaped fixture;
  - dev-server rules: `addWatchFile` from `transform`, `hotUpdate` only for non-module inputs, write-loop guard with
    e2e, `createFilter` and query/virtual-id handling, `code` ignored, configuration errors per mode, dev type-info
    policy with a startup warning; the Dev server slice split into "Dev server" and "Dev invalidation";
  - open points closed: `emitFile` disk only (except `addVirtualFile`), Vite 6.3+/7 required and 8 best-effort,
    TypeScript 5/6 only, per-module compile kept (the panel's blind spot recorded as a decision);
  - options corrected to `WebpackLoaderOptions` (`addonsDir`/`addons` come from the config file); `packages/vite-test`
    wired into `pnpm test:e2e` in the Tracer; publish configuration checked against trusted publishing.
