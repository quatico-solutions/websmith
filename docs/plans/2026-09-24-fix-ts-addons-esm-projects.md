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

### Open Points

- [ ] **How to mark the output as CommonJS.** Constraints found while drafting:
  - A `{"type": "commonjs"}` `package.json` in the output root is simplest, but the default output root
    `<addonsDir>/../lib` can be the **client's own** `lib/` — a marker there would turn the client's own ESM
    output into CommonJS. Scope it to websmith-owned directories (e.g. one marker per compiled addon
    directory), never overwrite an existing `package.json`, or move the default output somewhere
    websmith owns.
  - Emitting `.cjs` (rename on write) needs no marker, but breaks multi-file addons: the CommonJS
    `require("./helper")` does not resolve `helper.cjs`. Cross-addon imports (e.g.
    `foobar-replace-processor` → `../foobar-replace-transformer`) have the same problem.
  - The webpack cache (`.websmith-cache/addons`) is websmith-owned, so a root marker is safe there.
- [ ] Does the same failure reproduce through the webpack loader? (Inferred from code in #111, not yet run.)
- [ ] Should the chosen output location or marker be documented for addon authors (`README.md`)?

## Slices

- `feature/fix-ts-addons-esm-projects` — CommonJS-safe addon output in `AddonRegistry` and `WebpackAddonService`, with e2e cases for `"type": "module"` consumers <!-- builds: CommonJS marker for compiled addon output -->

## Definition of Done

<!-- From ## Plot Config in AGENTS.md; mirrors .github/workflows/pull-request.yml -->

- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] `pnpm test:e2e`

## Notes

<!-- Session log, decisions, links -->
