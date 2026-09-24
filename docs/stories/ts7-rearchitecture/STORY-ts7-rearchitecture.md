---
title: Re-architecture for TypeScript 7
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

# Re-architecture for TypeScript 7

## Objective

Make websmith (CLI, webpack loader, addon API) work with TypeScript 7 (target: 7.1), and decide how addons keep
working when the TypeScript compiler API they build on changes shape. Node 24 and ESM support are tracked
separately in `node24-esm-support`.

## Why Now

- TypeScript 7 is `latest` on npm (7.0.2); 7.1 is in nightlies (`7.1.0-dev.*`). Consumers upgrading their
  `typescript` dependency will leave websmith's `5.x` peer range behind.

## Decisions Taken in Scoping

- **Story, not plan.** The TypeScript half is research before implementation (the compiler API websmith depends
  on is not exported by 7.x), so no bounded plan can be written yet. Bounded slices become plans under this
  story.
- **Tracker.** No GitHub issue covers this; the story is the umbrella until issues or plans exist.

## Current Plan

### Phase 1: Map the TypeScript 7 API gap ⏸️

- ⏸️ Inventory websmith's use of the `typescript` API (62 non-test source files import it)
- ⏸️ Map each use onto `typescript@7` `./unstable/*` exports (`sync`, `async`, `ast`, `ast/factory`,
  `ast/visitor`, `fs`, `proto`), or record it as missing
- ⏸️ Determine whether custom transformers (`before` / `after` / `afterDeclarations`) exist in 7.x at all
- ⏸️ Check TypeScript 6.x as a stepping stone (still ships `lib/typescript.js`)

### Phase 2: Decide the compatibility strategy ⏸️

- ⏸️ Choose among the options in Open Points and write the implementation plans

## Open Points

- ⏸️ Which TypeScript majors does websmith support after this — 7.x only, or 5.x/6.x and 7.x side by side?
- ⏸️ Does the addon API (`AddonContext.registerTransformer(ts.CustomTransformers)`, `Processor`,
  `Generator`) keep its `ts.*` types, or does it get a websmith-owned abstraction?
- ⏸️ Can the webpack loader keep in-process compilation, or does 7.x's native compiler force an out-of-process
  model?
- ⏸️ `transpileOnly` / `transpileModule` fast path: is there an equivalent in 7.x?
- ⏸️ Does the ESM work in `node24-esm-support` change how addons are loaded here?
- ⏸️ "7.1" is not released yet — target 7.0.x now and re-check at 7.1, or wait?

## Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-09-24 | Track as a story in `docs/stories/`, index in `docs/stories/README.md` | Research-heavy, epic-scale, no ticket; keeps internal tracking off the public README |
| 2026-09-24 | Split off Node 24 + ESM into `node24-esm-support` | Independent of the TypeScript decision and shippable on its own (Jan Wloka) |

## Key Findings

### 2026-09-24 — TypeScript 7 drops the classic compiler API entry point

**Expected:** a major upgrade of the `typescript` package, adapting to API changes.

**Discovered:** per the npm registry, `typescript@5.7.3` and `@6.0.3` ship `main: ./lib/typescript.js` with
typings. `typescript@7.0.2` has no `main` or `types`: its root export is `./lib/version.cjs`, the compiler is
delivered as per-platform native packages (`@typescript/typescript-<os>-<arch>`), and the API lives under
`./unstable/*`. websmith uses `ts.sys` (34×), `ts.CustomTransformers` (18×), `ts.visitEachChild` (11×),
`ts.createPrinter` (11×), `ts.factory` (8×), `ts.transpileModule` (7×), `ts.createCompilerHost` (7×),
`ts.createProgram` (6×), `ts.createLanguageService` (2×) in `packages/*/src`.

**Impact:** support for TypeScript 7 is a re-architecture question, not a version bump. Phase 1 must answer it
before any TypeScript plan is written.

## Session Log

### 2026-09-24 — Story created

Triage: no GitHub issue, no existing story or plan covers the work; overflow signals are research before
implementing and epic scale. Checked the npm registry (TypeScript dist-tags and 5.7.3 / 6.0.3 / 7.0.2
manifests) and Node's release index, and counted `ts.*` API use in the repo.

**Key outcomes:**

- Story created as `draft`; Node 24 identified as an independent, plannable slice
- TypeScript 7 finding recorded; strategy questions listed under Open Points

### 2026-09-24 — Story split

Split at the author's request: this story keeps the TypeScript 7 re-architecture; Node 24 and ESM support moved
to `node24-esm-support`. Renamed from `ts7-node24-support`.

**Key outcomes:**

- Slug `ts7-rearchitecture`; Node 24 phase removed, remaining phases renumbered
