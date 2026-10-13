<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — vite-plugin (slice: Tracer)

- **Plan (canonical):** `docs/plans/2026-10-01-vite-plugin.md` on `develop`
- **Approved:** 2026-10-02, Jan Wloka, plan-PR #132 merged
- **Branch:** `feature/vite-plugin-tracer` (base: `develop`, at `ef29dce6` when this brief was written)
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh` (on PATH). Do not merge it yourself.
- **Review of the code:** an independent review, plus uncached gates run by the maintainer's session before merge

**Ordering.** This is the plan's second slice. `## Slices` runs one branch per `###` heading, in heading order (plan
Notes: "headings run in order"), and no slice line carries a `<!-- waits: -->`. The first heading, "Neutral module
compiler", merged today as #174 (`ef29dce6`). The next heading is "Tracer", so this branch is next. The six
headings after it (Diagnostics, Addon outputs and context, Environments, Dev server, then Dev invalidation and
Release) all build on the `packages/vite` and `packages/vite-test` this branch creates, so nothing else in this plan
can start before it merges.

Line numbers below are from `develop` at `ef29dce6`. The plan cites almost no lines. If they move, find the code by
name.

### What changed on `develop` since the plan was approved

- **#174 `ModuleCompiler`** (`packages/core/src/compiler/ModuleCompiler.ts`, exported from
  `packages/core/src/compiler/index.ts:13-14`). This slice builds on it, and its contract is as the plan describes:
  - `build(file, { moduleKind })` (`:286-354`) returns `{ fragment, diagnostics, dependencies }`;
  - `getConfigErrors()` (`:186-189`) and `runResultProcessors(files)` (`:360-371`);
  - `keepCachesPerCompilation()` (`:259-261`) and `resetCompilationCaches()` (`:267-271`);
  - the host hooks `prepareAddons()` (`:386-388`, called on every build at `:332`) and `applyAddons()`
    (`:377-379`).

  Without an `applyAddons` override, the addons come from the `AddonRegistry` passed as `ModuleCompilerHost.addons`
  (`:38-45`). That is the CLI's path and the one this slice uses. The Vite host overrides none of the hooks.
- **#177** turned the top-level `profiles` option into an error, `'profiles' is not a loader option; use
  'config.profiles'.` (`packages/core/src/compiler/options/ResolvedCompilerOptions.ts:185`). It also removed
  `profiles` from `WebpackLoaderOptions` (`packages/api/src/options/WebpackLoaderOptions.ts:9-26` and
  `BaseOptions.ts`). The plan's Options bullet still lists `profiles`, but that is stale: **the Vite options have no
  `profiles`.** #177 also converts string enum values in the `tsConfig` loader option (`"ESNext"`, `"react-jsx"`).
  The Vite plugin gets this for free, because it passes `tsConfig` through to core.
- **#171** added an advisory `dist (24, typescript 6.0.3)` cell to `.github/workflows/pull-request.yml`. Its
  "assert typescript version" step (`:54-72`) runs `pnpm -r exec node -p "require('typescript/package.json').version"`
  in **every** workspace package (`:61`). So the two new packages must resolve `typescript`. Give each one the same
  `typescript` devDependency pin as `packages/webpack` (`5.7.3` today).
- **#143** (trusted publishing): `.github/workflows/release-and-publish.yml:86-87` packs every `packages/*` whose
  `package.json` does not say `"private": true`, and `:93` publishes it. A new public `@quatico/websmith-vite` would be
  published, half-built, at the next release, and the first publish of a package without a configured trusted
  publisher fails that job. See Settled decisions: both new packages are `private`.
- Nothing open collides by file except the two Dependabot PRs (see Scope guard).

### What to build

**The problem.** No Vite integration exists. The tracer proves the whole path once: Vite plugin → `ModuleCompiler` →
core `AddonRegistry` addons → the bundle. It must work with `vite build` on Vite 7 and on Vite 6.

**1. Core seam: target-only compiler options** (needed for `jsx: "preserve"`, verified while writing this brief).

The plan requires `.tsx` to be compiled with `jsx: "preserve"`, so that Vite's own JSX handling applies. That
override must apply "only to the fragment returned to Vite, not to files dependent profiles write" (Design →
"Pipeline position and output"). Option resolution cannot express that today. Both of these were run against
`develop`'s built core, with a real temp project, a real `AddonRegistry` and the loader options
`{ configFile, profile, transpileOnly: true }`:

- With `cliArgs.options.jsx = Preserve` passed instance-wide, the `.tsx` target emits `v.jsx` with JSX kept. But a
  profile whose own `tsConfig` says `"jsx": "react-jsx"` wins: the fragment comes out as `_jsx(...)` with a
  `react/jsx-runtime` import. The reason is that `getTsConfig` deep-merges the profile's `tsConfig` over the base
  (`ResolvedCompilerOptions.ts:364`), and `createCompilationContext` spreads the profile's options over the CLI
  options (`Compiler.ts:422-436`). An instance-wide override also reaches every dependent profile.
- With an override applied to the target profile's context only (prototyped by patching `createCompilationContext`
  in `lib`, then reverted), a target profile `app` with `"jsx": "react-jsx"` that `depends` on `dep` gives the
  target fragment `v.jsx` with JSX preserved, while `dep` still writes `v.js` compiled with `react/jsx-runtime`.

Build it so:

- `Compiler.createCompilationContext(profile)` (`packages/core/src/compiler/Compiler.ts:412-455`) merges an
  overridable `protected` hook into both option sets the context uses. These are `normalizedCliArgs.options`
  (`:438-441`, which `ctx.getCompilerOptions()` returns: fast path, `transpileModule`, per-file Programs) and the
  `tsConfig` passed at `:444` (the language service's `getCompilationSettings`, `CompilationContext.ts:490`). For
  example, `protected getContextCompilerOptions(_profile?: string): ts.CompilerOptions { return {}; }`. The CLI and
  the loader leave it at `{}`, so they do not change.
- `ModuleCompilerHost` (`ModuleCompiler.ts:38-45`) gets an optional `targetCompilerOptions?: ts.CompilerOptions`,
  documented as "applies to the host's profile only, i.e. the fragment `build` returns". `ModuleCompiler` overrides the
  hook to return it when `profile === this.profile`, and `{}` otherwise. The default context (no profile) counts as
  the host's profile when `this.profile` is `undefined`.
- **Store it before `super.createProfileContextsIfNecessary()` at `:168`**, next to `this.debugSink = debug`
  (`:163`). The contexts are created inside the constructor, and a subclass field is not initialised yet at that
  point (#174 PR, judgement call 3).

The Vite host passes `{ jsx: ts.JsxEmit.Preserve, sourceMap: true, inlineSourceMap: false }`. `sourceMap` is there
because the plan says "the plugin returns JavaScript and a source map". The spike emitted no `.map` without it.
`jsx` has no effect on `.ts` files, so one override per instance covers `.tsx` exactly. Name the hook as you see fit,
but keep it in `createCompilationContext`, the single place both option sets are built.

**2. `packages/vite` → `@quatico/websmith-vite`.** Mirror `packages/webpack`. Write it fresh. Copy nothing from the
prototypes (see "Earlier branches").

- `package.json`: copy `packages/webpack/package.json` (version `0.10.0`, `author`, `license`, `engines.node
  ">=22.12"`, `repository`, `bugs`, `homepage`, `files: ["README.md", "lib"]`, and the scripts `clean`, `lint`,
  `lint:fix`, `build`, `typecheck`, `watch`, `watch:test`, `test`, `dist`). Then change:
  - `"name": "@quatico/websmith-vite"`, a description, and **`"private": true`** (Settled decisions);
  - no `test:e2e` script, since the package has no `*.test.ts`;
  - `lint` and `lint:fix` globs also take `.mts`, e.g. `"{src,tests}/**/*.{js,ts,tsx,mts}"`;
  - `dependencies`: `@quatico/websmith-api` and `@quatico/websmith-core` (`workspace:*`) only. Never `websmith-loader`
    (plan Approach);
  - `peerDependencies`: `"vite": "^6.3.0 || ^7.0.0"` (plan Approach and Open Point "Supported Vite majors") and
    `"typescript": ">=5.7 <7"`. The plan says "5.x/6.x, as the loader", but the loader declares no `typescript` peer.
    `>=5.7 <7` is the range the TypeScript 6 plan decided (`docs/plans/2026-10-02-typescript-6-support.md:108`), and
    its `feature/typescript-6-peer-range` slice does not list this package;
  - `devDependencies`: webpack's lint/test/TypeScript set without `@types/webpack`, `webpack` and `webpack-cli`, plus
    `"vite": "^7.3.0"`;
  - `main: "lib/index.js"`, `types: "lib/index.d.ts"`, plus an `exports` map (see "Module format" below).
- `tsconfig.json`, `tsconfig.lint.json`, `tsconfig.test.json`, `jest.config.ts` and `.prettierrc`: copies of
  `packages/webpack`'s, with `module: "CommonJS"`, `rootDir: "./src"` and `outDir: "./lib"`. Also include
  `src/**/*.mts` in `tsconfig.json`. `jest.config.ts` keeps the `moduleNameMapper` for `@quatico/websmith-api` and
  `@quatico/websmith-core` → `../api/src`, `../core/src`.
- **Module format (verified).** Every package here is CommonJS. A Vite config is ESM and imports the plugin natively:
  Vite bundles `vite.config.ts` but keeps bare imports external. Node gives an ESM default import of a CommonJS module
  `module.exports`. So `export default websmith`, compiled to `exports.default = websmith`, gives `typeof d ===
  "object"` on Node 22.17 and 24.21 (checked), and `websmith()` throws in the user's config. The plan wants a default
  export, so add an ESM entry:
  - `src/index.ts`: `export { websmith as default, websmith, type WebsmithViteOptions } from "./plugin";`;
  - `src/index.mts`: `import { websmith } from "./plugin.js"; export default websmith; export { websmith }; export
    type { WebsmithViteOptions } from "./plugin.js";`. tsc emits `.mts` as ESM even under `module: "CommonJS"`
    (`lib/index.mjs`, `lib/index.d.mts`). Checked with TypeScript 5.7.3: the default and named imports from ESM are
    both the function, and `require()` still gives `{ default, websmith }`;
  - `"exports": { ".": { "import": { "types": "./lib/index.d.mts", "default": "./lib/index.mjs" }, "require": {
    "types": "./lib/index.d.ts", "default": "./lib/index.js" } }, "./package.json": "./package.json" }`.

  `license-config.json`'s ignore glob skips `.mts`, so write the MIT header into `index.mts` by hand.
- **Runtime import of `vite`.** Vite 7 ships ESM only (`"exports": { ".": "./dist/node/index.js" }`). Node 22.12+
  loads it from CommonJS through `require(esm)`, without a warning on 22.17 (checked with a plain ESM file). Jest 29
  cannot: its module registry runs the file as CommonJS and fails on `import`. So keep the one runtime import,
  `createFilter` from `vite`, in `src/plugin.ts`. Every module a spec imports may import `vite` with `import type`
  only. The ESLint rule `consistent-type-imports` (`eslint.config.js`) already pushes in that direction.

Files (each with the MIT header; `pnpm license:add` covers `.ts`):

- `src/options.ts`: the plugin options and their mapping to `ModuleCompiler`'s constructor arguments. The type is
  `WebsmithViteOptions = Pick<WebpackLoaderOptions, "configFile" | "config" | "tsConfigFile" | "tsConfig" | "debug" |
  "transpileOnly" | "addonEmitOnly"> & { profile?: string; include?: FilterPattern; exclude?: FilterPattern }`
  (`FilterPattern` as a type import from `vite`). It has no `profiles` (#177), no `instanceName`, and no
  `error`/`warn` callbacks (plan Approach). `profile` is a string in this slice; the environment-name map belongs to
  Environments. The mapping, a pure function of the options and Vite's `config.root`:
  - `configFile` defaults to `<root>/websmith.config.json`. A relative `configFile` or `tsConfigFile` is resolved
    against `root`, not against `cwd`. Core resolves relative paths with `system.resolvePath`, i.e. against `cwd`
    (`resolvePathsWithRules`, `ResolvedCompilerOptions.ts:44-87`; `loadCompilationConfig` `:440-458`). Leave `tsConfigFile` unset when it is not
    given: core then takes the `tsconfig.json` next to the config file;
  - `config`, `tsConfig`, `debug`, `transpileOnly`, `addonEmitOnly` and `profile` pass through unchanged. Do not
    check whether files exist: a missing config file is a configuration error (`resolveCompilationConfig`), and the
    Diagnostics slice reports those;
  - `include`/`exclude` never reach the compiler. `include` defaults to `/\.(c|m)?tsx?$/` and `exclude` to
    `/node_modules/` (plan "Module ids").
- `src/module-ids.ts`: a pure predicate `isCompiledId(id, filter)`. It is false for ids starting with `\0` and for
  every id with a query (`?raw`, `?url`, `?worker`, `?inline`, `?vue&type=script…`). Otherwise it returns
  `filter(id)`. Taking the filter as a parameter keeps `vite` out of the spec.
- `src/plugin.ts`: `websmith(options: WebsmithViteOptions = {}): Plugin`, with `name: "websmith"` and
  `enforce: "pre"`:
  - `configResolved(config)` stores the mapped options and `createFilter(include, exclude)`;
  - `buildStart()` creates the `ModuleCompiler` once if there is none yet:
    `new ModuleCompiler({ reporter, cliArgs: { options: {}, fileNames: [], errors: [] } }, mappedOptions, ts.sys,
    { addons: new AddonRegistry({ reporter, system: ts.sys }), targetCompilerOptions })` with `reporter = new
    DefaultReporter(ts.sys)`, as the loader does (`packages/webpack/src/compiler-instances.ts:34-42`). Then it calls
    `keepCachesPerCompilation()`. On later builds it calls `resetCompilationCaches()` (plan Lifecycle →
    `buildStart`). The empty `AddonRegistry` is configured by `Compiler.setOptions` from the resolved config
    (`Compiler.ts:310-318`) and loads the profile's addons from `addonsDir` (verified in the spike);
  - `transform: { filter: { id: { include, exclude } }, handler(code, id) }`. The handler re-checks
    `isCompiledId(id, filter)`, since the hook filter only narrows. It ignores `code` (plan "Module ids"), calls
    `build(id, { moduleKind: "esm" })` (plan "ESM check": "the Vite host passes `moduleKind: "esm"` for every
    module"), and picks the JS file (`/\.(?:[cm]?js|jsx)$/i`) and its map (`/\.(?:[cm]?js|jsx)\.map$/i`) from
    `fragment.files`. It returns `{ code, map }`, with the `//# sourceMappingURL=` line stripped as
    `makeSourceMap` does (`packages/webpack/src/result-handling.ts:381-390`). Port those four lines; do not import
    the loader;
  - **No JS output and no error diagnostic → return `null`.** This happens when every active addon's
    `shouldProcessFile` declines the file (`Compiler.ts:467-477`, `shouldSkipFile` `:587-614`). Vite then compiles
    the module as without websmith. The loader fails such a module instead (`result-handling.ts:392-400`). Say so in
    the PR;
  - **Errors are not swallowed (stopgap).** If `diagnostics` holds an error, call `this.error` once with the error
    messages flattened (`ts.flattenDiagnosticMessageText`). Warnings, configuration errors, positions, addon throws
    and ESM-check presentation are the Diagnostics slice's, which replaces this. Do not build more here. Without the
    stopgap, a broken module would bundle green in the meantime.
- `src/index.ts` and `src/index.mts` as above.

The target profile's emit writes its files to the profile's `outDir`, as in the loader: `build` emits with
`writeFile` true (`ModuleCompiler.ts:343`, `Compiler.ts:1071-1074`). The spike wrote `tsc-out/a.js` and `v.js`. That
is parity, not a bug. Point the e2e fixtures' `outDir` inside the fixture directory.

**3. `packages/vite-test`: the e2e suite, wired into `pnpm test:e2e`.** Mirror `packages/webpack-test`
(`package.json`, `jest.config.ts`, `tsconfig*.json`, `.prettierrc`).

- `package.json`: `"name": "websmith-vite-test"`, `"private": true`, version `0.10.0`. Scripts: `clean`, `lint`,
  `lint:fix`, `typecheck`, and `"test:e2e": "jest --verbose --runInBand"`. There is no `build` script, because there
  are no `src` fixtures to compile. devDependencies:
  - `"@quatico/websmith-vite": "workspace:*"`;
  - `"vite": "^7.3.0"`;
  - **`"vite6": "npm:vite@^6.3.0"`** (plan Tests: "against Vite 6 through a `vite6` alias dependency, so CI needs no
    matrix");
  - `typescript` `5.7.3`, and the lint/jest set from webpack-test without the webpack, React and ts-loader entries.
- How CI picks it up: root `test:e2e` is `nx run-many --target=test:e2e` (`package.json`). nx infers projects from
  the pnpm workspace (`packages/**`) and targets from scripts, so the new script is enough. CI runs `pnpm build`
  before `pnpm test:e2e` (`pull-request.yml:82-88`), and the suite needs `packages/vite/lib`. Locally, run
  `pnpm build` first: nx's `test:e2e` has no `dependsOn` build (`nx.json`).
- **Run Vite in a child process**, as webpack-test does (`webpack-loader-option-names.test.ts:13`, `spawnSync`).
  Vite 7 is ESM-only, so Jest cannot load it. Each test writes a fixture to
  `packages/vite-test/test-output-<test>-<time>` (`test-output*` is git-ignored) and writes a `build.mjs` there. The
  script imports `build` from `"vite"` or `"vite6"` and `websmith` from `"@quatico/websmith-vite"` as a **default
  import**. Bare specifiers resolve through `packages/vite-test/node_modules`, so the default import is under test
  too. It calls `build({ root, configFile: false, logLevel: "warn", plugins: [websmith({...})], build: { write:
  false, minify: false, lib: { entry: "src/main.ts", formats: ["es"] } } })` and prints the chunk code as one JSON
  line. Remove the fixture in `afterEach`. A leftover `package.json` under `packages/**` would join the workspace on
  the next install.
- Fixture: `tsconfig.json` (`target` `ES2022`, `module` `ESNext`, `moduleResolution` `bundler`, `outDir`
  `./tsc-out`), `websmith.config.json` with `addonsDir: "./addons"` and a profile with a processor addon
  `addons/replacer/addon.js` (`exports.activate = ctx => ctx.registerProcessor((_f, c) => c.replaceAll("MARK_IN",
  "MARK_OUT"))`, the file layout of `writeMarkerAddon` in `webpack-loader-resolve-once.test.ts`), and `src/env.d.ts` with
  `declare module "*?raw" { const text: string; export default text; }`, so type-checked runs see no TS2307.

### Done when

The plan's slice line is the specification: "unit tests for id filtering and option mapping; e2e: `vite build` shows
a processor addon's change in the bundle, a `.tsx` module, a `?raw` import left untouched, the build case also on
Vite 6". Write each red first.

E2E (`packages/vite-test/tests/vite-build.test.ts`, test names "should …"; every case is red on `develop`, where no
package exists):

- **Processor change in the bundle, Vite 7.** `src/main.ts` exports `const greeting: string = "MARK_IN"`, and the
  profile is selected with `profile`. The bundle contains `MARK_OUT` and not `MARK_IN`. Run this case with the default
  `transpileOnly` (false) and default `configFile`. That way the default `<root>/websmith.config.json` and the
  type-checked path are covered as well.
- **The same build on Vite 6** through `vite6`: same fixture, same assertion.
- **A `.tsx` module.** `src/view.tsx` (imported by `main.ts`) holds `<div id="MARK_IN" />` and defines its own `h`.
  `build.mjs` passes `esbuild: { jsxFactory: "h" }`, so no React is needed. The profile's `tsConfig` says
  `"jsx": "react-jsx"`. Assert two `actual`s: the bundle contains `h("div"` with `MARK_OUT`, and it does not contain
  `react/jsx-runtime`. The second is red under any instance-wide override, as shown above. Use `transpileOnly: true`
  here, so that no `JSX` typings are needed.
- **`?raw` untouched.** `main.ts` imports `./data.ts?raw`, and `data.ts` holds `export const data: string =
  "MARK_IN";`. The bundle contains that source text verbatim, including `: string` and `MARK_IN`. If websmith compiled
  the `?raw` id, the raw module would be replaced by compiled JavaScript, and if esbuild did, the annotation would be
  gone.

Unit (`packages/vite/src/*.spec.ts`, assemble / act / assert, `testObj` / `actual`, one `actual` per test):

- `module-ids.spec.ts`: `\0` ids, each query form above, a plain `.ts`/`.tsx`/`.mts`/`.cts` id with a filter that
  accepts it, and an id the filter rejects.
- `options.spec.ts`: the default `configFile` under `root`; a relative `configFile` and a relative `tsConfigFile`
  resolved against `root` (not `cwd`); an absolute path kept; `tsConfigFile` left unset when not given; the pass-through
  fields; `include`/`exclude` defaults and that they do not reach the compiler options.

Core (`packages/core/src/compiler/ModuleCompiler.spec.ts`, added next to the existing tests, which stay unedited):

- **The target options reach the host's profile only.** A `ModuleCompiler` with `targetCompilerOptions: { jsx:
  Preserve }`, a target profile with `tsConfig.jsx: "react-jsx"` that `depends` on another profile, and a `.tsx`
  module: the returned fragment's JS file ends in `.jsx` and keeps the JSX. This is red on `develop`, because the host
  option does not exist.
- **Dependent profiles do not get them.** Same setup: the dependent profile's written file is compiled JSX (an
  `_jsx(` call), not `.jsx`.
- **They survive `updateLoaderConfig`.** It recreates the contexts (`ModuleCompiler.ts:198`). After it, the fragment
  is still `.jsx`.
- Without the host option, nothing changes: the existing `ModuleCompiler.spec.ts` cases, `Compiler.spec.ts`, every
  webpack unit test and `packages/webpack-test` pass unedited. `git diff --stat develop -- packages/webpack
  packages/webpack-test packages/core/src/compiler/Compiler.spec.ts` is empty.

Also:

- **Dependencies, with the lockfile updated through the public registry.** Vite 7 is not in the local pnpm store:
  the store has `vite@5.4.19`, `6.3.2`, `6.3.5`, `6.4.1`, `6.4.3` and `8.0.10`, and none of them is in
  `pnpm-lock.yaml`. Resolving needs the registry. **Never edit `~/.npmrc`** (its Artifactory login has expired).
  Instead:
  - create an empty file and `export NPM_CONFIG_USERCONFIG=<that file>`;
  - pass `--config.registry=https://registry.npmjs.org/` to every resolving pnpm command, e.g. `pnpm install
    --config.registry=https://registry.npmjs.org/` after editing both manifests;
  - afterwards these pass: `pnpm install --frozen-lockfile --offline` (pnpm 10) and `node
    $HOME/.cache/node/corepack/v1/pnpm/9.15.5/bin/pnpm.cjs install --frozen-lockfile --offline --lockfile-only`
    (CI runs pnpm 9). The lockfile header stays `lockfileVersion: '9.0'`, `grep -c 'tarball:' pnpm-lock.yaml` is 0,
    and no `resolution` points outside `registry.npmjs.org`.

  At the time of writing the newest releases were `vite@7.3.7` and `vite@6.4.4`. Vite 7.3.7 needs Node `^20.19.0 ||
  >=22.12.0`. `esbuild` has a `postinstall`. Leave `onlyBuiltDependencies` as it is (`@swc/core` only). esbuild
  finds its platform binary through its optional `@esbuild/*` package without the script. If a build fails for that
  reason, report it rather than adding esbuild. List every package new to the tree that has an install script in the
  PR.
- **Hook names checked against the installed Vite** (plan Open Point "Supported Vite majors": "The Tracer verifies
  the hook names"). While writing this brief they were checked in the published type definitions:
  - Vite 7.3.7 `dist/node/index.d.ts`: `transform` with `filter: { id?, code? }` at `:2746-2752`, `hotUpdate` at
    `:2722`, `createFilter` at `:3622`, and `handleHotUpdate` still present at `:2895`;
  - Vite 6.3.0: `hotUpdate` at `:3279`, the `filter` forms from `:3289`, `createFilter` at `:4180`.

  Re-check against the installed versions and quote the lines in the PR.
- **Build timings recorded in the PR** (Open Point "Per-module or Program-level compile": "the Tracer records build
  timings so a later plan can compare"). Give the wall time of the e2e fixture's `vite build` on Vite 7 without the
  plugin, with it under `transpileOnly: true`, and with it under `transpileOnly: false`, as the median of 5 runs,
  with the machine and Node version. Not a test.
- **Docs for agents:** add `packages/vite` and `packages/vite-test` to `docs/rules/architecture.md:46-50` (package
  table), `docs/rules/testing.md:242` (E2E suites), `docs/rules/workflow.md:68` and `AGENTS.md:36` and `:99` (e2e
  suite lists). If `pnpm lint` cannot resolve `@quatico/websmith-vite` in vite-test, add it to the
  import-resolver alias map in `eslint.config.js:71-79`. Touch nothing else in that file.
- **No `Release-Notes.md` entry and no README.** The package is private and unpublished. The plan gives
  `packages/vite/README.md`, the root README mention and the Changelog entry to `docs/vite-plugin-release`. Say so in
  the PR. Document `websmith()`, its options and the new `ModuleCompilerHost.targetCompilerOptions` in JSDoc only.
- **New files carry the MIT header** (`pnpm license:add`; write `index.mts`'s by hand). Do not add them to the
  `license:check` list.
- **No `console`** in `packages/vite/src` (AGENTS rule 6). The reporter is `DefaultReporter`, which writes through
  `ts.sys`, as the loader does.
- **Tests follow `docs/rules/testing.md`:** assemble / act / assert with no part comments, `testObj` and `actual`, no
  shared `testObj`.
- **Gates, all green:** `pnpm lint`, `pnpm build`, `pnpm test --skip-nx-cache`, `pnpm test:e2e --skip-nx-cache`.
  The advisory TypeScript 6.0.3 cell should be green too. If it is red only in the new packages, report it.

### Settled decisions — do not re-derive them

- **Next slice is the Tracer.** Plan `## Slices` order, #174 merged, no `waits:`.
- **Both new packages are `"private": true`.** The plan does not say so. The publish job (`release-and-publish.yml:86-93`)
  would otherwise publish an unfinished plugin, without a trusted publisher configured, at the next release. The
  plan's `docs/vite-plugin-release` already owns "publish configuration for `@quatico/websmith-vite` checked against
  the npm trusted-publishing workflow". Removing `private` belongs there.
- **No `profiles` option.** The plan text predates #177.
- **`jsx: "preserve"` through a target-only core seam**, not through `cliArgs` or the `tsConfig` option. Both
  failures of the instance-wide form are shown above.
- **CommonJS package plus an ESM entry.** The repo is CommonJS throughout, and Jest runs CommonJS. A default export
  that works from a native ESM `vite.config` needs the `.mts` entry.
- **The diagnostic stopgap is one `this.error` for error diagnostics.** The rest is the Diagnostics slice's.
- **One compiler instance per plugin.** Keying instances by `this.environment.name` and the `profile` map belong to
  Environments. The tracer's e2e builds the client environment only.
- **Per-module compile** (Open Point, decided). No `buildStart` Program.

### Earlier branches — what to take

- `origin/feature/60--plugin-for-vite` (`c1400fb5`, 2025-07, `packages/vite-plugin`). **Take nothing as code.**
  - It is named `@quatico/websmith-vite-plugin`, with peer `vite ^4 || ^5` and Vitest.
  - `src/plugin.ts` has `/* eslint-disable no-console */`, imports `WebpackLoaderOptions` from
    `@quatico/websmith-core`, defaults `transpileOnly` to `true`, matches `/\.[jt]sx?$/` (JavaScript too), returns
    the source unchanged on any error, and uses `handleHotUpdate`.
  - `src/compiler-adapter.ts` is a placeholder.
  - It commits a `tsconfig.tsbuildinfo` and has no `.mts` entry.

  What the plan keeps from it, its "file layout and config example", means the split into `src/index.ts` +
  `src/plugin.ts` and the `examples/vite.config.example.ts` shape (`plugins: [websmith({ profile, configFile })]`). The
  example becomes the issue #60 fixture in the Release slice, not here. Its `getOptionsHash` is not needed: the
  instance is keyed per plugin (later per environment), not per option hash.
- `origin/vite` (`c3eeaa94`, 2025-02, a stale 218-file integration branch; `packages/vite` only). **Reuse the shape,
  not the code.**
  - Its `package.json` has the right name `@quatico/websmith-vite`, the dependencies `api` and `core`, and a
    `publishConfig` pattern. Ignore `main: "src/index.ts"` and `publishConfig`: current packages publish `lib`
    directly (`packages/webpack/package.json`). Ignore `vite: "6.x"`, `typescript: "5.8.2"` and `@types/node 20`.
  - Its `plugin.ts` sets `enforce: "pre"`, which is right, but matches only `.jsx?`, returns `null` with a TODO, and
    uses `handleHotUpdate`, which the plan replaces with `hotUpdate` (Dev invalidation slice).

### Repo mechanics

- **pnpm 10** from `$HOME/.nvm/versions/node/v22.17.0/bin`: put it first on `PATH` and check `pnpm --version` prints
  `10.34.1`. The Homebrew pnpm 11 fails with E401. **pnpm 9.15.5** for the frozen lockfile check:
  `$HOME/.cache/node/corepack/v1/pnpm/9.15.5/bin/pnpm.cjs`.
- **Node 24** is at `$HOME/.nvm/versions/node/v24.21.0/bin/node`. Run the e2e under it once and say so in the PR.
- **Commits:** Arlo's notation without a colon (`commit-notation` skill). Suggested split:
  - `F Applies host-only compiler options to the ModuleCompiler target profile` (core seam + its tests);
  - `E Adds the websmith-vite and websmith-vite-test packages` (manifests, configs, lockfile);
  - `F Compiles TypeScript modules with websmith in vite build` (plugin + unit tests);
  - `t Proves addons run in vite build on Vite 7 and 6` (e2e);
  - `d Lists the Vite packages in the agent rules`.
- **Deleting files:** use `trash`, never `rm`.

### Bookkeeping

- Push the first real commit as soon as it exists.
- Open the PR with `plot-open-pr.sh`, never `gh pr create`. Its title comes from the wave heading, "Tracer".
- Append `→ #<number>` to the `feature/vite-plugin-tracer` line in `docs/plans/2026-10-01-vite-plugin.md`
  `## Slices` and commit that on this branch.

### Scope guard

This branch owns:

- `packages/vite/**` and `packages/vite-test/**` (new);
- `packages/core/src/compiler/Compiler.ts`, only the hook in `createCompilationContext` (`:412-455`);
- `packages/core/src/compiler/ModuleCompiler.ts`, only `ModuleCompilerHost` (`:38-45`), the constructor
  (`:155-170`) and the hook override; plus the new cases in `ModuleCompiler.spec.ts`;
- `pnpm-lock.yaml` (new importers and Vite only);
- the agent-docs lines above, the optional `eslint.config.js` alias line, and the `→ #<PR>` line in the plan.

Not in this slice (each has its own slice or owner; mention any you trip over in the PR, do not build them):

- Diagnostics through `this.warn`, configuration errors in `buildStart`, addon throws as errors, the CommonJS-profile
  rejection and ESM-check e2e cases. Owner: `feature/vite-plugin-diagnostics`.
- `ViteAddonContext`, `addWatchFile` for `dependencies`, `addVirtualFile`/`removeOutputFile`, result processors in
  `buildEnd`, and dependent-profile write deduplication. Owner: `feature/vite-plugin-addon-outputs`.
- Instances per `this.environment.name` and the `profile` map. Owner: `feature/vite-plugin-environments`.
- `createServer`, `hotUpdate`, the overlay, the write-loop guard. Owners: `feature/vite-plugin-dev-server` and
  `feature/vite-plugin-dev-invalidation`.
- The README, Release-Notes, removing `private`, publish configuration, and the issue #60 example. Owner:
  `docs/vite-plugin-release`. Note for that slice: `packages/core` and `packages/webpack` `require("tslib")` (root
  `importHelpers: true`) without declaring it. The new package inherits that pre-existing gap, which hoisting hides
  in the repo.
- Vite 8 (Rolldown/Oxc): best-effort, not tested here.
- The #174 review follow-up: in webpack watch mode, a failed `getAvailableAddons()` leaves a half-loaded
  `WebpackAddonService` that reports nothing. This is pre-existing, webpack-only, and has no owner in this plan.
- The loader's own-profile result-processor branch and the loader's "No processed output" error. These are loader
  behaviour; the plan defers aligning them.

Do not touch: `packages/webpack/**`, `packages/webpack-test/**`, `packages/api/**`, `ResolvedCompilerOptions.ts`,
`AddonRegistry.ts`, the rest of `Compiler.ts` and `ModuleCompiler.ts`, `.github/**`, `Release-Notes.md`, READMEs,
and the root `package.json` (no new root scripts or overrides).

Concurrent work, checked while writing this brief:

- **#178 and #179 (Dependabot, open)** edit every `package.json` and `pnpm-lock.yaml`. #179 bumps `@types/node` to
  26, ESLint to 10 and nx to 23. If either merges first, rebase, take `develop`'s lockfile, re-run the registry install,
  and copy the new devDependency versions into both new manifests. Never hand-merge the lockfile.
- **`bug/loader-option-errors-once`** (#134, brief written at `ef29dce6`) owns `ModuleCompiler.ts` `build`
  (`:286-354`), `setOptions` and `getConfigErrors`, and may split `build`'s diagnostics. There is no overlap with the
  host type and constructor. If it lands first, rebase, and make the stopgap read errors from wherever `build` then
  returns them.
- **`bug/profile-lib-names`** (#135) and **`bug/node-tsc-ignore-config`** / **`bug/typescript-6-test-fixtures`**
  (#144) touch neither `createCompilationContext` nor the new packages.

If you find something the plan did not anticipate, report it in the PR rather than improvising outside scope. Three
places to check:

- whether Vite's `build.sourcemap` warns about the returned map. The TypeScript map's `sources` are relative to
  `outDir`. Record what you see; do not fix it here;
- whether `require("vite")` from `lib/plugin.js` works on Node 22.12.0 exactly, the engines floor, and not only on
  22.17;
- whether the ESM check reads a `.jsx` target output correctly once a profile has `esm`. That is for the Diagnostics
  slice; just note it.
