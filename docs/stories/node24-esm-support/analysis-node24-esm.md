<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# Analysis: Node 24 and ESM support

Research for Phase 1 (Node 24) and Phase 2 (ESM mapping) of `STORY-node24-esm-support.md`. Done on
2026-09-24 on branch `develop` (`e4b5437`), macOS arm64. No tracked file was changed.

## Summary

- **Node 24 works now.** Build, unit tests, e2e, typecheck and lint all pass on Node `v24.21.0`, with the same
  counts as Node `v20.19.4`. No deprecation warnings were printed. `@types/node` 24 typechecks with 0 errors.
- **Node 20 reached end of life on 2026-04-30** (https://github.com/nodejs/Release, `schedule.json`; corrected
  from 2026-03-24 in review). Node 24 enters maintenance on 2026-10-20 and ends on 2028-04-30. Keeping Node 20 in
  CI is a support-policy decision; there is no technical reason to keep it.
- **ESM addons already load through the existing `createRequire` path** on Node 24 and on Node >= 20.19
  (require(esm)). Three gaps remain: `.mjs`/`.mts` are never discovered, top-level await fails, and `.ts`
  addons break inside `"type": "module"` consumer projects because websmith compiles them to CommonJS `.js`.
- **ESM consumers can already `import { … }`** from the CommonJS packages (named exports detected).
- Suggested direction: stay CJS-only and add first-class ESM addon support (option 1 below). Dual or ESM-only
  output costs a lot (Jest 29, webpack bundle, `__dirname`) and brings little for a Node CLI and webpack loader.

## Method

- Node 24: official tarball `node-v24.21.0-darwin-arm64.tar.gz` from https://nodejs.org/dist/latest-v24.x/,
  checked against `SHASUMS256.txt` (`OK`) and extracted into the session scratchpad. It was not installed
  system-wide, and nvm and brew were left unchanged.
- pnpm: the existing corepack shim from the nvm Node 20 install (`pnpm 10.34.1`). Its shebang is
  `#!/usr/bin/env node`, so with the Node 24 `bin` first on `PATH` it runs on Node 24. `pnpm exec node --version`
  printed `v24.21.0`. CI uses pnpm 9 (`pull-request.yml:21-23`); this difference is **unverified** as a factor.
- Each target ran as `pnpm <target> --skip-nx-cache` with `NX_DAEMON=false`, so neither the nx cache nor the
  daemon hid a Node 20 result.
- Experiments ran in the scratchpad only (`esm-exp/`, `bin-exp/`, `types24/`).

## Part A — Node 24

### A.1 A `pnpm install` was needed (not caused by Node 24)

The first `pnpm build` on Node 24 failed in `@quatico/websmith-node`:
`src/websmith/compile.ts:7 TS2307: Cannot find module '@quatico/websmith-api'` (3 errors). Plain `tsc` in
`packages/node` fails the same way on Node 20.19.4. Cause: a stale `node_modules`.
`packages/node/node_modules/@quatico` only held `websmith-core`, although `packages/node/package.json`
declares `@quatico/websmith-api` (`workspace:*`). `node_modules/.modules.yaml` dates from 2025-07-23; the
last `pnpm-lock.yaml` commit is from 2025-11-21. `pnpm install --frozen-lockfile` on Node 24 fixed it
("Lockfile is up to date"; `+ comment-json`, `+ deepmerge`, `eslint-plugin-jest 28.11.0 -> 29.0.1`).
`shasum pnpm-lock.yaml` was `5d91992b…` both before and after, and `git status` stayed clean.

### A.2 Definition of Done results

| Target | Node 24.21.0 | Node 20.19.4 (baseline) |
|---|---|---|
| `pnpm build` (9 projects) | exit 0 | exit 0 |
| `pnpm test` (6 projects) | 38 suites, 757 tests passed | identical |
| `pnpm test:e2e` (6 projects) | 17 suites, 154 passed, 1 skipped | identical |
| `pnpm typecheck` | exit 0 | exit 0 |
| `pnpm lint` | 0 errors, 359 warnings | 0 errors, 359 warnings |
| `DeprecationWarning` / `ExperimentalWarning` / `DEP0` in logs | 0 | 0 |

Unit tests per project (both Node versions): api 21, testing 32, core 472, websmith-loader 83, node 57,
compiler 92. E2E: core 6, websmith-loader 38, examples 11, compiler-test 43, compiler 9, loader-test 47 + 1
skipped. The e2e run took 56 s on Node 24 and 42 s on Node 20 (one run each; **unverified** as a trend).

**No failure is caused by Node 24.** The only failure (A.1) was environmental and happens on Node 20 too.

Caveat: `bin.test.ts` runs the bundled CLI via `execSync` (`packages/compiler/src/bin.test.ts:312-318`).
Warnings printed by those child processes may not reach the logs, so "no deprecation warnings" is verified
only for what Jest and nx printed.

### A.3 Dependency engines

| Package (installed) | `engines.node` | Node 24 |
|---|---|---|
| typescript 5.7.3 | `>=14.17` | ok |
| webpack 5.97.1 | `>=10.13.0` | ok |
| jest 29.7.0 | `^14.15.0 \|\| ^16.10.0 \|\| >=18.0.0` | ok |
| ts-jest 29.2.5 | `… \|\| >=20.0.0` | ok |
| ts-loader 9.5.2 | `>=12.0.0` | ok |
| eslint 9.19.0 | `^18.18.0 \|\| ^20.9.0 \|\| >=21.1.0` | ok |
| commander 12.1.0 | `>=18` | ok |
| rimraf 6.0.1 | `20 \|\| >=22` | ok |
| nx 18.3.4 | none | ok in practice (A.2) |

No websmith package declares `engines` (`grep '"engines"' package.json packages/*/package.json` finds
nothing), so a new `engines` field would be the first one.

### A.4 `@types/node` 24

`@types/node@24.13.6` (plus `undici-types`) was installed into `scratchpad/types24` from the public registry
(the user `.npmrc` needs a login, so `--userconfig` pointed to an empty file). Each package's
`tsconfig.test.json` was then extended with `typeRoots` pointing there first. `tsc --listFiles` showed only
the 24 declarations loaded. Result: **0 errors in all 9 packages** (api, core, testing, webpack, node,
compiler, example-addons, compiler-test, webpack-test). The lockfile bump itself (`20.19.9 -> 24.x`) is
**unverified**: it was not done, to keep `pnpm-lock.yaml` unchanged.

### A.5 Phase 1 recommendation

- Update `.nvmrc`, `node-version` in `pull-request.yml:20`, `protect-stable.yml:23`,
  `release-and-publish.yml:21`, and `@types/node` to `24.x`. The evidence above expects no code changes.
- Node 20 is EOL, so a matrix of `[20, 24]` in `pull-request.yml` only makes sense while `engines` still
  promises Node 20 to consumers. If websmith declares `engines.node: ">=20.19"` (the require(esm) floor, see
  B.2), test 20 and 24 in CI. If it declares `">=22.12"` or `">=24"`, test 24 only (22 as an optional
  second job). The choice is a policy question.
- Separate chore: document that a stale `node_modules` breaks `packages/node` (A.1). CI runs
  `--frozen-lockfile`, so it is not affected.

## Part B — ESM mapping

### B.1 What blocks an ESM build today (`packages/*/src`, non-test)

| Location | Construct | Impact under ESM output |
|---|---|---|
| `core/src/compiler/addons/AddonRegistry.ts:8,854` | `createRequire(__filename)` | `__filename` undefined; use `import.meta.url` |
| `AddonRegistry.ts:833,846` | bare `require(...)` (Jest branch) | `require` undefined |
| `AddonRegistry.ts:851` | `delete require.cache[...]` | undefined; ESM has no cache eviction (B.2) |
| `AddonRegistry.ts:553-563` | addons compiled with `module: CommonJS`, `.js` out | breaks in `"type":"module"` dirs (B.3) |
| `AddonRegistry.ts:355-358,373-376` | discovery: `addon/index` + `.js/.jsx/.ts/.tsx` | `.mjs/.cjs/.mts/.cts` never found |
| `core/src/environment/system.ts:18` | `typeof module … module.exports` | safe (guarded `typeof`) but dead in ESM |
| `compiler/src/get-version.ts:11` | `__dirname` + `../package.json` | undefined in ESM |
| `node/src/websmith/find-tsc.ts:17,25` | `__dirname`, `require.resolve("typescript")` | both undefined in ESM |
| `node/src/webpack/webpack-options.ts:14,17,24` | `__dirname`, `require.resolve("ts-loader")` | both undefined in ESM |
| `webpack/src/result-handling.ts:112,115` | `require.resolve(x, { paths })` | undefined; `import.meta.resolve` has no `paths` option |
| `webpack/src/WebpackAddonService.ts:177,180` | `require.cache`, bare `require` | undefined in ESM |
| `WebpackAddonService.ts:209-210,291` | own discovery (`index.js/addon.js`), `module: CommonJS` | same gaps as AddonRegistry |
| `core/src/compiler/defaults.ts:47-58` | `require("!!raw-loader!…")` | commented out; no impact |

No JSON `import` statements and no `import.meta` or dynamic `import()` exist in `src` (grep). Two addon
loaders exist: `AddonRegistry` (CLI, core) and `WebpackAddonService` (loader, `TsCompiler.ts:14,119`). Both
would need the same change.

**Toolchain:**

- The bundled CLI (`packages/compiler/webpack.config.js`) targets `node`. It sets `node.__dirname/__filename:
  false` (lines 51-52), which keeps the real `__filename` for `createRequire`, and treats `typescript` as an
  external `commonjs` module (line 45). Webpack rewrites `delete require.cache[importPath]` to
  `delete __webpack_require__.c[importPath]` (`packages/compiler/bin/bin.js:15034`). That call never evicts
  Node's cache, so addon reload in the bundle is already a no-op (pre-existing, unrelated to ESM).
- Jest (`jest-base.config.ts:19-22`): `ts-jest` with `isolatedModules`, CommonJS output, and Jest 29's own
  module registry. Scratch test: inside Jest 29.7 on Node 24, `require()` and `createRequire(__filename)()`
  of `addon.mjs` fail with `Cannot use import statement outside a module`, and a `"type":"module"` `addon.js`
  fails with `Unexpected token 'export'` (`scratchpad/esm-exp/jestexp`). Jest intercepts `createRequire`.
  **Consequence:** in-process unit tests can't cover ESM addon loading. Use e2e tests that spawn `bin.js`
  (as `bin.test.ts` does), or native ESM Jest (`--experimental-vm-modules`, **unverified**). Jest 30 adds
  `.mts/.cts` and `import.meta` support (https://jestjs.io/blog/2025/06/04/jest-30); whether it handles
  require(esm) is **unverified**.
- Example addons: `.ts` in `packages/example-addons/src/<name>/addon.ts`, loaded by path through `addonsDir`
  (for example `compiler-test/tests/compile-websmith.test.ts:29`) and compiled by the registry into
  `example-addons/lib`. The package itself compiles as CommonJS (`example-addons/tsconfig.json:6`).
- `license-config.json` formats `ts|tsx|js|jsx`. `.mts/.mjs` would fall back to `defaultFormat`, which uses the
  same `/* */` block (**unverified** against `license-check-and-add` behaviour).

### B.2 Experiment: loading ESM addons through `createRequire` (scratchpad `esm-exp/`)

`loader.cjs` mirrors `AddonRegistry.loadSingleAddon`: `createRequire(__filename)(path)`, then
`mod.default || mod`, then `activate("ctx")`.

| Addon | Node 24.21.0 | Node 20.19.4 | Node 22.14.0 | Node 20.18.3 |
|---|---|---|---|---|
| CJS `addon.js` | ok | ok | ok | ok |
| `addon.mjs`, named `export const activate` | ok | ok | ok | `ERR_REQUIRE_ESM` |
| `addon.js` in `"type":"module"` dir | ok | ok | ok | `ERR_REQUIRE_ESM` |
| `addon.mjs`, `export default { activate }` | ok (`{__esModule, default}`) | ok | ok | `ERR_REQUIRE_ESM` |
| `addon.mjs` with top-level `await` | `ERR_REQUIRE_ASYNC_MODULE` | same | same | `ERR_REQUIRE_ESM` |
| CJS-emitted `addon.js` in `"type":"module"` dir | `exports is not defined in ES module scope` | same | same | `ERR_REQUIRE_ESM` |

- `process.features.require_module` is `true` on 20.19.4, 22.14.0 and 24.21.0, and `undefined` on 20.18.3.
- No `ExperimentalWarning` was printed on any version, including for an addon under `node_modules/`.
- Official docs (https://nodejs.org/docs/latest-v24.x/api/modules.html#loading-ecmascript-modules-using-require)
  confirm this history. require(esm) was added in v22.0.0/v20.17.0 behind a flag and unflagged in
  v23.0.0/v22.12.0/v20.19.0. The warning was dropped in v23.5.0/v22.13.0/v20.19.0, and the feature is no
  longer experimental as of v24.15.0. Top-level await throws `ERR_REQUIRE_ASYNC_MODULE` ("use `import()`
  instead"). A default export appears as `.default` with `__esModule: true`, which the registry's
  `module.default || module` fallback already handles.
- Dynamic `import()` (`loader-import.mjs`) loads every case above, including top-level await, except the
  CJS-emitted `.js` in a `"type":"module"` dir.
- Cache eviction (`reload/t.cjs`): after `delete require.cache[p]` and a second `require`, a CJS addon
  returns the new value but an ESM addon returns the old one, on both Node 24 and 20.19. The ESM entry sits
  in `require.cache`, yet deleting it does not reload the module. **Watch mode would keep stale ESM addons.**

**Answer to the story's open point:** yes, require(esm) makes ESM addons work through the existing synchronous
`createRequire` path on Node >= 20.19 / 22.12 / 24, with no async activation needed. Only top-level await
and hot reload need `import()`, and `import()` would make addon loading async
(`loadAddonsSync` → async API).

### B.3 Experiment: the real bundled CLI with ESM addons (scratchpad `bin-exp/`)

The built `packages/compiler/bin/bin.js` ran with `--addonsDir ./addons --addons <name>` on a one-file project
(`export const foo = "foo"`), with a processor that rewrites the string:

| Addon | Consumer `package.json` | Node 24.21.0 | Node 20.19.4 |
|---|---|---|---|
| `esm-js/addon.js` + `{"type":"module"}` | CJS | applied (`"esm-js"`) | applied |
| same | `"type":"module"` | applied | applied |
| `esm-mjs/addon.mjs` | either | `Missing addons: "esm-mjs"` | same |
| `ts-addon/addon.ts` | CJS | applied (`"ts-addon"`) | applied |
| `ts-addon/addon.ts` | `"type":"module"` | `ADDON_STRUCTURE_ERROR: exports is not defined in ES module scope` | same |

Findings:

- ESM addons shipped as `"type":"module"` `.js` **already work** with the published CLI on Node >= 20.19.
- `.mjs` is not discovered (B.1 discovery list), and neither is `.mts`.
- A `.ts` addon in an ESM consumer project **fails today**. The registry writes CommonJS to
  `<addonsDir>/../lib/**.js` (`AddonRegistry.ts:553-563`), and Node reads it as ESM because the nearest
  `package.json` says `"type":"module"`. The fix is to emit `.cjs`, or to emit ESM, or to write a
  `{"type":"commonjs"}` `package.json` into the lib dir.
- The webpack loader compiles addons the same way into `<cwd>/.websmith-cache/addons`
  (`WebpackAddonService.ts:46,291`), so the same failure is expected in ESM projects. This is inferred from
  code, **unverified** by a webpack run.

### B.4 Consumers and the webpack loader

- ESM consumers: `import * as m from ".../packages/<p>/lib/index.js"` on Node 24 exposes named exports for all
  packages (api 39 names including `__esModule`, core 34, websmith-loader 8, node 7, testing 8). So
  `import { Compiler } from "@quatico/websmith-core"` works from ESM without dual publishing, thanks to Node's
  CJS named-export detection (tested on the local `lib`; through a published package via `main`,
  **unverified**).
- Webpack loaders can be ESM. `loader-runner@4.3.0/lib/loadLoader.js` uses `import()` when
  `loader.type === "module"`. Webpack 5.97.1 sets that type for `.mjs` files or when the loader's
  `package.json` has `"type":"module"` (`webpack/lib/NormalModuleFactory.js:1198-1206`). An ESM
  `websmith-loader` would therefore load, but loaders run inside webpack's CJS-heavy tooling. Staying CJS
  costs nothing here.
- ESM `webpack.config.mjs` consumers reference the loader by name or path, so the loader's format doesn't
  matter to them (**unverified** end to end).

### B.5 Options for package output

**Option 1 — CJS-only output, first-class ESM addons (suggested).**

- Build: unchanged per package. Registry and `WebpackAddonService` changes: discover
  `addon|index` + `.mjs/.cjs/.mts/.cts`; compile addon `.ts` to output that is correct regardless of the
  consumer's `"type"` (emit `.cjs`, or add a `lib/package.json` `{"type":"commonjs"}`); map `.mts` to ESM
  output. Top-level await: catch `ERR_REQUIRE_ASYNC_MODULE` and report a clear diagnostic, or add an opt-in
  async load path.
- Watch/reload: document that ESM addons don't hot-reload, or reload them through `import()` with a
  cache-busting query (**unverified**; this leaks memory per reload).
- CLI bin and webpack bundle: unchanged (`createRequire(__filename)` keeps working, B.3).
- Jest: unchanged for existing tests. ESM addon coverage goes into e2e tests (`compiler-test`, `webpack-test`,
  `bin.test.ts`) because Jest 29 can't require ESM in-process (B.1).
- Consumers: must run Node >= 20.19 / 22.12 to load ESM addons; CJS addons keep working on any version.
  Declare `engines.node: ">=20.19"` or higher.

**Option 2 — dual CJS/ESM with `exports` maps.**

- Build: two `tsc` runs per published package (api, core, compiler, webpack, node, testing; examples
  optional), each with `package.json` `exports` (`import`/`require`/`types`), plus a `{"type":"module"}`
  marker in the ESM output dir.
- Code: every item in B.1 needs a dual-safe form (for example `import.meta.url` vs `__filename` behind a
  build-time shim). `result-handling.ts` needs `createRequire(import.meta.url).resolve(x, { paths })`.
- Dual-package hazard: `AddonRegistry` state and the `instanceof` checks on diagnostics (`ErrorMessage`, …)
  could split between the two copies of `api`/`core` (**unverified** for this codebase).
- Jest: tests keep using the CJS path. The ESM output needs separate smoke tests.
- webpack CLI bundle: unchanged (it bundles from `src`).
- Consumers on Node 20: fine, but they gain little over option 1 (B.4).

**Option 3 — ESM-only.**

- Build: `module: NodeNext`, `"type":"module"`, `.js` extensions on every relative import across all
  packages. Code: replace all B.1 CJS items. `AddonRegistry` loses synchronous `require` of CJS addons unless
  it keeps `createRequire(import.meta.url)`.
- Jest: move to native ESM Jest (`--experimental-vm-modules`) or another runner, and drop `isolatedModules`
  CommonJS transpile. This is the largest cost, and it touches every package's test setup.
- CLI bundle: switch webpack to `output.module`/`experiments.outputModule` or drop the bundle.
- Webpack loader: works as ESM (B.4).
- Consumers: CJS consumers need Node >= 20.19 to `require()` websmith, and packages with top-level await
  can't be required at all. Overlaps with the TypeScript 7 re-architecture, which would redo the build again.

## Answers to the story's open points

- **Node versions:** Node 24 needs no code changes (A.2, A.4). Node 20 is EOL. The require(esm) floor is
  20.19 / 22.12.
- **Dual or ESM-only:** neither is needed to meet the story's goal. ESM consumers already get named imports
  (B.4), and ESM addons need only option 1.
- **require(esm) vs `import()`:** require(esm) is enough for synchronous activation (B.2, B.3). `import()` is
  needed only for top-level await and for reloading ESM addons.
- **`createRequire(__filename)` in an ESM build:** relevant only for options 2 and 3. Option 1 keeps it.
- **Webpack loader and ESM addons:** the same gaps as the CLI, in a second implementation
  (`WebpackAddonService`). An ESM loader package would load (B.4).

## Unverified items

- CI with pnpm 9 on Node 24 (verified only locally with pnpm 10.34.1).
- The `@types/node` 24 bump through the lockfile (verified via scratch `typeRoots` only).
- The `.ts` addon failure in `"type":"module"` projects through the webpack loader (inferred from code).
- Jest 30 and require(esm); Jest native ESM mode for this repo.
- Dual-package hazard specifics; `import()` cache-busting reload.
- Deprecation warnings inside child processes spawned by e2e tests.
