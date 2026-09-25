<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# Fix TypeScript addons in "type": "module" projects

> Compiled `.ts` addons load in consumer projects whose `package.json` declares `"type": "module"`, in the CLI and the webpack loader.

## Status

- **State:** Delivered
- **Type:** feature
- **Story:** node24-esm-support
- **Issue:** #111
- **Review:** in-session
- **Impl:** same branch
- **Delivered:** 2026-09-25
<!-- Transition records — written by the workflow commands, not by hand:
- **Approved:** <date>, <who>, <channel>
- **Started:** <date>, <who>, <branch>   (one line per started branch)
-->
- **Approved:** 2026-09-25, Jan Wloka, in-session
- **Started:** 2026-09-25, Jan Wloka, `feature/fix-ts-addons-esm-projects`

## Approval

- **Assignee:** Jan Wloka

## Changelog

- TypeScript addons now load in projects whose `package.json` declares `"type": "module"` (#111).
- The CLI writes compiled addons to `.websmith-cache/addons-cli` next to `tsconfig.json` instead of `lib/` next to
  the addons directory. Compiled addons left in that `lib/` by earlier versions are no longer used and can be deleted.

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
the same for the webpack loader in `webpack-test`, and unit tests for the marker logic. The webpack case also
answers whether the loader fails today: #111 infers it from `WebpackAddonService` compiling to CommonJS `.js`,
but nobody has run it; whichever way it goes, the test pins the fixed behaviour.

**Decided (in-session, Jan Wloka, 2026-09-24): compile into a websmith-owned directory with one CommonJS
marker at its root.**

- `AddonRegistry` stops writing to `<addonsDir>/../lib` by default and compiles into
  `<tsconfig.json directory>/.websmith-cache/addons-cli`. The **tsconfig directory**, not the working
  directory, is the project root here, so running `websmith -p packages/x` from a monorepo root uses the same
  cache as running it inside `packages/x`. `addonLibDir` (internal `AddonRegistry` config, not part of
  `packages/api`) keeps working as an explicit override.
- **The CLI and the webpack loader keep separate directories** (`addons-cli` and the loader's existing
  `addons`), each with its own marker. They compile with different options — the CLI with `Classic`
  resolution and `noResolve` (`AddonRegistry.ts:553-563`), the loader with `NodeNext`
  (`WebpackAddonService.ts:288-304`) — and the registry skips recompiling when the output is newer than the
  source, so a shared directory would let one silently load the other's build. Rejected: aligning both option
  sets to share one directory, a larger change to the loader than #111 needs.
- **The loader switches to `moduleResolution: Node10`** (amended during implementation, Jan Wloka, 2026-09-25).
  Its `module: CommonJS` + `moduleResolution: NodeNext` pairing is invalid (TS5110), so TypeScript 5.7.3 takes the
  output format from the consumer's `package.json`: in a `"type": "module"` project the loader emits **ESM**, not
  CommonJS. Measured on Node 20.19.4: a single-file addon happens to load (Node can `require()` ESM), but an addon
  with a relative or cross-addon import fails with `Cannot find module '…/esm-processor/addon'` (ESM needs
  extensions), and since the loader compiles every addon in `addonsDir`, one such addon breaks all requests. The
  marker alone makes it worse — it breaks the single-file case too (`Unexpected token 'export'`). With `Node10`,
  `module: CommonJS` is honoured and the marker applies as in the CLI. The CLI still uses `Classic` +
  `noResolve`, so the two option sets stay different and the directories stay separate. Rejected: leaving the
  loader to a separate issue.
- **In the loader, module-resolution errors become warnings** (review, Jan Wloka, 2026-09-25). `Node10` ignores
  `package.json` `"exports"`, so an addon importing a package whose types exist only under `"exports"` gets
  TS2307. The loader reports the "cannot find module" family (2307, 2792, 7016) as warnings and still emits; the
  emitted `require()` resolves at runtime through Node, which does honour `"exports"`. Other diagnostics behave
  as before: the loader only checks them when the emit itself fails or reports diagnostics, so ordinary type
  errors in addons never failed a webpack build and still do not (measured during implementation; the review's
  premise that the loader throws on any error was wrong). Making them fail is out of scope for #111. Rejected: `noResolve` as in the CLI (loses all type errors from
  imported types) and documenting the failure only.
- **Loader cache keys include the compile options** (review finding): today the key hashes only addon sources and
  a cache hit returns before the marker is written, so an existing user's ESM build from the old loader would be
  reused without a marker. The marker is written before the cache check.
- **Import resolution moves with the output** (accepted, review, 2026-09-25): CLI addons compiled into
  `<tsconfig dir>/.websmith-cache/addons-cli` resolve relative imports that leave the addons directory, and bare
  imports, from there — through the project's `node_modules`, not the addon package's own (visible under pnpm's
  strict layout). The release note and README say addons import only within the addons directory or by package
  name available to the project; an e2e case imports a package from the project's `node_modules`. Rejected:
  mirroring the addons directory's relative path under the cache.
- Both compile sites write `{"type": "commonjs"}` as `package.json` at the root of that directory, so every
  compiled file — including cross-addon imports such as `foobar-replace-processor` →
  `../foobar-replace-transformer` — loads as CommonJS.
- Never overwrite an existing `package.json`: with an explicit `addonLibDir` that already holds one, report a
  warning instead of writing.
- **Old output is left alone.** Compiled addons from earlier versions stay in `<addonsDir>/../lib`; websmith no
  longer loads them, and the release note says they can be deleted. websmith deletes nothing there, because that
  `lib/` may be the client's own. Rejected: a one-time warning when old output is found (noise on every run
  until someone deletes it, for files that do no harm).
- Why not `lib/`: the default can be the client's own `lib/`. In this repo it already is —
  `packages/example-addons` publishes `main: lib/index.js` and the registry compiles addons into the same
  `lib/`. A marker there would turn the client's own ESM output into CommonJS.
- Rejected: `.cjs` output (breaks `require("./helper")` in multi-file and cross-addon addons); a marker per
  addon directory (leaves root-level addon files unmarked and still writes into the client's `lib/`).

### Tests and fixtures

Five test files clean up `example-addons/lib` because the registry compiled addons there; they move to the new
directories: `compiler-test/tests/compile-websmith.test.ts:34`, `webpack-test/tests/webpack-websmith.test.ts:55`,
`webpack-test/tests/compile-module-date.test.ts:64`, `webpack-test/tests/websmith-loader.test.ts:29`,
`webpack/src/webpack.test.ts:35`. `README.md` and `packages/compiler/README.md` tell clients to add
`.websmith-cache/` to their `.gitignore`; this repo's `.gitignore` already has it.

## Slices

### Fix TypeScript addons in "type": "module" projects

- `feature/fix-ts-addons-esm-projects` — CommonJS-safe addon output in `AddonRegistry` and `WebpackAddonService`, with e2e cases for `"type": "module"` consumers → #116 <!-- builds: websmith-owned addon output dir with a CommonJS package.json marker -->

## Definition of Done

<!-- From ## Plot Config in AGENTS.md; mirrors .github/workflows/pull-request.yml -->

- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] `pnpm test:e2e`

## Notes

<!-- Session log, decisions, links -->
