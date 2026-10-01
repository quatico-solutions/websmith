<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# changelog

## Setup

- **Plan:** `docs/plans/2026-09-24-esm-output-check.md` at develop `3de39b1`, its `## Changelog` section.
- **Also checked:** `Release-Notes.md` `## [Unreleased]`, `packages/compiler/README.md` and `packages/webpack/README.md`.
- **Diffs:** `gh pr diff` for #115, #119–#123 and #125–#129. Wave 5 (#126–#129) is the focus of this round.
- **Build:** `git archive 3de39b1` extracted to `scratchpad/juror-changelog`. Ran `pnpm install --frozen-lockfile --offline` and `pnpm build` on Node 22.17.0 with pnpm 10.34.1. The build passed (9 projects).
- **Fixtures:** in `scratchpad/juror-changelog-fx/f1`–`f13`, run against the built `packages/compiler/bin/bin.js`.

## Evidence

### Executed

**CLI fixtures** (all against the build from `3de39b1`):

- **f1, fast path:** `export const a = ;` printed `src/a.ts (1,18): Expression expected.` once, and the command exited 1. `lib/a.js` was still written. A type error in `b.ts` on the same path printed nothing.
- **f1 with `-o` (transpileOnly):** the same syntax error, exit 1. The file was emitted as `export const a = ;`.
- **f4, `module: nodenext` with `"type": "module"`:** the syntax error was reported, exit 1.
- **f2, `declaration: true`:** the syntax error was printed once, exit 1, and `.d.ts` files were written.
- **f2b, type error only:** exit 0.
- **f2c, `noEmitOnError`:** the type error was printed once, exit 1, nothing emitted.
- **f5, `allowJs` with a `.js` syntax error:** exit 0, no diagnostic.
- **f6, `sourceMap` + `inlineSourceMap`:** TS5053 was reported, exit 1, and no `lib/` was emitted.
- **f7, config profiles:**
  - The config has profiles `good`, `bad` (unknown `depends`, `esm.runtime: "deno"`, `tsConfig.target: "ES9999"`) and `usesbad` (depends on `bad`).
  - `--profile good` exited 0 with no error.
  - `--profile bad` and `--profile usesbad` printed the three errors once each and exited 1.
  - No `--profile` exited 0.
- **f8, ESM source naming:**
  - Profile `client` has `esm.runtime: "node"`, and `src/client.ts` uses `require`.
  - Output: `lib/client.js (1,12): ESM91001: … (source "src/client.ts", profile "client").`, exit 1.
  - The same output appears with `-d`.
- **f9, a processor that prepends one line, on a file with a syntax error:**
  - With a type-info addon, the error was printed at both `(1,18)` and `(2,18)`.
  - With `-o`, only at `(2,18)`.
- **f11 and f12, watch mode** (`-w`, with and without `declaration`):
  - A syntax error introduced by an edit was printed.
  - A syntax error present at startup was printed.
- **f10 and f13, a syntax error together with a declaration emit error in the same file** (per-file declaration path):
  - f13 has TS4094 plus TS1109; f10 has `isolatedDeclarations` with TS9010 plus TS1109.
  - websmith printed only the declaration error and exited 1.
  - `tsc` on the same project printed both errors.
  - The f10 watch run showed the same behaviour.
  - A probe script showed why: `program.emit` returns `emitSkipped: true` when declaration diagnostics exist, so `Compiler.ts` (~1309) drops `getSyntacticDiagnostics`.

**Test suites:**

- webpack e2e `webpack-profile-config`, `webpack-esm-check` and `websmith-loader`: 27 passed, 1 skipped. These include:
  - the transpileOnly syntax error that fails a loader build;
  - `(source "src/a.ts", profile "target", addons: require-injector)`;
  - a valid selected profile alongside a broken unselected one.
- compiler e2e filtered with `-t 'syntax error|config|profile|source'`: 23 passed, including all five new #129 cases and the #128 and #127 cases.

### Read

- The `gh pr view` file lists for all 11 PRs.
- The `Release-Notes.md` and README hunks of #127, #128 and #129.
- The code hunks of #128:
  - `command.ts`, which uses `NoReporter` for the first options resolution;
  - `resolve-compiler-config.ts`, `getUsedProfiles`;
  - `ResolvedCompilerOptions.ts` and `options.ts`, which pass `profile`.
- The code hunks of #129 in `Compiler.ts`:
  - deduplication in `report()` by file/start/code/message;
  - `emitWatchedFile`;
  - `reportDiagnostics: true`;
  - `emitSkipped` only for file-less diagnostics;
  - syntactic diagnostics in the per-file and node16 programs.
- The round-1 verdict files.
- The current webpack README section on failing diagnostics.

## Findings

### Plan `## Changelog`

| # | Claim | Verdict | Evidence |
|---|-------|---------|----------|
| C1 | Per-profile `esm` `{ runtime, check, ignore }`, with diagnostics on emitted JavaScript including addon-generated code | SUPPORTED | #119 `CompilationProfile.esm` and `checkEsm`; f8 executed |
| C2a | `websmith` exits non-zero on an error-level diagnostic, including TypeScript errors that previously only printed | SUPPORTED | #115 `ErrorTrackingReporter`; f1, f2c, f6, f7, f8 exit 1 |
| C2b | The loader fails the build for the errors it reports (syntax, declaration emit, ESM findings), not type errors, see `Release-Notes.md` | SUPPORTED | The reworded line now matches the code. Type errors come only from `getPreEmitDiagnostics` in the CLI `report()`, and #129 adds syntactic diagnostics only, not semantic ones. The `websmith-loader` e2e test for transpileOnly syntax errors passed. This resolves round 1's C2b refutation. |

Reverse direction: the plan's changelog does not mention Wave 5's user-visible changes:
- the source file in diagnostics;
- profile-scoped config validation, printed once;
- the duplicate-position limit.

It points to `Release-Notes.md`, which covers all of them, so I count this as an omission that the plan delegates, not a false statement.

### `Release-Notes.md` `[Unreleased]`, Wave 5 entries

| Claim | Verdict | Evidence |
|-------|---------|----------|
| ESM diagnostics name the source file, e.g. `(source "src/a.ts", profile "client")`, in CLI, watch and loader builds; files from result processors name none | SUPPORTED | #127 hunks; f8 (CLI, plus `-d`); the loader e2e test at `webpack-esm-check.test.ts:136`. The watch path and the result-processor case were read only. |
| Config errors only for the selected profile and its `depends`, in the CLI and loader; none without a profile; printed once | SUPPORTED | #128 `getUsedProfiles` and `NoReporter`; f7 (good/bad/usesbad/none, each error printed once); `webpack-profile-config` e2e |
| Syntax errors in `.ts`/`.tsx`/`.mts`/`.cts` fail every build, including the fast path, transpileOnly and per-file declaration programs | SUPPORTED (exit code) | f1, f1 with `-o`, f2, f4 exit 1 |
| The fast path does not check declaration files and JavaScript sources | SUPPORTED | f5 exit 0 |
| Fixed: syntax errors are *reported* on the fast path and in per-file declaration programs; the file is still emitted | SUPPORTED, with one gap | f1, f2, f4 report and emit. Exception: when the same file also has a declaration emit error (TS4094, TS9xxx), the syntax error is not printed (f13, f10), unlike `tsc`. The cause is `emitSkipped ? emitResult.diagnostics : [...getSyntacticDiagnostics, ...]` in `Compiler.ts`. The comment there assumes only `noEmitOnError` skips the emit. The build still exits 1. |
| Type errors still exit 0 on per-file declaration programs "unless `noEmitOnError` is set" | SUPPORTED | f2b exit 0; f2c exit 1 |
| An error found by both the Program and the emit is printed once; a processor that shifts positions prints it at both positions | SUPPORTED | #129 `report()` dedup; f2c and f2 printed once; f9 printed `(1,18)` and `(2,18)`; e2e it.each with `noEmitOnError` |
| Invalid code from processors is reported at its position in the processed text | SUPPORTED | f9 `-o` showed `(2,18)`; e2e "processor appending invalid code" |
| TS5053 fails fast-path builds and skips their emit | SUPPORTED | f6 exit 1, no `lib/` |
| Watch mode reports the syntax and declaration errors of each rebuilt file | SUPPORTED | f11 and f12 (syntax); f10 (TS9010/TS9007 on rebuild). The same gap as above applies: the syntax error was missing when a declaration error was also present. |
| Loader: syntax errors fail builds also on the fast path and under `transpileOnly: true` | SUPPORTED | #129 e2e test `websmith-loader.test.ts` ("should fail with syntax error w/ … transpileOnly"), which passed |
| "Before" statements (the CLI printed config errors twice; the fast path discarded syntax errors and ignored TS5053) | READ only | Consistent with the removed lines in the #128 and #129 hunks. The pre-#128 and pre-#129 builds were not run. |

### README

- **`packages/compiler/README.md`:**
  - The #127 source-naming paragraph matches f8.
  - The #128 profile-scoped validation paragraph matches f7.
- **`packages/webpack/README.md` is stale after #129.**
  - Lines 77–79 still say the errors that fail the build are "syntax errors under `transpileOnly: false`".
  - Under `transpileOnly: true` they now fail too: `Release-Notes.md` says so, and the e2e test passed.
  - #129 did not touch this README.
  - The sentence is not false, but by naming only `transpileOnly: false` it implies the old restriction.

### Gaps (none contradicts the plan's `## Changelog`)

1. **Per-file declaration path:** a syntax error is not printed when the same file also has a declaration emit error.
   - The Release-Notes "Fixed" entry says these errors are reported on that path.
   - The exit code is still 1.
   - This is a narrow overclaim, or a narrow defect, depending on the reading.
2. **`packages/webpack/README.md` lines 77–79** were not updated for fast-path and transpileOnly syntax errors.
3. **Unrelated observation:** `--profile bad` also printed the pre-existing warning `Custom profile configuration "bad" found, but no profile provided.` even though a profile was given. No Wave 5 claim covers it.

Position: supported
Evidence: executed
