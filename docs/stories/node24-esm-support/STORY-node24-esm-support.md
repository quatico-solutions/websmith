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

### Phase 1: Node 24 ⏸️

- ⏸️ Candidate plan: `.nvmrc`, the three CI workflows, `@types/node` (pinned `20.19.9`), `engines`
- ⏸️ Run the full Definition of Done on Node 24
- ⏸️ Decide whether CI tests Node 20 and 24 side by side or moves to 24 only

### Phase 2: Map ESM support ⏸️

- ⏸️ Package output: CommonJS only, dual CJS/ESM, or ESM only
- ⏸️ Addon loading: ESM addons (`"type": "module"`, `.mjs`, `.mts`) through `AddonRegistry`
- ⏸️ Toolchain: Jest (`ts-jest`), webpack bundling of the compiler, `license-check`

### Phase 3: Implement ⏸️

- ⏸️ Write plans per slice once Phase 2 has settled the shape

## Open Points

- ⏸️ Which Node versions stay supported — does Node 20 remain in `engines` and CI?
- ⏸️ Dual publishing or ESM only? Dual publishing adds `exports` maps and two builds per package.
- ⏸️ Node 24 can `require()` ES modules; does that make ESM addons work through the existing
  `createRequire` path, or is a dynamic `import()` needed (async activation)?
- ⏸️ `AddonRegistry` uses `createRequire(__filename)`; `__filename` does not exist in an ESM build.
- ⏸️ How does the webpack loader resolve ESM addons and ESM `websmith.config` consumers?

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

## Session Log

### 2026-09-24 — Story created

Split from `ts7-node24-support` (now `ts7-rearchitecture`) at the author's request, adding ESM support to the
Node 24 scope. Read package manifests, tsconfig module settings and the addon loader.

**Key outcomes:**

- Story created as `draft`
- CommonJS baseline recorded; ESM questions listed under Open Points
