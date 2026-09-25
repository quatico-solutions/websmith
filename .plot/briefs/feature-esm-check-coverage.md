<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — esm-output-check (wave 3: coverage)

- **Plan (canonical):** `docs/plans/2026-09-24-esm-output-check.md` on `develop`
- **Approved:** 2026-09-25, Jan Wloka, plan-PR #112 merged (slice added 2026-09-25, in-session)
- **Branch:** `feature/esm-check-coverage` (base: `develop`) — claimed 2026-09-25 after wave 2 (#119) merged; worktree `.worktrees/feature-esm-check-coverage`.
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh`; do not merge
- **Review of the code:** per repo convention; CI green

Runs in parallel with the other wave 3 slices (`esm-check-imports`, `esm-check-cjs-names`,
`esm-check-package-type`), which add rules to `checkEsm`; this slice adds *call sites* and *attribution* and
touches no rule. Wave 4 (`esm-check-webpack`) reuses the attribution.

Line numbers were taken before wave 2 merged. Wave 2 rewrote `emitResult` around the `checkEsm` call, so re-find
the loops by name. Amended 2026-09-25 after wave 2's review, see "Carried over from wave 2" below.

### What to build

After wave 2, the ESM check runs only in the CLI's `compile()` (`Compiler.emitResult`) and names the profile's
active addons rather than the one that produced the construct. This slice closes three gaps:

1. **`watch()`** — `watch()` and its file callback call `emitSourceFile` directly and never reach `emitResult`
   (`Compiler.ts:197-216`, `:668-678`), so a watch rebuild is never checked. Call `checkEsm` per rebuilt fragment
   on its `writtenFiles` and report through the reporter. Watch never exits on an error.
2. **JavaScript written by `ResultProcessor`s** — they write through `ctx.getSystem().writeFile`
   (`CompilationContext.ts:93`; e.g. `example-addons/src/emit-metadata-result-processor/addon.ts:81`). Wrap that
   `writeFile` around the `ResultProcessor` loop (`Compiler.ts:640-646`), collect `.js`/`.mjs`/`.cjs` writes, and
   run `checkEsm` on them after the loop. Files written with `fs` directly are not visible; document that.
3. **Per-addon attribution** in `CompilationContext` — a map from file to the addon(s) that changed it, next to
   today's `addonProcessedFiles` set (`CompilationContext.ts:50`), which stays for `addonEmitOnly`:
   - **processors:** compare content per processor inside the loop (`Compiler.ts:455-467` compares only the
     combined result today) and record the addon of each processor that changed it (`ctx.getAddonName`);
   - **generators:** record the current addon where `addInputFile` / `addVirtualFile` mark files
     (`CompilationContext.ts:145-148`, `:200-203`);
   - **transformers:** `registerTransformer` (`CompilationContext.ts:230-235`) records no addon and merges all
     factories. Wrap each `TransformerFactory` with the current addon name: the wrapper records `sf.fileName`
     when the transformer returns a node that is not the input `SourceFile`.

   `checkEsm` diagnostics then name the addon when exactly one changed the file, otherwise list the addons that
   did, otherwise (no addon changed it) name none — the construct came from the client's own source.

### Settled decisions — do not re-derive them

- **Transformer attribution by wrapping factories, by node identity.** TypeScript returns the same node when a
  transformer changes nothing (`visitEachChild` preserves identity), so identity is a free signal. Rejected:
  re-emitting once per transformer addon when a diagnostic is found (exact, N emits per failing file) and
  attributing every transformer addon (imprecise). Accepted cost: a transformer that rebuilds nodes without a
  real change is over-attributed; no changing transformer is missed.
- **Keep `addonProcessedFiles`.** `addonEmitOnly` depends on it; the new map is additional.
- **The wrapper must be transparent.** It returns exactly what the wrapped transformer returns and wraps all
  phases (`before`, `after`, `afterDeclarations`); the `addonEmitOnly` output comparison
  (`Compiler.ts:812-842`, `:951-962`, `:1060-1084`) must give the same results as before.
- **Watch reports, never exits.** Wave 1 made `compile()` set the exit code; `watch()` keeps running.
- **Direct `fs` writes stay out of scope** (documented, not detected).

### Carried over from wave 2 — the same rules apply at the new call sites

Wave 2's review settled the following. Each new call site (`watch()` and the `ResultProcessor` writes) must behave
exactly like `emitResult`:

- **Skip non-ESM profiles.** A profile whose effective `module` is not ESM gets one config error and no per-file
  check. Reuse wave 2's helper; do not re-derive it from `tsConfig.module`.
- **Read `esm` from the profile's own config, never through `depends`.**
- **Go through `checkEsm` itself.** It filters `esm.ignore` and handles `check: "warn"`/`"off"`. Do not reimplement
  either around it.
- **Pass through `EsmCheckContext.onDependency`, which wave 2 added.** The CLI does not need it; wave 4 does, so no
  call site may drop it.
- **Cached, unchanged fragments return an empty written list** (`Compiler.ts:430`, `:443`).
  - For `watch()` that is correct: only the rebuilt fragment is checked.
  - A second `compile()` on the same `Compiler` instance therefore re-checks nothing. Leave that alone and do not
    work around it here; wave 4 has to decide it for the loader.
- **Wave 4 needs an activation API.** `WebpackAddonService.applyAddonsToContext` activates addons without setting the
  current addon (`WebpackAddonService.ts:113-122`), so attribution recorded through `currentAddonName`
  (`CompilationContext.ts:278-285`) would read "unknown" in the loader. Expose the attribution entry point as a small
  public method on `CompilationContext` (e.g. `runAsAddon(name, fn)`), and make `activateAddon` use it, so wave 4 can
  call it from the loader. Wave 4 does the loader side.
- **Overlap with `esm-check-package-type`.** That slice changes `Compiler.report()` and its call. This slice owns
  the processor loop, the `ResultProcessor` loop and `watch()`. The second to merge resolves any conflict.

### Done when

Assertions that exist because a naive implementation would pass without them:

- Two processors from two addons, only the second changes the file → the diagnostic names **only** the second
  (catches recording on the combined before/after).
- Two transformer addons, one returns its input unchanged → only the changing addon is recorded (catches
  attributing every transformer addon).
- A file no addon changed that contains a construct from the client's source → the diagnostic names no addon
  (catches falling back to "all profile addons").
- `addonEmitOnly` output and `writtenFiles` are unchanged by the wrapping (existing addonEmitOnly suites green;
  add one with two transformer addons).
- `watch()`: a rebuild that introduces `require(…)` into a `node` ESM profile reports 91001 and does not end the
  watcher (use the in-memory system's `watchFile` from the existing watch tests).
- A `ResultProcessor` that writes a `.js` file with `module.exports` into an ESM profile's output → 91002/91004
  reported for that file; a `.json` it writes is not parsed.
- `watch()` on a profile with `esm` and `module: CommonJS` → the config error and **no** per-file 9100x on
  rebuild. This catches a call site that skips wave 2's non-ESM guard.
- A `ResultProcessor` write that matches `esm.ignore` → no diagnostic. This catches filtering reimplemented before
  `checkEsm`.
- Repo gates: `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm test:e2e`; tests per `docs/rules/testing.md`.

### Bookkeeping

- Push the first real commit as soon as it exists.
- Open the PR with `plot-open-pr.sh`, then give it a descriptive title (the heading alone reads "Wave 3").
- Append `→ #<number>` to this branch's line in the plan's `## Slices`.

### Scope guard

This branch owns: `packages/core/src/compiler/compilation/CompilationContext.ts` (attribution map, transformer
wrapping, generator recording), the processor loop and `ResultProcessor` loop in `Compiler.ts`, `watch()` /
`registerWatch` call sites, their tests, the `packages/compiler/README.md` note on `fs` writes.

Parallel wave 3 slices add rules inside `packages/core/src/compiler/esm/` and must not need changes here; if a
rule slice needs attribution data, it reads it through the diagnostics context wave 2 defined. `packages/webpack`
is wave 4.

If you find something the plan did not anticipate, report it rather than improvising outside scope.
