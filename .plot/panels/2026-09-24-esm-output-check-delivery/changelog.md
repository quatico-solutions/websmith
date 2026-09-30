<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# changelog

Plan: `docs/plans/2026-09-24-esm-output-check.md`, `## Changelog`, checked against the diffs of #115, #119–#125 and
`Release-Notes.md` `[Unreleased]` on develop `ce7627f`.

## Plan `## Changelog`

| # | Line | Verdict | Evidence |
|---|------|---------|----------|
| C1 | Per-profile `esm` `{ runtime, check, ignore }`; diagnostics when emitted JavaScript is not ESM compatible, including addon-generated code | SUPPORTED | #119 `EsmProfileOptions`, `CompilationProfile.esm`; `checkEsm` parses emitted output, after transformers; validation in `resolve-compiler-config.ts:106-131` |
| C2a | `websmith` exits non-zero on an error-level diagnostic, including TypeScript errors that previously only printed | SUPPORTED | #115 `ErrorTrackingReporter`; `command.ts:171-175` sets `process.exitCode = 1` |
| C2b | "The webpack loader fails the build for them" | REFUTED (overstated) | The loader reports only `emitSourceFile`'s diagnostics plus ESM findings (`TsCompiler.ts:216`, `loader.ts` `reportDiagnostics`): syntax errors (`Compiler.ts:1202,1218`) and declaration-emit errors. `getPreEmitDiagnostics` runs only in the CLI's `report()` (`Compiler.ts:663`), so TypeScript type errors never reach the loader and do not fail webpack builds. `Release-Notes.md` states this correctly |

In the reverse direction, the plan's changelog leaves out user-visible changes:
- `.mts`/`.cts` loader support;
- the `error`/`warn` option semantics and the `file (line,col): ` prefix;
- the diagnostic codes;
- the `esm`/`module` config error.

`Release-Notes.md` covers all of them except the last.

## `Release-Notes.md` `[Unreleased]`

All ESM entries are SUPPORTED by the code. The minor points:
- the 91005 warning is not described;
- the TypeScript-code labelling applies to the CLI's Program path only, which the entry doesn't say;
- "no addon when the construct comes from the project's own source" really means "when no addon changed the
  file";
- the new config errors (non-ESM `module`, missing or unknown `runtime`, invalid `check` or `ignore`) and the
  non-inheritance through `depends` are not listed; the README covers them.

## Gaps

- **Plan C2b** implies webpack builds are type-checked. Reword to "the webpack loader fails the build for the
  error-level diagnostics it reports (syntax, declaration emit, ESM check)", or point to `Release-Notes.md`.
- Low: the plan changelog's omissions, and the `Release-Notes.md` imprecisions above.

## Executed vs read

- **Executed:**
  - webpack jest: 168 passed;
  - core ESM jest: 256 passed, 19 failed in `cjs-names.spec.ts` because the local `node_modules` predates #121;
  - the Compiler labelling specs: 13 passed;
  - `gh pr view` for all PRs.

  The compiler `bin.test.ts` run could not use a current build (stale `bin.js`, Node 20), so the CLI behaviour was
  not reproduced locally.
- **Read:** `gh pr diff` for each PR, and the relevant sources and READMEs on develop.

Position: refuted
Evidence: read
