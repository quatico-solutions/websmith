<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# Panel: esm-check-precision

- **Subject:** `docs/plans/2026-10-02-esm-check-precision.md` (Draft, branch `idea/esm-check-precision`, PR #137)
- **Date:** 2026-10-02
- **Commitment:** `Verdict: proceed | amend | reject`
- **Jurors:** addon author, bundler runtime and the webpack loader, Node.js ESM semantics
- **Gate:** `plot-panel.mjs check` — all three committed; `reconcile` → **unanimous: amend**

## Process notes

- The jurors ran on Sonnet and wrote their own verdict files (`addon-author.md`, `bundler.md`, `node-semantics.md`);
  the moderator changed nothing in them. All three files pass the gate.
- The moderator re-ran `check` and `reconcile` on the files as committed: unanimous `amend`.
- **What each juror looked at:**
  - *Node semantics* **executed** fixtures on Node v24.21.0 for every item with a Node side (UMD, query / fragment /
    percent, bare JSON, `import()` in `.cjs`, exports, conditions, self-reference); it did not build websmith, so the
    plan's CLI reproductions are taken as given.
  - *Bundler* **executed** an `enhanced-resolve` probe (webpack 5.97.1's resolver) with webpack's defaults, with and
    without `fullySpecified`; read the loader code.
  - *Addon author* only **read** the plan and the attribution code (`CompilationContext.ts:412-445`,
    `Compiler.ts:726-783`, README).
- The moderator verified the bundler juror's central reading: `TsCompiler.ts:317` sets
  `importRules: esm.runtime === "node" ? NODE_IMPORT_RULES : []`, and `NODE_IMPORT_RULES` (`:46`) holds 91010, 91011,
  91013 only.

## Where the jurors converge

| Finding | Jurors | Evidence |
|---------|--------|----------|
| After query stripping, 91013 (`/\.json$/i` on the written specifier) and 91010's extension test must use the **resolved** path, or `./d.json?v=1` stays missed | bundler, Node (measured `ERR_IMPORT_ATTRIBUTE_MISSING` with a query) | `import-rules.ts:117-118` |
| 91024 (`paths` alias) must not fire on specifiers satisfied another way: Node `imports` (`#x`), package self-reference, workspace symlinks | Node (measured self-reference loads), addon author | — |
| The `node`-only decisions for `import()` in CJS and for package subpaths are right; under `bundler` they would be false positives | all three | webpack `fullySpecified` applies to `javascript/esm` only (`defaults.js:721,781`) |
| The bundler directory rule as worded ("`main` names such a file") produces false positives | bundler (probed: `module`-only, extensionless `main`, directory `main` all resolve), addon author | — |
| The `typeof pkg` open point: keep reporting under `node`; fix the README wording | all three | Node gives `"object"` only for `__esModule` + `exports.default` (measured) |
| Slice order is sound (shared `import-rules.ts`) | all three | — |

## Where they differ — named, not averaged

1. **The bundler directory rule: widen or soften.** The bundler juror wants the accept set widened (any directory
   with an `index.*` from the lenient list, or a `package.json` with a string `main`, `module` or `browser`) and the
   rule kept as an error, with README text that it is a heuristic. The addon author wants the rule at `warn` severity
   (or a `mainFiles` hint in the message), because `check: "error"` is the default and authors cannot fix third-party
   output. These are different contracts for the same rule; the plan must choose. The two do compose (widen *and*
   warn), but that is a decision, not an average.
2. **Item 7 (in-place transformer edits).** The plan recommends (a) emit-node comparison, gated on a pre-check. The
   addon author argues the pre-check answers itself: `addSyntheticLeadingComment` / `setEmitFlags` cannot add a
   `require`, specifier or default import, and a transformer that adds code builds new nodes, so `output !== input`
   already attributes it — decide (c) now, keep the pre-check as evidence, and make the e2e assert the documented
   non-attribution. The other jurors did not weigh it. A real choice between per-file cost and a documented gap.
3. **`#` handling: Node vs webpack.** Node (measured): a file literally named `a#b.js` is unreachable with `#`
   (needs `%23`). Bundler (probed): webpack resolves `a#b.js` as written, so a strip-first `bundler` path creates a new
   false positive; probe as written first, stripped second. Not contradictory — the runtimes differ — but the plan's
   single sentence "strip `?…` and `#…`" is wrong for one of them.
4. **The loader claim.** Only the bundler juror found that the plan's "items 1–5 reach the loader, its e2e suite gets
   a case per changed rule" is false under `bundler`, and that slice 1's named webpack e2e for `?query` cannot fail
   before the change. The real before/after loader cases are items 1, 2, 4 and 5 under `node`. Undisputed.
5. **91022 certainty.** Only the Node juror measured that `exports` with only a `development` condition loads under
   `node --conditions=development`; 91022 is certain only when the check's conditions equal the runtime's.
   Recommendation: silent when the profile sets custom conditions, and decide whether subpath `"."` is in scope.
6. **Nested compiles (item 9).** Only the addon author: a symbol on the system object is lost when an addon wraps or
   copies `ctx.getSystem()` for the nested compile; test that case, and state that nested findings name only the nested
   profile's addons.

## Shared blind spot

Every lens — including "addon author" — judged rule **correctness** against a runtime. None asked how a project
**adopts** the change: the plan adds three new error codes (91022–91024) and a stricter directory rule, all at the
default `check: "error"`, in a release that already turned on the check. A project that passed 0.10.0 can fail the
next minor on code that worked; the jurors weighed false-positive *risk* per rule but not a rollout rule (new codes
start as warnings for one release, or a Release-Notes "builds that passed may now fail" line). The addon author's
severity point is the closest; it was made for one rule, not as policy.

## Cross-plan conflicts

- **#132 `vite-plugin`** inherits whichever import rules a non-webpack bundler host runs; this panel's finding that the
  loader runs **no** import rules under `bundler` should be stated there, and the Vite host's rule set decided against
  this plan's outcome.
- **#134 `loader-options-once`** does not touch `NODE_IMPORT_RULES`; correct. If this plan adds a rule to the loader's
  list, `TsCompiler.ts:46` is an edit both plans touch — say "no change" or list the edit.
- **#136 `cli-error-exit-gaps`** owns the duplicate watch diagnostics this plan excludes; no conflict.
- **TS 7 story:** no new overlap from these lenses; the scope-aware 91021 walk reuses `scanModule`'s rules rather than
  adding TypeScript-API use.

## What the plan needs before approval

1. **Correct the loader claim:** under `bundler` the loader runs no import rules; item 6 is CLI-only; name the real
   loader before/after cases (items 1, 2, 4, 5 under `node`) and drop or replace the `?query` webpack e2e.
2. **Slice 1:** 91013 and 91010 test the resolved path; `bundler` probes the specifier as written before stripping
   `?` / `#`; `node` keeps the URL resolution (with the `%2F` / `%5C` note).
3. **Directory rule:** widen to `index.*` or any string `main` / `module` / `browser`, and decide its severity; README
   says it is a heuristic with `esm.ignore` / `check: "warn"` as escapes.
4. **Package subpaths:** 91022 silent under custom conditions (decide `"."`); 91024 tries self-reference, `imports` and
   workspace symlinks before reporting; specify messages and fix hints for 91022–91024 (`.js` vs `/index.js`).
5. **Decide item 7** now (the addon author's (c), with the pre-check as evidence and an e2e that pins it) and the
   wrapped-system case for item 9.
6. **Fix the `typeof pkg` wording** (the `__esModule` case) and record whether 91021 reports it under `bundler`.
7. **State a rollout rule** for new error codes and the stricter directory rule (warning first, or a Release-Notes
   "builds that passed may now fail" line).

Nothing here is acted on by the panel. The plan author amends; `/challenge-the-plan` or `/plot-approve` follows.
