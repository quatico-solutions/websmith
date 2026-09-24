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

Research details: [analysis-ts7-api-gap.md](analysis-ts7-api-gap.md).

### Phase 1: Map the TypeScript 7 API gap ✅

- ✅ Inventory: 62 non-test files, 125 distinct `ts.*` symbols; public addon API coupling listed (analysis 1)
- ✅ Mapped against `typescript@7.0.2` and the `7.1.0-dev.20260924.1` nightly (analysis 2, 4)
- ✅ Custom transformers: missing in 7.0.2 and in the 7.1 nightly; planned as roadmap item 3C, a post-emit AST
  round trip rather than TS 5's `before` phase (analysis 2.5)
- ✅ TypeScript 6.x: same JS API as 5.7.3 (identical exported function names), but 6.0 deprecations are hard
  errors, and websmith hits several of them (analysis 3)

### Phase 2: Decide the compatibility strategy 🟡

- 🟡 Choose among options A–D (analysis 5); C combines with A or B
- ⏸️ Write the implementation plans for the chosen option

### Candidate slice independent of the strategy

- ⏸️ Clear the TypeScript 6.0 deprecation hits (`esModuleInterop: false` and `strict: false` defaults,
  `Classic` resolution for addon compilation, ES3/ES5/AMD/UMD/System tables, repo tsconfigs using
  `moduleResolution: "node"` and `downlevelIteration`, the `--outFile` CLI flag) — needed by options A, B and D

## Open Points

- 🟡 Strategy: A (stay on 6.x, wait for a stable 7.x API), B (dual backend adapter), C (websmith-owned AST and
  types in `packages/api`, combines with A or B), D (7.x only, out of process). See analysis 5.
- 🟡 Which TypeScript majors does websmith support after this? Answered per option (analysis 5).
- 🟡 Addon API: keep `ts.*` types or introduce websmith-owned ones? Only option C removes them; `packages/api`
  also imports `typescript` at runtime (`DiagnosticMessage.ts:7`).
- ✅ In-process webpack loader: impossible on 7.x — the API always runs the native compiler out of process over
  IPC; it stays possible on 5.x/6.x (analysis 2.2).
- ✅ `transpileOnly` fast path: 7.1 nightly has `transpileModule`, but without a `transformers` option
  (analysis 2.4).
- 🟡 Target version: 7.1 is unreleased; the 7.0 blog says 7.1 ships "a new (and different) API". Tools that
  need the API today are pointed at `@typescript/typescript6` (analysis 2.5).
- ⏸️ Will 7.1 GA ship custom transformers (roadmap 3C), and in which phase?
- ⏸️ IPC cost of per-file `transpileModule` / `getJavaScriptEmit` for webpack workloads — worth measuring.
- ⏸️ Does the ESM work in `node24-esm-support` change how addons are loaded here? (It keeps CJS loading under
  its suggested option 1.)

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

### 2026-09-24 — No transformers, no in-process API in TypeScript 7

**Expected:** 7.x exposes the compiler API under a new path.

**Discovered:** the 7.x API runs the native compiler in a separate process (MessagePack or JSON-RPC over
stdio). 7.0.2 offers project snapshots, diagnostics, checker queries and `printNode`, but no emit, no
`transpileModule` and no parser. The 7.1 nightly adds `createProgram`, `createSourceFile`, `transpileModule`,
per-file emit and a printer. Neither has custom transformers, a language service with emit output, a watch
API, or a `ts.System` host; browser execution is impossible. Microsoft's roadmap (microsoft/TypeScript#63875)
plans transformers as a post-emit AST round trip and treats watch as out of scope.

**Impact:** websmith's transformer addons, watch mode, browser system and in-process loader have no 7.x
counterpart yet. TypeScript 6.x keeps the full API (also as `@typescript/typescript6`), so the strategy
decision is about timing and addon-type ownership.

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

### 2026-09-24 — Research for Phase 1

Downloaded `typescript` 5.7.3, 6.0.3, 7.0.2 and the 7.1 nightly from the npm registry (outside the repo) and
read their typings; read the TypeScript 6.0 and 7.0 announcements and the API roadmap issue. Findings in
`analysis-ts7-api-gap.md`; review spot-checked the websmith call sites, `@typescript/typescript6` and the
7.1 nightly's `TranspileOptions`.

**Key outcomes:**

- Phase 1 complete; four strategy options described
- A TypeScript 6.0 deprecation clean-up is useful under every option except C alone
