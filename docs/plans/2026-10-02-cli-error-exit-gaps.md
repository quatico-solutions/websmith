<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# Report every CLI error and fail the exit code on it

> The `websmith` CLI reports every error `tsc` reports for the same project, as a diagnostic rather than a stack trace, once, and exits 1 on it; today some errors print nothing and exit 0.

## Status

- **State:** Draft
- **Type:** bug
- **Story:** node24-esm-support
- **Review:** pr
- **Impl:** own branches
<!-- Transition records — written by the workflow commands, not by hand:
- **Approved:** <date>, <who>, <channel>
- **Started:** <date>, <who>, <branch>   (one line per started branch)
-->

## Changelog

- `websmith` reports invalid `tsconfig.json` options (such as an unknown option, TS5023) and exits 1; before, it
  printed nothing and exited 0.
- `websmith -p <directory>` compiles `<directory>/tsconfig.json`, as `tsc` does, and a `--project` path that does
  not exist is an error. Before, both compiled nothing and exited 0 without a message.
- A malformed `websmith.config.json` is reported as a configuration error with exit code 1 instead of ending the
  CLI with a `SyntaxError` stack trace.
- Errors without a file, such as "Cannot find type definition file" (TS2688), and option errors with
  `declaration: true` are reported and fail the build on every compilation path.
- With an addon that needs type information and `declaration: true`, a declaration emit error (such as TS4094) no
  longer suppresses the `.js` output of the file, as with `tsc`.
- Syntax errors in `.d.ts` files and, with `allowJs`, in JavaScript sources are reported when no addon needs type
  information.
- A missing `--addonsDir` directory is warned about once instead of twice.
- In watch mode, a file a generator adds with `addInputFile` is emitted on the first build and reported once per
  change instead of once per rebuild that re-added it.

## Motivation

`esm-output-check` wave 1 made the CLI exit code follow the reporter (`command.ts:167`): the build fails exactly when
an error diagnostic reached it. Every error that never reaches the reporter is therefore a silent success. The
reviews of waves 1 to 5 and the third delivery panel recorded these gaps in the story
(`docs/stories/node24-esm-support/STORY-node24-esm-support.md`: Open Points, and the log entries of 2026-09-25,
2026-09-30 and 2026-10-01). All predate the ESM work.

Checked on `develop` (`d7ffdf4`) by reading the code and, where marked "ran", by building the CLI and running it on
a fixture next to `tsc` 5.x on the same project:

| # | Item | Holds on develop | Where |
|---|------|------------------|-------|
| 1 | Invalid `tsconfig.json` options exit 0 | yes, ran: `"bogusOption": true` prints nothing, exit 0 on the fast path, the Program path and the declaration path; `tsc` reports TS5023, emits, exits 2 | `ts.getParsedCommandLineOfConfigFile` puts them in `errors`, which `parsed-command-line.ts:94`/`:123` spread and `:140` copies; `ResolvedCompilerOptions.ts:131` carries them; nothing reads them |
| 2 | Errors without a file are filtered unless the project uses references | yes, ran after #130: `types: ["does-not-exist"]` with a type-info addon prints nothing, exit 0; `tsc` reports TS2688 | `Compiler.ts:670-673` filters `!cur.file` before the reporter; #130 only keys the ones that pass |
| 3 | With `declaration: true` an option error is not reported | yes, ran: `moduleResolution: "bundler"` with `module: "commonjs"` exits 0 on the per-file declaration path and on the Program path (filter of item 2); the fast path reports TS5095 and exits 1 | per-file Programs collect syntactic and emit diagnostics only (`Compiler.ts:1320-1328`) |
| 4 | Malformed `websmith.config.json` ends in a `SyntaxError` stack trace | yes, ran: `SyntaxError: Unexpected end of JSON input` with stack, exit 1 | `comment-json` `parse` at `resolve-compiler-config.ts:166` is not caught |
| 5 | Missing `--addonsDir` warns twice | yes, ran: same warning twice, from the flag and from `addonsDir` in the config | `command.ts:183-185` and `AddonRegistry.ts:355-357` |
| 6 | `websmith -c websmith.config.json -p .` ended silently with exit 0 | yes, ran and root-caused: any `-p <directory>` (relative or absolute, with or without `-c`) compiles nothing and exits 0, also with a syntax error in the source; `-p ./tsconfig.json` works. `-p missing.json` also exits 0 silently (`tsc`: TS5058) | `parsed-command-line.ts:74` takes the tsconfig branch only if `fileExists(tsConfigFile)`, which is false for a directory and a missing file; the fallback at `:136-147` has no root files and no error |
| 7 | `.d.ts` and `allowJs` sources are not syntax-checked on the fast path | yes, ran: a syntax error in `src/c.d.ts` and in `src/b.js` (with `allowJs`) exits 0; `tsc` reports TS1110/TS1109 and exits 2, also with `skipLibCheck` | `Compiler.ts:1184-1185` returns nothing for `.d.ts`; `.js` goes to `transpileJson` (`:1188-1189`, `:1489`), which copies the content without a parse |
| 8 | Type-info addon + `declaration` + TS4094: language-service emit writes no `.js` | yes, ran (was unconfirmed): `export const Foo = class { private x = 1; }` writes `b.js`, `b.d.ts` but no `a.js` with a no-op addon (needs type info); without the addon, and with `tsc`, `a.js` is written. Both exit 1 with TS4094 | language-service emit, `Compiler.ts:1201-1203` (and `:1256-1258`) |
| 9 | Watch: generator-added files get one more watcher per re-add, and are not emitted on the first build | yes, from the code (not run) | `CompilationContext.ts:173-176` calls the watch callback on every `addInputFile`, also for a known root file; `Compiler.ts:889-920` pushes a new watcher each time; `watch()` takes the root files once before any generator runs (`Compiler.ts:245-266`) |

None of the nine is fixed on `develop`.

## Design

### Approach

One rule for every slice: **an error `tsc` reports for the project reaches the reporter as a diagnostic, once per
build, and the CLI exits 1.** Output is written as `tsc` writes it (option errors and declaration emit errors do not
stop `.js` output unless `noEmitOnError` is set). Each slice reproduces its item in a test first (red), then fixes it.

- **Configuration and arguments (items 1, 4, 5, 6).** `parsedCommandLine` resolves `--project` as `tsc` does: a
  directory means `<directory>/tsconfig.json`; a path that does not exist gives TS5058 (TS5057 for a directory
  without `tsconfig.json`). The `errors` of the parsed command line are reported once, by the Compiler that compiles
  with them (the CLI's own `createOptions` pass uses a `NoReporter` today for exactly this reason,
  `command.ts:117-119`), and they do not stop the emit. `resolveCompilationConfig` catches the parse error of
  `websmith.config.json` and reports it as an `ErrorMessage` with the file and the parser's message (position where
  `comment-json` provides it). The `addonsDir` warning stays in one place, the `AddonRegistry`.
- **Errors without a file (items 2, 3).** `report()` stops filtering file-less diagnostics of the Program
  (`Compiler.ts:672`) and keys them as #130 does, so each is reported once per build. The per-file declaration
  Programs add the option diagnostics of the Program (`getOptionsDiagnostics`) to what they return; `report()`'s
  existing key removes the per-file repeats, and `emitWatchedFile`'s removes them across rebuilds. The code that
  `transpileSourceCode` already filters (6046, numeric enum values, `Compiler.ts:1405`) stays filtered on every path.
- **Language-service emit (item 8).** Find why `getEmitOutput` drops the `.js` when the declaration emit fails, and
  emit the `.js` as the per-file path does. Root cause first; the fix may be a second, JavaScript-only emit when
  `emitSkipped` is set by declaration diagnostics.
- **Fast path for `.d.ts` and JavaScript (item 7).** On the fast path, a `.d.ts` source and an `allowJs` JavaScript
  source are parsed (`ts.createSourceFile`) and their syntactic diagnostics returned with the fragment. Output does
  not change: `.d.ts` still writes nothing, JavaScript is still copied.
- **Watch (item 9).** `registerWatch` keeps one watcher per path and profile set, so a re-added file adds none; the
  first watch build emits the files generators added while it ran.

Waves are sequential (one branch each). Slices 2 to 5 all change `Compiler.ts`, and slice 2 changes how
`report()` keys diagnostics, which slices 3 and 4 then report through. Slice 1 goes first because item 6 is the
widest silent success.

### Open Points

- [ ] **Exit code for option errors.** `tsc` exits 2 when it emits despite errors; websmith uses 1 for every failure.
      Plan: keep 1, the code every other websmith failure exits with (`command.ts:168`).
- [ ] **`getGlobalDiagnostics` on the per-file declaration path.** It needs the type checker of each per-file
      Program. Plan: collect only `getOptionsDiagnostics` there (cheap) and accept that a global error such as TS2688
      is reported on the Program path and by `tsc`, but not on the declaration-only path. Alternative: one
      options-and-globals Program per profile and build.
- [ ] **Webpack loader.** Items 1 to 4 live in `packages/core`, which the loader shares. The fix reaches the loader
      too; whether the loader then reports them once per module is `loader-options-once`'s concern. Each slice runs
      `packages/webpack-test` and notes any change in the loader's output in its PR.
- [ ] **Watch e2e.** `bin.test.ts` has no watch case. Slice 5 adds one that starts `--watch`, changes a generator
      input, and stops the process; if that proves flaky in CI, unit tests on a watching test system are the fallback,
      stated in the PR.
- [ ] **`-p` with explicit file arguments.** `tsc` refuses `-p` together with file names (TS5042); websmith accepts
      both (`parsed-command-line.ts:76`). Not changed here; recorded if slice 1 touches the branch.

## Slices

### Configuration and arguments

- `bug/cli-config-and-project-errors` — items 1, 4, 5, 6: `-p <directory>` and a missing `--project` path resolved and reported as `tsc` does, `cliArgs.errors` reported once without stopping the emit, a malformed `websmith.config.json` reported as a configuration error, the `addonsDir` warning once. Unit: `parsed-command-line.spec.ts`, `resolve-compiler-config.spec.ts`, `command.spec.ts`; e2e in `bin.test.ts`: unknown option exits 1 with TS5023 and writes output, `-p .` from the project directory compiles and fails on a syntax error, `-p missing.json` exits 1, malformed config exits 1 without a stack trace, missing `--addonsDir` warns once (extends the test at `bin.test.ts:455`) <!-- builds: --project directory resolution and reporting of parsed-command-line and websmith.config.json parse errors -->

### Errors without a file

- `bug/report-file-less-diagnostics` — items 2, 3: `report()` no longer drops file-less diagnostics of the Program, the per-file declaration Programs return option diagnostics, each reported once per build and watch session. Unit: `Compiler.spec.ts` for both paths and the once-only key; e2e in `bin.test.ts`: `types: ["does-not-exist"]` with a type-info addon exits 1 with TS2688, `declaration: true` with an invalid option combination exits 1 with TS5095 once <!-- builds: file-less and option diagnostics in Compiler.report and the per-file declaration Program -->

### Language-service emit

- `bug/ls-emit-keeps-js-on-declaration-errors` — item 8: with an addon that needs type information and `declaration: true`, a declaration emit error no longer drops the file's `.js`. Root cause first. Unit: `Compiler.spec.ts`; e2e in `bin.test.ts` or `packages/compiler-test`: type-info addon, `declaration`, TS4094 source → `.js` written, exit 1, as without the addon <!-- builds: .js output of the language-service emit under declaration emit errors -->

### Fast path for .d.ts and JavaScript

- `bug/fast-path-dts-js-syntax-errors` — item 7: `.d.ts` sources and `allowJs` JavaScript sources are syntax-checked on the fast path; output unchanged. Unit: `Compiler.spec.ts`; e2e in `bin.test.ts`: a syntax error in a `.d.ts` source and in a `.js` source with `allowJs` exits 1 with TS1110/TS1109 <!-- builds: syntactic diagnostics for .d.ts and JavaScript sources on the transpileModule fast path -->

### Watch

- `bug/watch-generator-added-files` — item 9: one watcher per path regardless of how often a generator re-adds it, and the first watch build emits generator-added files. Unit: `Compiler.spec.ts` and `CompilationContext.spec.ts` on a watching test system; e2e: a `--watch` case in `bin.test.ts` (see Open Points) <!-- builds: deduplicated registerWatch and first-build emit of generator-added files -->

## Notes

- Created 2026-10-02 from the story's open points and follow-up logs. Type `bug`, plan PR review, own branches,
  as asked.
- **Dropped as already fixed:** none of the nine. Related and already fixed: "option errors print once per root
  file" (#130, CLI and watch). #130 does not fix item 2: it keys file-less diagnostics, but the filter at
  `Compiler.ts:672` still drops them before the key on the Program path.
- **Confirmed by running** (`pnpm build`, `node packages/compiler/bin/bin.js`, fixtures in a scratch directory,
  compared with `tsc` from the workspace): items 1, 2, 3, 4, 5, 6, 7, 8. Item 8 was "not yet confirmed" in the story
  and reproduces. Item 6 reproduces for every `-p <directory>`, not only with relative paths or `-c`.
- **From the code only:** item 9 (watch). Slice 5 writes the failing test first.
- **Not taken here** (sibling plans or out of theme): webpack loader items (`loader-options-once`); nested compiles
  checked twice (`esm-check-precision`); `hasInvalidProfile`'s wrong warning for a missing `depends` and the four
  copies of the `depends` closure (2026-09-30 log, not assigned to this plan); the 2026-09-25 relative-import and
  attribution items. If `tsc-option-parity` also claims `-p <directory>` resolution, slice 1 drops it there.
- **Deliverable search** (`plot-deliverable-search.sh`): `cliArgs.errors`, `Cannot find a tsconfig.json`,
  `fileExists(tsConfigFile)` — no existing reporting of parse errors or directory resolution; the only `fileExists`
  hit near the topic is `packages/compiler/src/find-config.ts:10` (`ts.findConfigFile`, used for config discovery,
  not for `--project`), a candidate to reuse in slice 1. `getOptionsDiagnostics`, `getGlobalDiagnostics` — only
  mocks in `Compiler.spec.ts:1663-1709`, no production caller. `getSyntacticDiagnostics` — the existing calls at
  `Compiler.ts:1246`, `:1262`, `:1326`, `:1478`, which slice 4 extends to `.d.ts`/JavaScript. `getEmitOutput` —
  `Compiler.ts` only. `registerWatch`, `watchedFiles` — `Compiler.ts:260`, `:264`, `:453`, `:889`; no existing
  watcher deduplication.
