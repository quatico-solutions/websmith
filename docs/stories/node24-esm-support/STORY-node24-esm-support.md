---
title: Node 24 and ESM support
author: Jan Wloka
status: draft
created: 2026-09-24
updated: 2026-09-24
---

<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# Node 24 and ESM support

## Objective

Run and test websmith on Node 24, and support ES modules: consuming websmith packages from ESM projects and
loading addons written as ES modules.

## Why Now

- Node 24 is the active LTS (`v24.21.0`, "Krypton"); the repo pins Node 20 in `.nvmrc` and in all three GitHub
  workflows (`pull-request.yml`, `protect-stable.yml`, `release-and-publish.yml`).
- Every websmith package is CommonJS today, while consumers and addon authors increasingly write ESM.

## Decisions Taken in Scoping

- **Separate from the TypeScript 7 work** (`ts7-rearchitecture`): Node 24 and ESM do not depend on the
  TypeScript decision and can ship first.

## Current Plan

Research details: [analysis-node24-esm.md](analysis-node24-esm.md).

### Phase 1: Node 24 🔄

- ✅ Full Definition of Done on Node `v24.21.0`: build, 757 unit tests, 154 e2e tests (1 skipped), typecheck
  and lint pass with the same counts as Node 20.19.4; no deprecation warnings (analysis A.2)
- ✅ `@types/node` 24 typechecks with 0 errors in all 9 packages (analysis A.4)
- ⏸️ Plan: `.nvmrc`, `node-version` in the three workflows, `@types/node` 24.x, first `engines` field — no code
  changes expected
- 🟡 Decide the supported Node range (see Open Points) — sets `engines` and the CI matrix

### Phase 2: Map ESM support ✅

- ✅ Inventory of CJS-only constructs in `packages/*/src` (analysis B.1)
- ✅ ESM addons through the existing `createRequire` path, tested on Node 20.18 / 20.19 / 22 / 24 (analysis B.2)
- ✅ Bundled CLI with ESM addons, CJS and `"type": "module"` consumers (analysis B.3)
- ✅ ESM consumers and the webpack loader (analysis B.4)
- ✅ Three package-output options with consequences (analysis B.5)

### Phase 3: Implement ⏸️

- 🟡 Choose the package-output option (analysis B.5)
- ⏸️ Write plans per slice. Candidate slices under option 1: discover `.mjs/.cjs/.mts/.cts` addons; compile
  `.ts` addons to output that works in `"type": "module"` projects; clear diagnostic for top-level-await
  addons; ESM addon e2e tests; the same changes in `WebpackAddonService`

## Open Points

- 🟡 Supported Node range: Node 20 reached end of life on 2026-04-30. `engines.node: ">=20.19"` (the
  require(esm) floor) keeps Node 20 in CI; `">=22.12"` or `">=24"` tests 24 only (analysis A.5). Policy call.
- 🟡 Package output: CJS-only with first-class ESM addons (option 1, suggested by the analysis), dual CJS/ESM,
  or ESM-only (analysis B.5).
- ✅ require(esm) vs `import()`: require(esm) is enough for synchronous activation on Node >= 20.19 / 22.12;
  `import()` is only needed for top-level await and for reloading ESM addons (analysis B.2).
- ✅ `createRequire(__filename)` in an ESM build: only matters for options 2 and 3; option 1 keeps it.
- ✅ Webpack loader: same addon gaps as the CLI, in a second implementation (`WebpackAddonService`); an ESM
  loader package would load (analysis B.4).
- ⏸️ Watch mode: ESM addons do not reload after `delete require.cache` — document, or reload via `import()`?
- ⏸️ Should the `.ts`-addon failure in `"type": "module"` projects (a bug today, see Key Findings) become a
  GitHub issue fixed ahead of this story?

## Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-09-24 | Split from the TypeScript 7 story | Independent of the TypeScript decision and shippable on its own (Jan Wloka) |

## Key Findings

### 2026-09-24 — Everything is CommonJS

**Expected:** some ESM groundwork.

**Discovered:** no package sets `"type"` or an `exports` map; all publish `main: lib/index.js`. `core`,
`compiler`, `node` and `example-addons` compile with `module: CommonJS` (the root `tsconfig.json` says
`ESNEXT`, overridden per package). `AddonRegistry` loads addons with `createRequire(__filename)`.

**Impact:** ESM support starts from zero: package output, addon loading and the test toolchain all need
decisions.

### 2026-09-24 — Node 24 needs no code changes

**Expected:** some breakage from Node 24 or `@types/node` 24.

**Discovered:** the full Definition of Done passes on Node 24.21.0 with identical counts to Node 20.19.4, and
`@types/node` 24 typechecks cleanly. The only failure on the way was a stale local `node_modules` in
`packages/node`, which fails on Node 20 as well (analysis A.1).

**Impact:** Phase 1 shrinks to a configuration change plus a support-range decision.

### 2026-09-24 — ESM addons mostly work already; three gaps remain

**Expected:** ESM addons need an async `import()` loader.

**Discovered:** Node's require(esm) loads ESM addons through the existing synchronous `createRequire` path on
Node >= 20.19 / 22.12 / 24, and `"type": "module"` `.js` addons already work with the published CLI. Gaps:
`.mjs`/`.mts` are never discovered; top-level await fails (`ERR_REQUIRE_ASYNC_MODULE`); and a `.ts` addon in
a `"type": "module"` consumer project fails **today** (`exports is not defined in ES module scope`), because
websmith compiles it to CommonJS `.js`. ESM addons also do not hot-reload. Jest 29 cannot load ESM addons
in-process, so coverage belongs in e2e tests (analysis B.1–B.3).

**Impact:** ESM support is mostly addon-loading work, not a package-format migration.

## Session Log

### 2026-09-24 — Story created

Split from `ts7-node24-support` (now `ts7-rearchitecture`) at the author's request, adding ESM support to the
Node 24 scope. Read package manifests, tsconfig module settings and the addon loader.

**Key outcomes:**

- Story created as `draft`
- CommonJS baseline recorded; ESM questions listed under Open Points

### 2026-09-24 — Research for Phases 1 and 2

Ran the Definition of Done on an official Node 24.21.0 binary (scratchpad, not installed system-wide) and on
Node 20.19.4 for comparison; ran ESM addon experiments on Node 20.18, 20.19, 22.14 and 24.21, including the
bundled CLI. Findings in `analysis-node24-esm.md`; review corrected the Node 20 end-of-life date to
2026-04-30. A `pnpm install --frozen-lockfile` refreshed the stale local `node_modules`; the lockfile is
unchanged.

**Key outcomes:**

- Phase 1 ready to plan once the Node range is decided
- Phase 2 mapped; package-output option to be chosen
