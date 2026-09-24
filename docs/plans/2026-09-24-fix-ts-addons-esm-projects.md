<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# Fix TypeScript addons in "type": "module" projects

> Compiled `.ts` addons load in consumer projects whose `package.json` declares `"type": "module"`, in the CLI and the webpack loader.

## Status

- **State:** Draft
- **Type:** feature
- **Story:** node24-esm-support
- **Issue:** #111
- **Review:** in-session
- **Impl:** same branch
<!-- Transition records — written by the workflow commands, not by hand:
- **Approved:** <date>, <who>, <channel>
- **Started:** <date>, <who>, <branch>   (one line per started branch)
-->

## Changelog

- TypeScript addons now load in projects whose `package.json` declares `"type": "module"` (#111).
- Compiled addons are written to `.websmith-cache/addons` instead of `lib/` next to the addons directory.

## Motivation

websmith compiles `.ts` addons to CommonJS `.js`. In a consumer project with `"type": "module"`, Node reads
that output as an ES module and loading fails with `ADDON_STRUCTURE_ERROR: exports is not defined in ES module
scope`. Reproduced with the bundled CLI on Node 24.21.0 and 20.19.4 (story `node24-esm-support`,
`analysis-node24-esm.md` B.3). Clients on ESM cannot use TypeScript addons today.

## Design

### Approach

Keep compiling addons to CommonJS and make Node treat the compiled output as CommonJS, whatever the
consumer's `"type"` is. Two compile sites need the same change:

- `AddonRegistry` (CLI, core): `module: CommonJS` into `<addonsDir>/../<addonLibDir>`, default `lib`
  (`packages/core/src/compiler/addons/AddonRegistry.ts:389-390`, `553-563`).
- `WebpackAddonService` (loader): `module: CommonJS` into `<cwd>/.websmith-cache/addons`
  (`packages/webpack/src/WebpackAddonService.ts:288-304`, `TsCompiler.ts:133`).

Tests first: an e2e case in `compiler-test` with a `"type": "module"` consumer and a `.ts` addon (fails today),
the same for the webpack loader in `webpack-test`, and unit tests for the marker/rename logic.

**Decided (in-session, Jan Wloka, 2026-09-24): compile into a websmith-owned directory with one CommonJS
marker at its root.**

- `AddonRegistry` stops writing to `<addonsDir>/../lib` by default and compiles into
  `<project root>/.websmith-cache/addons`, as the webpack loader already does. `addonLibDir` (internal
  `AddonRegistry` config, not part of `packages/api`) keeps working as an explicit override.
- Both compile sites write `{"type": "commonjs"}` as `package.json` at the root of that directory, so every
  compiled file — including cross-addon imports such as `foobar-replace-processor` →
  `../foobar-replace-transformer` — loads as CommonJS.
- Never overwrite an existing `package.json`: with an explicit `addonLibDir` that already holds one, report a
  warning instead of writing.
- Why not `lib/`: the default can be the client's own `lib/`. In this repo it already is —
  `packages/example-addons` publishes `main: lib/index.js` and the registry compiles addons into the same
  `lib/`. A marker there would turn the client's own ESM output into CommonJS.
- Rejected: `.cjs` output (breaks `require("./helper")` in multi-file and cross-addon addons); a marker per
  addon directory (leaves root-level addon files unmarked and still writes into the client's `lib/`).

### Open Points

- [ ] Tests and fixtures that expect compiled addons in `example-addons/lib`
  (`compiler-test/tests/compile-websmith.test.ts:34`, `webpack-test/tests/webpack-websmith.test.ts:55`) move to
  the cache directory.
- [ ] Is `<project root>` the working directory (as in `TsCompiler.ts:133`) or the directory of
  `websmith.config.json` / `tsconfig.json` for the CLI?
- [ ] Does the failure reproduce through the webpack loader today? (Inferred from code in #111.) The e2e case
  answers it.
- [ ] Release note and `README.md`: compiled addons move out of `lib/`; `.websmith-cache/` belongs in the
  client's `.gitignore`.

## Slices

- `feature/fix-ts-addons-esm-projects` — CommonJS-safe addon output in `AddonRegistry` and `WebpackAddonService`, with e2e cases for `"type": "module"` consumers <!-- builds: websmith-owned addon output dir with a CommonJS package.json marker -->

## Definition of Done

<!-- From ## Plot Config in AGENTS.md; mirrors .github/workflows/pull-request.yml -->

- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] `pnpm test:e2e`

## Notes

<!-- Session log, decisions, links -->
