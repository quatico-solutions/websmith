<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# Panel: esm-output-check

- **Subject:** `docs/plans/2026-09-24-esm-output-check.md` (Draft, branch `idea/esm-output-check`, PR #112)
- **Date:** 2026-09-24
- **Commitment:** `Verdict: proceed | amend | reject`
- **Jurors:** addon author / client, compiler pipeline, webpack loader & performance, ESM / Node semantics
- **Gate:** `plot-panel.mjs check` — all four committed; `reconcile` → **unanimous: amend**

## Process notes

- Subagents here may not write files, so each juror returned its verdict as text and the moderator saved it
  verbatim to `<lens>.md` before gating. Two deviations, both mechanical: the webpack juror was refused once
  (its only position line was bold) and resubmitted unchanged with a plain line; in `compiler-pipeline.md` an
  HTML entity from transport (`=&gt;`) was saved as `=>`.
- **What each juror looked at:** addon author, compiler pipeline and webpack loader read the plan, the story and
  the code (file:line citations). The ESM juror also **ran experiments** on Node 24.21.0 and webpack 5.97.1
  (from the repo's `node_modules`) — its findings on runtime behaviour are measured, the others' are read.

## Where the jurors converge

Raised independently by two or more jurors; each is a change to the plan, not an opinion about it.

| Finding | Jurors | Evidence |
|---------|--------|----------|
| No definition of how an emitted file is classified as ESM or CJS; every rule depends on it | addon author, ESM | Node: extension → `"type"` → syntax detection; webpack: module rule type |
| "Emitted" ≠ "written": under `addonEmitOnly`, `processOutput` returns unwritten files and `.d.ts`/`.map` | compiler, webpack, ESM | `Compiler.ts:789-799`, `:626-640` |
| The check must be a shared function over output files, not code inside `emitResult` — the loader and `watch()` never call `emitResult` | compiler, webpack | `TsCompiler.ts:120`, `Compiler.ts:195-215`, `:668-678` |
| "Error" changes nothing today: the CLI ignores the result, the loader's `error`/`warn` default to no-ops, loader addon failures become warnings | compiler, webpack, addon author | `command.ts:169`, `TsCompiler.ts:30-31`, `:211-213` |
| Diagnostics are dropped or unlocated (`files.length` branch, `cur.file` filter, no `SourceFile` for emitted JS) | compiler, addon author | `Compiler.ts:600`, `:626-633`; `DiagnosticMessage.ts:15-32` |
| Transformers carry no addon attribution | addon author, compiler | `CompilationContext.ts:229-235` |
| Files written by result processors have no observation hook; direct `fs` writes stay invisible | all four | `emit-metadata-result-processor/addon.ts:81` |
| The flat `bundler` column is wrong: webpack's `javascript/auto` allows `require`/`__dirname`; `javascript/esm` enforces `fullySpecified` | webpack, ESM (measured) | ESM juror's webpack 5.97.1 runs |
| `depends` inheritance and `esm` vs `module: CommonJS` must be decided before Wave 1 ships the key | addon author, ESM | — |
| `esm-check-webpack` is not a Wave 2 peer; it depends on the other rule slices | webpack, compiler, ESM | — |

## Where they disagree — named, not averaged

1. **Import resolution in the loader.** The ESM juror wants resolution through webpack's resolver
   (`this.getResolve()`). The webpack juror wants the rule **dropped** in the loader, leaving the failure to
   webpack. The moderator verified the loader is fully synchronous (`loader.ts:21-35`, no `this.async()`), so
   `getResolve()` means converting the loader to async — a change with its own risk to caching and the
   compilation queue. The disagreement is real: *extend the loader's contract, or narrow the rule*.
2. **Cost vs correctness of the parser.** The webpack juror budgets one `ts.createSourceFile` per output as
   cheap. The ESM juror shows that shape-matching produces false positives on the standard ESM migration
   pattern (`const require = createRequire(import.meta.url)`) and requires a binder or a Program over the JS.
   Both are right; the plan must choose which cost it pays, and the performance measurement the webpack juror
   asks for has to measure the *binder*, not the parse.
3. **Scope: grow or trim.** The ESM juror adds rules (default-import interop, JSON import attributes, `exports`
   subpaths, tsconfig `paths`). The compiler juror says the plan already over-claims coverage and asks for a
   coverage table that marks paths *not* covered. These pull in opposite directions; a v1 rule list with an
   explicit "not in v1" column reconciles them without averaging.
4. **Watch mode.** Only the compiler juror raises it (`watch()` bypasses `emitResult`). Nobody disputes it; it
   needs an explicit in/out decision.

## Shared blind spot

All four jurors, and the plan, assume the check is **built on the TypeScript 5 compiler API**: the webpack
juror budgets `ts.createSourceFile`, the compiler juror asks for a `ts.SourceFile` on every diagnostic, the ESM
juror asks for a binder or Program. The sibling story `ts7-rearchitecture` found that TypeScript 7 exposes none
of this in-process (`analysis-ts7-api-gap.md`, sections 2.2–2.4). The plan names the coupling only in one Open
Point; no juror weighed it. A check that deepens the dependency on `ts.*` becomes part of the TypeScript 7
migration cost. Decide it deliberately: an independent JS parser/scope analyser, or a TS-based check with the
TS 7 cost recorded.

A second, smaller one: every juror evaluated a **static** check. Nobody asked whether, for `runtime: "node"`, a
**dynamic** check — loading the emitted entry points with Node's own loader in a child process — would be
definitive where static rules are approximate (the ESM juror's measured false positives and negatives are the
case for it). It may be too slow or side-effectful; it was not considered.

## What the plan needs before approval

1. A **module classification** decision per runtime; every rule keys off it.
2. A **file set** definition: the written set (new return from `processOutput`), JS extensions only; say whether
   `ResultProcessor`s keep today's list.
3. The check as a **shared function** over output files, called from `emitResult`, the loader, and (if in scope)
   `watch()`; diagnostics added to `result.diagnostics` with a location.
4. What **error** does: non-zero CLI exit, failed webpack build via `this.emitError`.
5. A rewritten **rule table** keyed on classification (webpack `auto` vs `esm`), scope-aware CommonJS detection,
   and a v1 / not-in-v1 split for the ESM juror's added rules.
6. Decisions on **loader resolution** (async loader vs dropped rule), **parser** (with its TS 7 cost),
   **attribution** (tag transformers or name the addon set), **result-processor writes** (hook or out of scope),
   `depends` inheritance, and `esm` vs `module` validation.
7. **Re-sliced waves:** core (config, classification, file set, shared check, reporting) → rules (resolution;
   CJS named imports via `cjs-module-lexer` as its own slice; package type; TS nodenext) → webpack.

Nothing here is acted on by the panel. `/challenge-the-plan` or the plan author decides.
