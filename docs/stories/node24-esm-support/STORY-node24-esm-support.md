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

Run and test websmith on Node 24, and support ES modules: consuming websmith packages from ESM projects,
loading addons written as ES modules, and — most important for clients — guaranteeing that the code websmith
compiles and addons generate for a client is ESM compatible. When it is not, the compilation must report it,
instead of succeeding and failing at runtime.

## Why Now

- Node 24 is the active LTS (`v24.21.0`, "Krypton"); the repo pins Node 20 in `.nvmrc` and in all three GitHub
  workflows (`pull-request.yml`, `protect-stable.yml`, `release-and-publish.yml`).
- Every websmith package is CommonJS today, while consumers and addon authors increasingly write ESM.
- Most websmith clients get generated code from addons, and that code now has to run as ESM.

## Decisions Taken in Scoping

- **Separate from the TypeScript 7 work** (`ts7-rearchitecture`): Node 24 and ESM do not depend on the
  TypeScript decision and can ship first.
- **Client output is the priority** (Jan Wloka, 2026-09-24): how websmith's own packages are published is
  secondary; what matters is that client builds produce ESM-compatible code, or fail the build saying why.

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

### Phase 2b: ESM compatibility of client output ⏸️

Requirement: a client compilation whose output (including processor, transformer and generator output) is
not ESM compatible reports a diagnostic at compile time.

- ✅ "ESM compatible" is set **per profile**: a profile declares its runtime — Node's ESM loader (strict:
  explicit `.js` extensions, no `require` / `module.exports` / `__dirname`, CJS named-import limits) or
  bundler ESM (webpack; lenient) — and websmith applies the matching rules
- ⏸️ Map which checks TypeScript already gives (with `module: node16/nodenext`) and on which websmith paths
  they run today (see Key Findings: none on transformer output, none in `transpileOnly`)
- ⏸️ Design websmith's own check on the **emitted** JavaScript, so it covers every path, e.g.: CommonJS
  constructs in ESM output; relative specifiers without extension or not resolving to an emitted file;
  output module format vs the nearest `package.json` `"type"`; `.cjs`/`.mjs` naming; top-level await
  targets; imports of CJS packages by name
- ✅ Severity: **error** by default for ESM targets; a profile can downgrade to a warning or disable the check
- ✅ Rule sources: all three — (1) websmith's check on the emitted JavaScript, on every path; (2) TypeScript's
  `node16`/`nodenext` diagnostics where a Program exists; (3) output format and `.cjs`/`.mjs` naming vs the
  nearest `package.json` `"type"`
- ⏸️ Interaction with `addonEmitOnly` and `ResultProcessor`s
- ⏸️ Config shape: the profile key(s) for the runtime and the severity
- ⏸️ Candidate e2e fixtures: an addon that generates `require(...)`, one that generates an extensionless
  relative import, one that emits CJS into a `"type": "module"` package
- 🔄 Planned as `esm-output-check` ([PR #112](https://github.com/quatico-solutions/websmith/pull/112)): panel
  round (unanimous amend) and six interrogation rounds; 4 waves, 6 slices
- ⏸️ Not in v1 of the check, tracked here: bare-specifier subpaths a package's `exports` map does not allow,
  directory and extensionless subpaths without one, tsconfig `paths` aliases left in emitted specifiers

### Phase 3: Implement ⏸️

- 🟡 Choose the package-output option (analysis B.5)
- ⏸️ First: fix [#111](https://github.com/quatico-solutions/websmith/issues/111) (`.ts` addons in
  `"type": "module"` projects) as its own plan
- ⏸️ Write plans per slice. Candidate slices: the per-profile ESM check (Phase 2b); discover
  `.mjs/.cjs/.mts/.cts` addons; clear diagnostic for top-level-await addons; ESM addon e2e tests; the same
  addon changes in `WebpackAddonService`

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
- ✅ "ESM compatible" is configured per profile (Node ESM or bundler ESM) → See Decisions
- ✅ A failed check is an error with a per-profile opt-out → See Decisions
- ⏸️ Invalid `tsconfig.json` options probably still exit 0 after `esm-output-check` wave 1: their errors are carried
  in `cliArgs.errors` (`parsed-command-line.ts:140`, `ResolvedCompilerOptions.ts:131`) and never reach the
  reporter, so the exit code cannot see them (review of `feature/cli-exit-and-written-set`, low confidence)
- ⏸️ Errors without a file ("Cannot find type definition file", other global diagnostics) are filtered out before
  the reporter unless the project uses project references (`Compiler.ts:603`), so they neither print nor fail the
  build; behaviour predates wave 1 (same review, low confidence)
- ⏸️ Watch mode: ESM addons do not reload after `delete require.cache` — document, or reload via `import()`?
- ✅ The `.ts`-addon failure in `"type": "module"` projects is filed as
  [#111](https://github.com/quatico-solutions/websmith/issues/111), to be fixed ahead of this story as its own plan

## Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-09-24 | Split from the TypeScript 7 story | Independent of the TypeScript decision and shippable on its own (Jan Wloka) |
| 2026-09-24 | Client output must be ESM compatible; websmith reports incompatibility at compile time | Clients get generated code from addons; without a compile-time check it builds and fails at runtime (Jan Wloka) |
| 2026-09-24 | "ESM compatible" is configured per profile: Node ESM or bundler ESM | Clients run generated code in Node and through webpack; one rule set cannot serve both (Jan Wloka) |
| 2026-09-24 | ESM check failures are errors by default, with a per-profile downgrade or opt-out | Compile-time failure is the point; the opt-out allows gradual migration (Jan Wloka) |
| 2026-09-24 | Check sources: emitted-JS check, TypeScript `nodenext` diagnostics, `package.json` `"type"` consistency | Only the emitted-JS check covers transformer output and `transpileOnly`; the others add precision where available (Jan Wloka) |
| 2026-09-24 | File the `.ts`-addon bug as #111 and fix it ahead of the story | It breaks ESM projects today, independent of the story's other work (Jan Wloka) |

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

### 2026-09-24 — ESM problems in client output go unreported on most paths

**Expected:** TypeScript's diagnostics catch ESM problems in client code.

**Discovered:** websmith only reports what TypeScript checks, and on several paths TypeScript checks nothing:
transformer output is produced during emit, after type checking, in every mode; `transpileOnly` and the
`transpileModule` fast path report no semantic diagnostics (`Compiler.ts:597-604`); the language-service path
reports syntactic diagnostics only (`Compiler.ts:968`, `984`); processor output is type-checked in full
compilation only. Even where checking runs, TypeScript enforces Node's ESM rules only under
`module: node16/nodenext`, not under `esnext` + `bundler` resolution.

**Impact:** ESM compatibility needs a websmith-owned check on the emitted JavaScript (Phase 2b), not just
TypeScript settings.

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

### 2026-09-24 — Requirement: ESM-compatible client output

Jan Wloka: most clients get generated code through addons, and that code now has to be ESM compatible; the
compiler must tell a client run when its code is not, instead of compiling and failing at runtime. Added
Phase 2b, the decision, and the open question of what "ESM compatible" means for clients. Checked which
diagnostics websmith reports on each compilation path.

**Key outcomes:**

- Client-output compatibility is now the story's priority; package publishing format is secondary
- Phase 2b drafted; needs the "Node ESM vs bundler ESM" answer before design

### 2026-09-24 — Phase 2b decisions

Jan Wloka answered the Phase 2b questions: ESM compatibility per profile (Node ESM or bundler ESM); errors by
default with a per-profile opt-out; all three check sources. Filed the `.ts`-addon bug as
[#111](https://github.com/quatico-solutions/websmith/issues/111).

**Key outcomes:**

- Phase 2b scope settled; open: config shape, and interaction with `addonEmitOnly` / `ResultProcessor`s
- #111 becomes the first plan, ahead of this story

### 2026-09-24 — `esm-output-check` panel and interrogation

Panel of four jurors (addon author, compiler pipeline, webpack loader, ESM semantics), unanimous `amend`;
moderation in `.plot/panels/2026-09-24-esm-output-check/panel.md`. Six `/challenge-the-plan` rounds with
Jan Wloka settled module classification, parser (`ts.createSourceFile` plus a websmith scope walk, TS 7 cost
recorded), failure semantics (non-zero CLI exit, webpack `emitError`), the rule table per runtime, coverage,
attribution, the performance budget and the slices.

**Key outcomes:**

- Plan ready for review in PR #112; the CLI exit-code change ships as its own first slice
- Three Node ESM failure classes deferred beyond v1 (listed in Phase 2b)

### 2026-09-25 — Follow-ups from the wave 1 review

The code review of `feature/cli-exit-and-written-set` (APPROVE, no blockers) found two error paths that the new
exit code cannot see because the errors never reach the reporter: invalid `tsconfig.json` options and diagnostics
without a file. Both predate the change; recorded as open points.

### 2026-09-25 — Fast path ignores `"type"` under `nodenext`

Research for `esm-check-package-type` measured that `ts.transpileModule` (the fast path and `transpileOnly`) never
reads `package.json`: with `module: nodenext`/`node16` every `.ts` file emits CommonJS, including files under
`"type": "module"` (TypeScript 5.7.3). websmith passes no format hint (`Compiler.ts:1111`, `:823`/`:835`). The ESM
check reports it (91032); fixing the emit itself is open.

### 2026-09-25 — Config errors print twice on the CLI

Found by wave 2's end-to-end test. The CLI resolves `websmith.config.json` twice: once in `createOptions`
(`packages/core/src/compiler/options/options.ts:34`), and again in `new Compiler` (`setOptions` →
`ResolvedCompilerOptions` → `loadCompilationConfig`, `ResolvedCompilerOptions.ts:106`, `:416`). Every config error
therefore prints twice. That covers the new `esm`/`module` error and, already today, the `depends` error. The
webpack loader does the same (`packages/webpack/src/options.ts:54`). Decided 2026-09-25 to fix this separately; wave
2's test asserts one distinct message.

### 2026-09-25 — Known gaps in the relative-import rules (esm-check-imports review)

Accepted for v1; each is a real Node failure that the rules do not report:

- **Query or encoded specifiers.** `./b.js?v=1` and `./my%20file.js` report 91012 although Node 24 loads them; the
  specifier is resolved as a plain path.
- **Bare JSON imports.** `import d from "pkg/d.json"` gets no 91013, because the rule covers relative specifiers
  only.
- **`import()` in CommonJS files.** A dynamic `import("./b")` in a `.cjs` file uses ESM resolution and fails the same
  way under Node. The rules check ESM-classified files only.
- **Lenient `auto` resolution under `bundler`.** It accepts any directory and `.js`/`.mjs`/`.cjs`/`.json`, so
  `./dir` without an index file is not reported.

### 2026-09-25 — Wave 3 verification follow-ups

- **UMD free references in ESM files.** A typeof-guarded UMD wrapper in an ESM-classified file still lists free
  `require`/`exports` inside it, which gives 91001/91002. This is carried over from wave 2.
- **Shadowing in 91021.** A local variable that shadows the default binding, or a use such as `typeof pkg`, still
  counts as a value use. That can give a false 91021; it never misses a real one.
- **In-place transformer edits.** Transformers that edit nodes in place (`addSyntheticLeadingComment`,
  `setEmitFlags`) are not attributed. The plan's claim that "no changing transformer is missed" does not hold for
  them.
- **Plan vs. brief on attribution fallback.** The plan (§ Diagnostics) says a diagnostic lists the profile's active
  addons when attribution is unclear. The brief and the implementation list the addons that changed the file, or
  none. The implementation follows the brief.
- **Duplicate watch diagnostics for generator-added files.** `registerWatch` (`Compiler.ts`) adds another watcher each
  time a generator re-adds a file with `addInputFile`, so every change is reported once per watcher. This predates
  the ESM check: without `esm`, the file is written twice. Separately, the first watch build does not emit a file
  that a generator added this way.
- **Nested compiles through the context's system are checked twice.** A result processor that runs a nested
  websmith compile through `ctx.getSystem()` has that compile's output checked by both compiles.
