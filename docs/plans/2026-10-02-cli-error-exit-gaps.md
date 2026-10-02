<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# Report CLI option, configuration and syntax errors and fail the exit code on them

> The `websmith` CLI reports the option, configuration, file-less and syntax errors `tsc` reports for the same project
> as diagnostics rather than stack traces, once, and exits 1 on them; today some of them print nothing and exit 0.
> Type errors on the default (fast) CLI path are out of scope (see Notes).

## Status

- **State:** Approved
- **Type:** bug
- **Story:** node24-esm-support
- **Review:** pr
- **Impl:** own branches
- **Rounds:** 1
- **Approved:** 2026-10-02, Jan Wloka, plan-PR #136 merged
- **Started:** 2026-10-02, Jan Wloka, `bug/cli-project-directory`
<!-- Transition records — written by the workflow commands, not by hand:
- **Approved:** <date>, <who>, <channel>
- **Started:** <date>, <who>, <branch>   (one line per started branch)
-->

## Changelog

- `websmith -p <directory>` compiles `<directory>/tsconfig.json`, as `tsc` does. A `--project` path that does not
  exist is an error (TS5058), and so is a directory without `tsconfig.json` (TS5057); both name the resolved absolute
  path. Before, all three compiled nothing and exited 0 without a message.
- `websmith` reports invalid `tsconfig.json` options (such as an unknown option, TS5023) once per build, also in watch
  mode, still writes the output, and exits 1; before, it printed nothing and exited 0.
- A malformed `websmith.config.json` passed with `--configFile` is reported as a configuration error naming the file,
  with exit code 1, instead of ending the CLI with a `SyntaxError` stack trace.
- Errors without a file, such as "Cannot find type definition file" (TS2688), and option errors with
  `declaration: true` are reported and fail the build on the Program path, the per-file declaration path and in watch
  mode. Errors that need the type checker of the whole program, such as a missing global type under `noLib`
  (TS2318), are still reported on the Program path only.
- Option errors and declaration emit errors no longer suppress `.js` output, as with `tsc`, unless `noEmitOnError` is
  set. This covers the fast path (an option error such as TS5095 now writes the output) and an addon that needs type
  information with `declaration: true` (a declaration emit error such as TS4094 no longer drops the file's `.js`).
- Syntax errors in `.d.ts` files and, with `allowJs`, in JavaScript sources are reported when no addon needs type
  information.
- A missing `--addonsDir` directory is warned about once instead of twice.
- In watch mode, a file a generator adds with `addInputFile` is emitted on the first build and reported once per
  change instead of once per rebuild that re-added it.
- **Exit code:** websmith exits 1 for every failure. `tsc` exits 2 when it reports errors but still emits; scripts
  that test for `2` must test for non-zero instead. Stated in `packages/compiler/README.md`.
- **Builds that passed before can now fail.** Typo'd `tsconfig.json` options, `-p <directory>`, file-less errors
  and `.d.ts`/JavaScript syntax errors used to exit 0 and now exit 1. Each slice's `Release-Notes.md` entry goes
  under `## [Unreleased]` / `### Changed` and says so; the first slice adds the lead sentence.

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
| 1 | Invalid `tsconfig.json` options exit 0 | yes, ran: `"bogusOption": true` prints nothing, exit 0 on the fast path, the Program path and the declaration path; `tsc` reports TS5023, emits, exits 2 | `ts.getParsedCommandLineOfConfigFile` puts them in `errors`, which `parsed-command-line.ts:94`/`:123` spread and `:140` copies; `ResolvedCompilerOptions.ts:131` copies them into the pre-merge object, but the resolved `cliArgs` ends with `errors: []` (`:230`), so they are discarded; the tsconfig is parsed four times (`command.ts` with a `NoReporter`, `ResolvedCompilerOptions.ts:201`, `:287` per profile, `:352`) |
| 2 | Errors without a file are filtered unless the project uses references | yes, ran after #130: `types: ["does-not-exist"]` with a type-info addon prints nothing, exit 0; `tsc` reports TS2688 | `Compiler.ts:670-673` filters `!cur.file` before the reporter; #130 only keys the ones that pass |
| 3 | With `declaration: true` an option error is not reported | yes, ran: `moduleResolution: "bundler"` with `module: "commonjs"` exits 0 on the per-file declaration path and on the Program path (filter of item 2); the fast path reports TS5095 and exits 1 | per-file Programs collect syntactic and emit diagnostics only (`Compiler.ts:1320-1328`) |
| 4 | Malformed `websmith.config.json` ends in a `SyntaxError` stack trace | yes, ran: `SyntaxError: Unexpected end of JSON input` with stack, exit 1 | `comment-json` `parse` at `resolve-compiler-config.ts:166` is not caught |
| 5 | Missing `--addonsDir` warns twice | yes, ran: same warning twice, from the flag and from `addonsDir` in the config | `command.ts:183-185` and `AddonRegistry.ts:355-357` |
| 6 | `websmith -c websmith.config.json -p .` ended silently with exit 0 | yes, ran and root-caused: any `-p <directory>` (relative or absolute, with or without `-c`) compiles nothing and exits 0, also with a syntax error in the source; `-p ./tsconfig.json` works. `-p missing.json` also exits 0 silently (`tsc`: TS5058) | `parsed-command-line.ts:74` takes the tsconfig branch only if `fileExists(tsConfigFile)`, which is false for a directory and a missing file; the fallback at `:136-147` has no root files and no error. The same guard sits in `ResolvedCompilerOptions.ts:201` and `:352` |
| 7 | `.d.ts` and `allowJs` sources are not syntax-checked on the fast path | yes, ran: a syntax error in `src/c.d.ts` and in `src/b.js` (with `allowJs`) exits 0; `tsc` reports TS1110/TS1109 and exits 2, also with `skipLibCheck` | `Compiler.ts:1184-1185` returns nothing for `.d.ts`; `.js` goes to `transpileJson` (`:1188-1189`, `:1489`), which copies the content without a parse |
| 8 | Type-info addon + `declaration` + TS4094: language-service emit writes no `.js` | yes, ran (was unconfirmed): `export const Foo = class { private x = 1; }` writes `b.js`, `b.d.ts` but no `a.js` with a no-op addon (needs type info); without the addon, and with `tsc`, `a.js` is written. Both exit 1 with TS4094 | root-caused by the panel's compiler juror (ran): `getEmitOutput` returns the `.js` with `emitSkipped: true`, and `processOutput` writes only `if (!output.emitSkipped)` (`Compiler.ts:1053`); the per-file path hardcodes `emitSkipped: false` (`:1370`, `:1389`), the language-service branches (`:1201-1203`, `:1256-1258`) pass it through |
| 9 | Watch: generator-added files get one more watcher per re-add, and are not emitted on the first build | yes, from the code (not run) | `CompilationContext.ts:173-176` calls the watch callback on every `addInputFile`, also for a known root file; `Compiler.ts:889-920` pushes a new watcher each time; `watch()` takes the root files once before any generator runs (`Compiler.ts:245-266`) |

None of the nine is fixed on `develop` (re-checked on `cfb284cc` by the draft panel).

The panel also found that the default CLI path (no addon needing type information, no `declaration`) reports no
type errors at all (`const x: number = "s"`: `tsc` TS2322, websmith nothing, exit 0). That is a design question
about the fast path, not a reporting gap, and is not taken here (see Notes).

## Design

### Approach

One rule for every slice: **an option, configuration, file-less or syntax error `tsc` reports for the project
reaches the reporter as a diagnostic, once per build, and the CLI exits 1** (not `tsc`'s 2, see Open Points). One
output rule beside it: **a fragment's `emitSkipped` is true only when it has no output files, or when
`noEmitOnError` is set and it carries an error**; option errors and declaration emit errors otherwise do not stop
`.js` output, as with `tsc`. Each slice reproduces its item in a test first (red), then fixes it.

- **`--project` resolution (item 6).** The `--project` path is normalised once, in `resolvePathsWithRules`
  (`ResolvedCompilerOptions.ts`), as `tsc` does: a directory means `<directory>/tsconfig.json`; a path that does not
  exist gives TS5058, a directory without `tsconfig.json` TS5057, each with the resolved absolute path. All three
  `fileExists(tsConfigFile)` guards (`parsed-command-line.ts:74`, `ResolvedCompilerOptions.ts:201`, `:352`) then see
  the normalised file; `command.ts` and `find-config.ts` reuse the same helper. `-p` with file names keeps its
  current behaviour (Open Points, TS5042).
- **`websmith.config.json` and `addonsDir` (items 4, 5).** `resolveCompilationConfig` catches the `comment-json`
  parse error (`resolve-compiler-config.ts:166`) and reports an `ErrorMessage` with the file path and the parser's
  message (position where `comment-json` provides it), one line, no stack. Only a file passed with `--configFile`
  is read; websmith does not discover the file (`README.md:57`), and this plan does not add discovery. The
  `addonsDir` warning stays in one place, the `AddonRegistry` (drop `command.ts:183-185`).
- **The `emitSkipped` rule (item 8, and the output side of items 1 to 3).** Applied at the three producers that
  decide it today: the language-service branches (`Compiler.ts:1201-1203`, `:1256-1258`) return
  `emitSkipped: emitOutput.emitSkipped && (noEmitOnError || no outputFiles)` instead of passing the language
  service's value through; the fast path (`:1414`) stops setting `emitSkipped` for a file-less transpile diagnostic.
  `processOutput` (`:1053`) is unchanged. No second emit.
- **Option errors (item 1).** One source of truth: a new `configErrors` field on `ResolvedCompilerOptions`, set from
  the `errors` of the one `getParsedCommandLineOfConfigFile` call that resolves the CLI's tsconfig (not the profile
  re-parses, not the `NoReporter` pass in `command.ts:117-119`). The Compiler reports it once at the start of
  `compile()` and of `watch()` (not in `report()`, which runs once per profile, `Compiler.ts:217`), keyed with
  `getDiagnosticKey`. The emit continues.
- **Errors without a file (items 2, 3).** `report()` stops filtering file-less diagnostics of the Program
  (`Compiler.ts:670-673`) and keys them as #130 does. The per-file declaration Programs add
  `getOptionsDiagnostics()` to what they return; the panel ran it: TS2688, TS5095 and TS6059 all come from
  `getOptionsDiagnostics()`, so the declaration path reports TS2688 too. `watch()` reports the options
  diagnostics of the language-service Program after the first emit, deduplicated across rebuilds by
  `reportedWatchDiagnostics` (`Compiler.ts:138`). Only checker globals (TS2318 under `noLib`) stay Program-path only.
  The code `transpileSourceCode` filters (6046, numeric enum values, `Compiler.ts:1405`) stays filtered everywhere.
- **Fast path for `.d.ts` and JavaScript (item 7).** On the fast path a `.d.ts` source, and under `allowJs` a
  `.js`/`.jsx`/`.mjs`/`.cjs` source (not `.json`), go through `ts.transpileModule(content, { fileName,
  compilerOptions, reportDiagnostics: true })`; only diagnostics with a file are kept, the output text is discarded.
  Output does not change: `.d.ts` still writes nothing, JavaScript is still copied by `transpileJson`.
- **Watch (item 9).** `registerWatch` keys watchers on path plus sorted profile names and keeps the `fileWatchers`
  array semantics, so a re-added file adds none; the first watch build emits the files generators added while it
  ran.

**Order.** Waves are sequential, one branch each. `-p` resolution goes first, alone: it is the widest silent success
and a regression in it breaks every user, so it gets its own review. The config and `addonsDir` slice and the
`emitSkipped` slice are independent and small. The two diagnostic-reporting slices (option errors, errors without a
file) land **after `loader-options-once` (#134) has merged its errors-once slice** (otherwise the webpack loader prints
one option diagnostic per module) **and after `tsc-option-parity` (#135) has merged its defaults slice** (it changes
the options these slices validate; their fixture comparison runs on the new defaults). If either has not merged when
their wave comes up, the fast-path syntax slice and the watch slice, which do not depend on them, move ahead. This
plan does not change `reportedConfigErrors` or the `depends` closure, which #134 owns.

### Open Points

- [x] **Exit code for option and config errors** — decided: keep 1, pending approval. websmith exits 1 for every
      failure (`command.ts:168`), CI scripts test zero against non-zero, and a second failure code for one class of
      error would be the only one of its kind. `tsc`'s 2 ("emitted despite errors") is stated as a difference in the
      Changelog, `Release-Notes.md` and `packages/compiler/README.md`.
- [x] **`getGlobalDiagnostics` on the per-file declaration path** — decided: closed, pending approval. The panel ran it:
      TS2688 is in `getOptionsDiagnostics()`, `getGlobalDiagnostics()` is empty for it, so per-file
      `getOptionsDiagnostics()` covers TS2688 and no extra Program is needed. Only checker globals (TS2318 under
      `noLib`) stay Program-path only, stated in the Changelog. Slice 5 adds a `rootDir` (TS6059) unit test, since
      TS6059 depends on the per-file Program's file set.
- [x] **One `emitSkipped` rule** — decided: `emitSkipped` only without output files or with `noEmitOnError` and an
      error, applied at the three producers, pending approval. Otherwise the same option error emits or not depending on
      the path that found it. Lands in slice 3, before the slices that start reporting more option errors.
- [x] **`-p` with file names (TS5042)** — decided: keep websmith's behaviour as a deliberate difference, pending
      approval. `tsc` refuses `-p` with file names; websmith compiles the named files with the tsconfig's options.
      That was added on purpose (`a3e25466`, "Fixes an issue where CLI file names are not passed to the compiler",
      #84) and has `bin.spec.ts` coverage, so turning it into an error would break a fixed bug's users. Slice 1
      documents it in `packages/compiler/README.md`; it is not a silent success, since the named files are compiled.
- [x] **Slice 6 mechanism (fast-path syntax check)** — decided: `ts.transpileModule` with `reportDiagnostics: true`,
      keeping only diagnostics with a file, pending approval. `ts.createSourceFile` exposes no public syntactic
      diagnostics (`parseDiagnostics` is internal). `transpileModule` is what the fast path already runs for every
      `.ts` file (`Compiler.ts:1397`), so each `.d.ts` or JavaScript source costs one more such call and no new kind
      of work. The PR measures the build time of a fixture with many `.d.ts` files before and after and states it. If
      `transpileModule` does not report a `.d.ts` syntax error, the fallback is a single-file Program with
      `getSyntacticDiagnostics()`, as `transpileNodeModule` does (`:1480-1485`).
- [x] **Config discovery** — decided: out of scope, pending approval. websmith reads `websmith.config.json` only when
      passed with `--configFile` (`README.md:57`, "websmith does not look for it on its own"); a malformed file that is
      not passed is not read, so it is not an error.
- [ ] **Webpack loader.** Items 1 to 4 live in `packages/core`, which the loader shares. The fix reaches the loader
      too; once per module is #134's errors-once slice, ordered before slices 4 and 5. Each slice runs
      `packages/webpack-test` and notes any change in the loader's output in its PR.
- [ ] **Watch e2e.** `bin.test.ts` has no watch case. Slice 7 adds one that starts `--watch`, changes a generator
      input, and stops the process; if that proves flaky in CI, unit tests on a watching test system are the fallback,
      stated in the PR.

## Slices

### Project resolution

- `bug/cli-project-directory` — item 6: `--project` normalised once in `resolvePathsWithRules` for all three guards; `-p <directory>` compiles `<directory>/tsconfig.json`, a missing path reports TS5058 and a directory without `tsconfig.json` TS5057, both with the resolved absolute path; README states the TS5042 difference. Unit: `parsed-command-line.spec.ts`, `ResolvedCompilerOptions.spec.ts`, `command.spec.ts`; e2e in `bin.test.ts`: `-p .` from the project directory compiles and fails on a syntax error, `-p <absolute directory>` compiles, `-p missing.json` exits 1 with TS5058, `-p emptydir` exits 1 with TS5057; `Release-Notes.md` entry <!-- builds: --project directory and missing-path resolution shared by parsedCommandLine and ResolvedCompilerOptions -->

### websmith.config.json and addonsDir

- `bug/cli-config-parse-and-addons-dir` — items 4, 5: a malformed `websmith.config.json` passed with `--configFile` reported as an `ErrorMessage` with the file path, one line, no stack; the `addonsDir` warning only from the `AddonRegistry`. Unit: `resolve-compiler-config.spec.ts`, `command.spec.ts`; e2e in `bin.test.ts`: malformed config exits 1 without a stack trace and names the file, missing `--addonsDir` warns once (extends the test at `bin.test.ts:455`); `Release-Notes.md` entry <!-- builds: reported websmith.config.json parse errors and a single addonsDir warning -->

### The emitSkipped rule

- `bug/emit-skipped-rule` — item 8 and the output rule for items 1 to 3: the language-service branches (`Compiler.ts:1201-1203`, `:1256-1258`) and the fast path (`:1414`) set `emitSkipped` only without output files or with `noEmitOnError` and an error. Unit: `Compiler.spec.ts` for the three producers, with and without `noEmitOnError`; e2e in `bin.test.ts` or `packages/compiler-test`: type-info addon, `declaration`, TS4094 source writes `a.js` and exits 1, as without the addon; fast path with an invalid option combination (TS5095) writes output and exits 1; `Release-Notes.md` entry <!-- builds: one emitSkipped rule for language-service and fast-path output under option and declaration errors -->

### Option errors

- `bug/report-config-option-errors` — item 1, after #134's errors-once slice and #135's defaults slice: `configErrors` on `ResolvedCompilerOptions` from the one parse of the CLI's tsconfig, reported once at the start of `compile()` and `watch()`, emit continues. Unit: `ResolvedCompilerOptions.spec.ts`, `Compiler.spec.ts` (two-profile project reports once, watch reports once across rebuilds); e2e in `bin.test.ts`: unknown option exits 1 with TS5023 and writes output; every `compiler-test`/`webpack-test` fixture and example project run before and after, differences with `tsc` listed in the PR; README exit-code line and `Release-Notes.md` entry "builds that passed may now fail" <!-- builds: configErrors as the single source of tsconfig parse errors, reported once per compile and watch session -->

### Errors without a file

- `bug/report-file-less-diagnostics` — items 2, 3, after #134's errors-once slice and #135's defaults slice: `report()` no longer drops file-less diagnostics of the Program, the per-file declaration Programs return `getOptionsDiagnostics()`, `watch()` reports the options diagnostics of the language-service Program once per session. Unit: `Compiler.spec.ts` with new file-less mocks (the existing ones at `:1655-1715` all set `file`), the once-only key, a `rootDir` violation (TS6059) once per offending file, and watch; e2e in `bin.test.ts`: `types: ["does-not-exist"]` with a type-info addon exits 1 with TS2688, `declaration: true` with an invalid option combination exits 1 with TS5095 once; every `compiler-test`/`webpack-test` fixture and example project run before and after removing the filter at `Compiler.ts:670-673`; `Release-Notes.md` entry <!-- builds: file-less and option diagnostics in Compiler.report, the per-file declaration Program and watch -->

### Fast path for .d.ts and JavaScript

- `bug/fast-path-dts-js-syntax-errors` — item 7: `.d.ts` sources and, under `allowJs`, `.js`/`.jsx`/`.mjs`/`.cjs` sources are syntax-checked on the fast path with `transpileModule` and `reportDiagnostics`; output unchanged, `.json` untouched; build time of a many-`.d.ts` fixture measured before and after in the PR. Unit: `Compiler.spec.ts`; e2e in `bin.test.ts`: a syntax error in a `.d.ts` source exits 1 with TS1110 and in a `.js` source with `allowJs` exits 1 with TS1109/TS1134, without asserting the `.js` output path (the `allowJs` layout differs from `tsc`, see Notes); `Release-Notes.md` entry <!-- builds: syntactic diagnostics for .d.ts and JavaScript sources on the transpileModule fast path -->

### Watch

- `bug/watch-generator-added-files` — item 9: one watcher per path and profile set regardless of how often a generator re-adds it, and the first watch build emits generator-added files. Unit: `Compiler.spec.ts` and `CompilationContext.spec.ts` on a watching test system; e2e: a `--watch` case in `bin.test.ts` (see Open Points); `Release-Notes.md` entry <!-- builds: deduplicated registerWatch and first-build emit of generator-added files -->

## Notes

- Created 2026-10-02 from the story's open points and follow-up logs. Type `bug`, plan PR review, own branches,
  as asked.
- **Amended after the draft panel** (2026-10-02, `.plot/panels/2026-10-02-cli-error-exit-gaps/`, unanimous amend):
  headline and Changelog narrowed to option, configuration, file-less and syntax errors, and "every compilation
  path" replaced by the paths actually covered (watch added, checker globals named); the former slice 1 split into
  `--project` resolution (first), config and `addonsDir`, and option errors with `configErrors` as the single source
  of truth reported once at `compile()`/`watch()` start; one `emitSkipped` rule decided and item 8 fixed at the
  language-service branches without a second emit (own slice, before the reporting slices); Open Point 2 closed on
  the panel's run; slice 6 mechanism named (`transpileModule`, JS extensions under `allowJs`, measured, no output
  path assertion); TS5042, exit code and config discovery decided; ordering against #134 and #135 stated; fixture
  comparison before and after removing the file-less filter; Release-Notes line that previously green builds can
  now fail. `-p <directory>` is owned here: #135 does not claim it.
- **Follow-up, not in this plan: type errors on the default CLI path.** With no addon needing type information and
  no `declaration`, websmith takes the `transpileModule` fast path and reports no type errors
  (`const x: number = "s"`: `tsc` TS2322 exit 2, websmith nothing, exit 0; ran by the panel's tsc-parity juror, seen
  independently by #135's panel). Whether the CLI should type-check by default is a design decision about the fast
  path (cost, `transpileOnly` semantics, `docs/rules/configuration.md`), not a reporting gap; it may become its own
  plan.
- **Follow-up, not in this plan: `allowJs` output layout.** With `src/b.js` and `allowJs`, `tsc` writes `out/b.js`
  (inferred `rootDir`), websmith writes `out/src/b.js` (tsc-parity juror, ran, not investigated). Slice 6 does not
  assert the path.
- **TS 7 inventory.** Slices 3, 5 and 6 add uses of per-file Programs, `transpileModule` and the language service,
  which the TS 7 API-gap analysis marks missing (`analysis-ts7-api-gap.md:61-65`); each PR adds its use to that
  inventory.
- **Dropped as already fixed:** none of the nine. Related and already fixed: "option errors print once per root
  file" (#130, CLI and watch). #130 does not fix item 2: it keys file-less diagnostics, but the filter at
  `Compiler.ts:672` still drops them before the key on the Program path.
- **Confirmed by running** (`pnpm build`, `node packages/compiler/bin/bin.js`, fixtures in a scratch directory,
  compared with `tsc` from the workspace): items 1, 2, 3, 4, 5, 6, 7, 8. Item 8 was "not yet confirmed" in the story
  and reproduces. Item 6 reproduces for every `-p <directory>`, not only with relative paths or `-c`.
- **From the code only:** item 9 (watch). Slice 7 writes the failing test first.
- **Not taken here** (sibling plans or out of theme): webpack loader items (`loader-options-once`, which also owns
  `reportedConfigErrors` and the `depends` closure); nested compiles checked twice (`esm-check-precision`);
  `hasInvalidProfile`'s wrong warning for a missing `depends` and the four copies of the `depends` closure
  (2026-09-30 log, not assigned to this plan); the 2026-09-25 relative-import and attribution items.
- **Deliverable search** (`plot-deliverable-search.sh`): `cliArgs.errors`, `Cannot find a tsconfig.json`,
  `fileExists(tsConfigFile)` — no existing reporting of parse errors or directory resolution; the only `fileExists`
  hit near the topic is `packages/compiler/src/find-config.ts:10` (`ts.findConfigFile`, used for config discovery,
  not for `--project`), a candidate to reuse in slice 1. `getOptionsDiagnostics`, `getGlobalDiagnostics` — only
  mocks in `Compiler.spec.ts:1663-1709`, no production caller. `getSyntacticDiagnostics` — the existing calls at
  `Compiler.ts:1246`, `:1262`, `:1326`, `:1478`. `getEmitOutput` — `Compiler.ts` only. `registerWatch`,
  `watchedFiles` — `Compiler.ts:260`, `:264`, `:453`, `:889`; no existing watcher deduplication.
