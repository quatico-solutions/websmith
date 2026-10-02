<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# websmith compiler pipeline internals

Read against `origin/develop` (`cfb284cc`; the plan cites `d7ffdf4`, the `Compiler.ts` line numbers still match).
Executed: two small scripts with the workspace `typescript` 5.7.3 (language-service and Program emit under TS4094;
`getOptionsDiagnostics` / `getGlobalDiagnostics` for `types: ["does-not-exist"]`, an invalid module resolution and a
wrong `rootDir`). Only read: everything else, including all CLI reproductions in the plan's table (not re-run).
Paths below: `Compiler.ts` is `packages/core/src/compiler/Compiler.ts`; `parsed-command-line.ts` and
`resolve-compiler-config.ts` live in `.../compiler/config/`, `ResolvedCompilerOptions.ts` in `.../compiler/options/`.

## Findings that change the plan

1. **Item 8 (TS4094) has a known, one-line root cause; the plan's "find why, maybe a second JS-only emit" is
   over-scoped.** I ran it: the language service's `getEmitOutput` returns `b.js` with `emitSkipped: true` (the
   Program's `emit` does too, with the TS4094 diagnostic). The `.js` is lost in `processOutput`, which writes only
   `if (output && !output.emitSkipped)` (`Compiler.ts:1053`). The per-file declaration path hardcodes
   `emitSkipped: false` (`Compiler.ts:1370`, `:1389`), which is why it writes `a.js` and the language-service branches
   (`:1201-1203`, `:1256-1258`) do not. Fix: those two branches return
   `emitSkipped: emitOutput.emitSkipped && (noEmitOnError || no outputFiles)`. No second emit. State this in the slice;
   it also fixes the plan's own "root cause first" ambiguity. The slice stays tiny and stays separate.

2. **Open point 2 rests on a wrong premise.** `getGlobalDiagnostics()` is empty for `types: ["does-not-exist"]`; TS2688
   is in `getOptionsDiagnostics()` (ran: it returned TS2688, TS5095 and TS6059 together, `getGlobalDiagnostics` returned
   nothing). So collecting `getOptionsDiagnostics` on the per-file Programs does report TS2688 on the declaration path
   too, and there is no need for "one options-and-globals Program per profile". Drop the alternative and the accepted gap.
   Real globals (a missing `Array` under `noLib`, TS2318) need the checker and are the only thing left out; say so.

3. **Per-file option-error cost (the question asked): negligible, no need for a separate options Program.**
   `createProgram` already runs the option verification, so `getOptionsDiagnostics()` on a per-file Program only
   returns what exists; the extra cost is one `getDiagnosticKey` (`flattenDiagnosticMessageText`) per diagnostic per file
   in `report()`. Careful with file-set-dependent checks: TS6059 (`rootDir`) and TS5055 depend on the per-file Program's
   file set, so they carry the file name in the message and appear once per offending file (same total as `tsc`), and
   are deduplicated across Programs that load the same import. Fine, but write one unit test with a `rootDir` violation
   so this is pinned and not discovered.

4. **`ResolvedCompilerOptions.ts:131` does not "carry" the parse errors.** Line 131 only copies `options.cliArgs.errors` into
   the pre-merge object; the resolved `this.cliArgs` ends with `errors: []` (`ResolvedCompilerOptions.ts:230`), so the
   parse errors are discarded. The tsconfig is parsed at least four times independently: `command.ts` createOptions
   (with `NoReporter`), `ResolvedCompilerOptions.ts:201`, `getTsConfig` `:352`, and per profile `:287`. Slice 1 must name
   its source of truth (a new field such as `configErrors`, set once from one parse) instead of "stop ignoring `errors`".

5. **`-p <directory>` is guarded in three places, not one.** `parsed-command-line.ts:74` and also
   `ResolvedCompilerOptions.ts:201` and `:352` use `system.fileExists(tsConfigFile)`. Fixing only the first leaves
   `ResolvedCompilerOptions` with no root files and no options for a directory. Normalise the path once in
   `resolvePathsWithRules` (`ResolvedCompilerOptions.ts` top), and `command.ts`/`find-config.ts` can share it.

6. **Where config errors are reported is unspecified, and the obvious place is wrong.** `report()` runs once per profile
   (`Compiler.ts:217`), so reporting `errors` there repeats a project-wide error once per profile; and `watch()` never
   calls `report()` (it goes through `emitWatchedFile`, `:821`). Specify: reported once at the start of `compile()` and of
   `watch()`, keyed with `getDiagnosticKey`, with a unit test for a two-profile project and a watch test. Slice 1
   therefore touches `Compiler.ts` after all; the plan's "slices 2 to 5 all change `Compiler.ts`" is incomplete.

7. **"Every compilation path" (Changelog) is false for watch.** Watch builds never create the big Program and never call
   `getPreEmitDiagnostics`, so a Program-level file-less error (TS2688 with a type-info addon) is not reported by `watch()`
   even after slice 2 as written (`emitWatchedFile` only prints fragment diagnostics). Either slice 2 adds an explicit
   options-diagnostics report at `watch()` start (cheap: the language-service Program already exists after the first
   emit), or the Changelog says "except watch". Recommend the former; the `reportedWatchDiagnostics` set (`:138`) already
   dedupes across rebuilds.

8. **Output on the fast path contradicts the plan's rule.** "Output is written as `tsc` writes it (option errors ... do not
   stop `.js` output)" is not true on develop: a file-less transpile diagnostic (TS5095) sets `emitSkipped: true`
   (`Compiler.ts:1414`), and `processOutput` (`:1053`) then writes nothing, whereas the plan expects TS5023 to emit.
   Decide in slice 2 (one `emitSkipped` rule for items 2, 3 and 8, in `processOutput` or at the three producers) and put
   it in the Changelog; otherwise the same option error emits or not depending on which path found it.

9. **Removing the filter at `Compiler.ts:670-673` is a breaking-ish change that the plan under-weights.** The filter dates
   from `8ab6a267` and its comment says it avoids validation errors from numeric enum option values; unfiltered Program
   option diagnostics computed from websmith's merged options (`ResolvedCompilerOptions` merges profile, CLI and
   defaults) may surface errors `tsc` would not for the original `tsconfig.json`. Add to slice 2: run every
   `compiler-test`/`webpack-test` fixture and the example projects before and after, compare with `tsc`, and add a
   `Release-Notes.md` entry that previously green builds can now fail. Existing `report` unit tests mock
   `getGlobalDiagnostics`/`getOptionsDiagnostics` with `file` set (`Compiler.spec.ts:1655-1715`), so none of them
   covers the file-less case; the red test must be new.

10. **Slice 4's mechanism does not exist as written.** `ts.createSourceFile` exposes no public syntactic diagnostics
    (`parseDiagnostics` is internal). Use `ts.transpileModule(..., { reportDiagnostics: true })` (works for `.js` with
    `allowJs`) or a single-file Program with `getSyntacticDiagnostics()` as `transpileNodeModule` does (`:1480-1485`).
    Both create a Program per file on the fast path, which is the thing the fast path avoids; measure on a large fixture
    and say the cost in the PR. `.js` currently goes through `transpileJson`, which also serves `.json` and emits a
    file-less "JSON files are only emitted if an outDir is provided" diagnostic; scope the new check to `.js/.jsx/.mjs/.cjs`
    under `allowJs`, not to everything non-TypeScript.

## Slice-by-slice

- **Configuration and arguments: too big, split.** Four themes (items 1, 4, 5, 6) over `parsed-command-line.ts`,
  `ResolvedCompilerOptions.ts`, `resolve-compiler-config.ts`, `command.ts`, `AddonRegistry.ts` and `Compiler.ts`. Suggest
  (a) `-p` directory/missing resolution (item 6, widest silent success), (b) report parse errors once (item 1, needs
  findings 4 and 6), (c) malformed `websmith.config.json` and the `addonsDir` double warning (items 4, 5; independent,
  small). Tests are red-first as described. The `-p` e2e needs the "compile fails on a syntax error" case, as listed.
- **Errors without a file:** placement of the fix (`report()` plus per-file `getOptionsDiagnostics`) is right; see findings
  2, 3, 7, 8, 9. Keep.
- **Language-service emit:** right slice, fix is the `emitSkipped` rule (finding 1). Independent of slice 2 despite the
  ordering note; it shares `transpileInternal` with slice 4 (merge conflict only).
- **Fast path .d.ts/JS:** see finding 10. Independent of slice 2: its diagnostics carry files, so the `report()` key
  change is not a prerequisite (the plan's sentence suggests it is).
- **Watch:** placement right. Verified by reading: `watch()` registers each root file (`:260`, `:264`) and
  `watchCallback` (`:453`) registers again on every `addInputFile`, including known root files
  (`CompilationContext.ts:173-176`); `fileWatchers` is a plain array that `closeAllWatchers` iterates, so key the dedupe
  on path plus sorted profile names and keep the array semantics. The "first build emits generator-added files" half is
  separable and riskier (ordering with generators); a failing test first, as the plan says.

## Overlap

- **#134 `loader-option-errors-once`** (file-less diagnostics reported once per compilation in the loader) and
  `loader-dependent-profile-diagnostics` overlap slice 2 directly: after slice 2 every per-file fragment carries option
  diagnostics and the loader would print one per module until #134 lands. Order #134's slice before slice 2, or put the
  dedupe in core (`getDiagnosticKey`) where both can use it. The plan only says "loader-options-once's concern".
- #135 `tsDefaults` changes the options slice 2 now validates (new TS5xxx combinations from the default `target` change);
  no code overlap, but land #135's defaults slice first or re-run slice 2's fixture comparison after it.
- #137 attribution slice (nested compile checked once) touches `Compiler.spec.ts`/`CompilationContext`; no overlap with
  these items. TS7 story: items 3, 4 and 7 lean on per-file Programs, `transpileModule` and the language service, which the
  story's API-gap analysis marks as missing in TS7 (`analysis-ts7-api-gap.md:61-65`); not blocking, but each new use is a
  line in the TS7 inventory.

## Open points to decide before approval

1. Exit code 1 for option errors: agree (keep 1).
2. `getGlobalDiagnostics`: close it; `getOptionsDiagnostics` covers TS2688 (finding 2).
3. Output on option errors on every path (finding 8): decide the single `emitSkipped` rule.
4. Watch coverage (finding 7): require options diagnostics in `watch()`.
5. Slice 1 split and the source of truth for parse errors (findings 4-6).
6. Order against #134 (overlap above).

Verdict: amend
