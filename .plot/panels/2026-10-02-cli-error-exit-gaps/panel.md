<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# Panel: cli-error-exit-gaps

- **Subject:** `docs/plans/2026-10-02-cli-error-exit-gaps.md` (Draft, branch `idea/cli-error-exit-gaps`, PR #136)
- **Date:** 2026-10-02
- **Commitment:** `Verdict: proceed | amend | reject`
- **Jurors:** CLI user in CI scripts, compiler pipeline internals, `tsc` parity
- **Gate:** `plot-panel.mjs check` — all three committed; `reconcile` → **unanimous: amend**

## Process notes

- The jurors ran on Sonnet and wrote their own verdict files (`ci-user.md`, `compiler-pipeline.md`, `tsc-parity.md`);
  the moderator changed nothing in them. All three files pass the gate.
- The moderator re-ran `check` and `reconcile` on the files as committed: unanimous `amend`.
- **What each juror looked at:**
  - *CI user* **executed**: built `origin/develop` in a scratch copy and ran the CLI on a fixture for items 1, 4, 6;
    read the rest from the plan's runs.
  - *tsc parity* **executed**: built `origin/develop` and ran `bin.js` next to `tsc` 5.7.3 for ten cases (table in its
    file); items 8 and 9 read only.
  - *Compiler pipeline* **ran two TypeScript scripts** (language-service vs Program emit under TS4094;
    `getOptionsDiagnostics` vs `getGlobalDiagnostics` for TS2688, invalid resolution, wrong `rootDir`); everything else,
    including the plan's CLI reproductions, read only.
- Its findings on items 2 and 8 are therefore measured against the TypeScript API, and the CLI-behaviour findings
  are measured twice independently (CI user, tsc parity).

## Where the jurors converge

| Finding | Jurors | Evidence |
|---------|--------|----------|
| `-p <directory>` and `-p missing.json` silently exit 0 — the widest silent success; reproduced | CI user, tsc parity (executed) | `parsed-command-line.ts:74` |
| Slice 1 is too big: split `-p` resolution (item 6) from option-error reporting (item 1) and the config/`addonsDir` items (4, 5) | all three | — |
| Keep exit code 1, but **state** it differs from `tsc`'s 2 for emit-despite-errors, in Changelog and README | all three | `tsc` exits 2 for TS5023, TS2688, TS1110 (executed) |
| The Changelog's "every compilation path" is false: TS2688 not on the declaration path (plan's open point), and not in watch (compiler) | compiler, tsc parity | `watch()` never calls `report()`; `Compiler.ts:821` |
| Release notes must say that previously green builds can now fail | CI user, compiler | removing the filter at `Compiler.ts:670-673` |
| A malformed `websmith.config.json` that is only discovered (no `-c`) is not loaded at all; the plan should say whether discovery is in scope | CI user, tsc parity (both ran it) | — |
| #135 does not claim `-p <directory>`; this plan owns it | CI user, tsc parity (checked) | moderator re-checked #135's text |

## Where they differ — named, not averaged

1. **Open Point 2 (`getGlobalDiagnostics` on the declaration path).** The plan accepts a gap or proposes one
   options-and-globals Program per profile. The compiler juror **ran** it: TS2688 is in `getOptionsDiagnostics()`, and
   `getGlobalDiagnostics()` returns nothing for it — so there is no gap and no extra Program is needed; only true
   checker globals (TS2318 under `noLib`) remain. The tsc-parity juror, without that probe, recommends rewording the
   Changelog and pinning the gap with an e2e. **The executed finding removes the premise**; the plan should close the
   open point as "per-file `getOptionsDiagnostics` covers TS2688" and keep only the watch gap.
2. **TS5042 (`-p` with file names).** The plan defers it. tsc parity wants it decided now (same branch, same channel,
   one `errors` entry) or named as a deliberate difference after checking git history of `:76`. CI user calls leaving
   it "fine". A real disagreement about scope.
3. **Item 8 mechanism.** The plan says "root cause first; maybe a second JS-only emit". The compiler juror **ran**
   it and named the cause: `processOutput` writes only `if (!output.emitSkipped)` (`Compiler.ts:1053`), and the
   per-file path hardcodes `emitSkipped: false` (`:1370`, `:1389`). Fix is the `emitSkipped` rule in two branches; no
   second emit. Undisputed.
4. **"Output is written as `tsc` writes it".** Only the compiler juror found the fast path contradicts it today: a
   file-less transpile diagnostic sets `emitSkipped: true` (`:1414`), so TS5095 emits nothing there. One `emitSkipped`
   rule for items 2, 3 and 8 must be decided.
5. **Slice 4 mechanism.** Only the compiler juror: `ts.createSourceFile` exposes no public syntactic diagnostics
   (`parseDiagnostics` is internal); use `transpileModule({ reportDiagnostics })` or a single-file Program, which costs a
   Program per file on the fast path — measure it. Also scope to `.js/.jsx/.mjs/.cjs` under `allowJs`, not `.json`.
6. **Parse errors' source of truth.** Only the compiler juror: `ResolvedCompilerOptions.ts:131` does not carry the
   errors (they end up `[]` at `:230`), the tsconfig is parsed four times, and the `fileExists(tsConfigFile)` guard
   exists in three places (`parsed-command-line.ts:74`, `ResolvedCompilerOptions.ts:201`, `:352`). Reporting in
   `report()` would repeat per profile.

## Shared blind spot

The plan's headline is "reports every error `tsc` reports". The tsc-parity juror **ran** `const x: number = "s"`
with no addon: `tsc` TS2322 exit 2, websmith nothing, exit 0 — the default CLI path does not type-check at all. The
#135 panel's semantics juror saw the same independently. The other two lenses here took the plan's nine items as the
universe of gaps and judged their fixes; none asked whether the item list was complete against its own headline.
Either the headline narrows to "syntactic, option and configuration errors" or type errors on the fast path are a
tenth item (likely its own plan — it is a design decision about the fast path, not a reporting bug). A smaller
case of the same: the `allowJs` output layout differs from `tsc` (`out/src/b.js` vs `out/b.js`), and slice 4's e2e
would pin the wrong layout if it asserts paths.

## Cross-plan conflicts

- **`-p <directory>` vs #135:** resolved — #135 does not claim it; delete this plan's conditional sentence in Notes and
  keep item 6 here.
- **#134 `loader-options-once`:** after slice 2 every per-file fragment carries option diagnostics, and the loader
  prints one per module until #134's "errors once" slice lands. Order #134's slice first, or put the dedup key in core
  (`getDiagnosticKey`). Also #134 owns `reportedConfigErrors` and the `depends` closure; this plan must not change them.
- **#135 `tsc-option-parity`:** its defaults slice changes the options that slice 2 now validates; land it first or
  re-run slice 2's fixture comparison after it.
- **TS 7 story:** slices 3, 4 and 7 lean on per-file Programs, `transpileModule` and the language service, which the
  API-gap analysis marks missing in TS 7 (`analysis-ts7-api-gap.md:61-65`); each new use is a line in that inventory.

## What the plan needs before approval

1. **Narrow the headline and Changelog** to the errors the plan fixes, and record fast-path type errors as a separate
   follow-up (or plan); say "except watch" or add options diagnostics at `watch()` start (recommended).
2. **Split slice 1** into `-p` resolution (first), option-error reporting with a named single source of truth reported
   once at `compile()` / `watch()` start, and the config / `addonsDir` items. Normalise `-p` once for all three guards.
3. **Close Open Point 2** on the executed evidence: per-file `getOptionsDiagnostics` covers TS2688; add a `rootDir`
   (TS6059) unit test.
4. **Decide one `emitSkipped` rule** for items 2, 3 and 8, and fix item 8 at `Compiler.ts:1201-1203` / `:1256-1258`
   without a second emit.
5. **Slice 4:** a public mechanism with a measured cost, scoped to JS extensions under `allowJs`; do not assert the
   `.js` output path.
6. **Decide TS5042** (fix in slice 1 or name the deliberate difference), state exit code 1 vs `tsc`'s 2, decide config
   discovery, and add a Release-Notes line that previously green builds can now fail.
7. **Order against #134 and #135** as above; run every e2e fixture before and after removing the file-less filter.

Nothing here is acted on by the panel. The plan author amends; `/challenge-the-plan` or `/plot-approve` follows.
