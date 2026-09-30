<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# deliverable

Plan: `docs/plans/2026-09-24-esm-output-check.md`. Evidence: merged PRs #115, #119–#125 on develop `ce7627f`, a clean
clone of develop with `pnpm install --frozen-lockfile`, and the briefs' recorded amendments.

## Deliverables and verdicts

| # | Deliverable | Status | Evidence |
|---|-------------|--------|----------|
| 1 | The CLI exits non-zero on any error-level diagnostic | SUPPORTED | #115 `ErrorTrackingReporter.ts`, `command.ts:174`; the probe exited 1 |
| 2 | `processOutput` returns a written set; `ResultProcessor`s keep today's list | SUPPORTED | `Compiler.ts:35` `writtenFiles`, `:713-745` |
| 3 | The loader reports through the per-call `this.emitError` / `this.emitWarning` | SUPPORTED | #125 `loader.ts:56,59` |
| 4 | An `esm` option on `CompilationProfile` | SUPPORTED | #119 `CompilationProfile.ts:31-45` |
| 5 | Validation; `esm` vs `tsConfig.module` is a config error; `esm` is not inherited through `depends` | SUPPORTED | `resolve-compiler-config.ts:106-131,162`. The CLI prints the error twice: a recorded story follow-up |
| 6 | `ignore` globs, listed with `--debug` | SUPPORTED | `check-esm.ts:211-234`; the probe printed the skip message |
| 7 | Classification by runtime, webpack module type under `bundler` | SUPPORTED | `classify-module.ts`, `TsCompiler.ts:39` `MODULE_KINDS`; the `dynamic` kind comes from a wave 2 review amendment |
| 8 | One `ts.createSourceFile` parse, own scope walk, `typeof` exemption, behind an interface | SUPPORTED | `scan-module.ts:43,216-281` |
| 9 | Shared `checkEsm`, located diagnostics, codes 91000–91099 | SUPPORTED | `check-esm.ts:128` |
| 10 | Free-identifier rules and the mixing rule | SUPPORTED | 91001–91004 |
| 11 | Relative-import rules and the JSON attribute rule | SUPPORTED | #120 `import-rules.ts`; the probe fired 91010 |
| 12 | `cjs-module-lexer` ^2, `resolve.exports` ^2; rules 91020/91021 | SUPPORTED | #121 `core/package.json:40,46`, `cjs-names.ts` |
| 13 | Package-type rules and top-level `await` | SUPPORTED | #122 `package-type-rules.ts` 91030–91033 |
| 14 | Best-effort TypeScript `nodenext` labels | SUPPORTED | `Compiler.ts:100-105`; missing in the loader is a recorded follow-up |
| 15 | `watch()` coverage | SUPPORTED | #123 `checkWatchedFragment` |
| 16 | `ResultProcessor` writes checked; `fs` writes documented | SUPPORTED | `Compiler.ts:749-763`; `compiler/README.md:250-251` |
| 17 | Per-addon attribution | SUPPORTED | `CompilationContext.ts:253-262,362-375,418-421`; "list the changers or none" per the coverage brief amendment |
| 18 | **Diagnostics carry the source file**, emitted file and position, construct, code and fix hint | **PARTIAL** | `check-esm.ts:128,206`: the message has the emitted file, position, code, hint, profile and addons, but **no source file**. `AttributedOutput` carries only `files` and `addons`. The probe printed `out/a.js (1,18): ESM91001: … (profile "client")`, with no `src/a.ts`. No brief, story entry or panel records a decision to drop it; the addon-author juror (`2026-09-24-esm-output-check/addon-author.md:53`) asked for it |
| 19 | Loader checks the target (`fragment.files`) and dependents (`writtenFiles`, own `esm`) | SUPPORTED | `TsCompiler.ts:192-217,233-256` |
| 20 | Loader never runs 91012; `addDependency` for every file read | SUPPORTED | `TsCompiler.ts:250`, `loader.ts:27,32-33` |
| 21 | `.mjs`/`.cjs` in `processResultAndFinish` | SUPPORTED | `result-handling.ts:388-390` |
| 22 | Caching, memoized `package.json` lookups | SUPPORTED (amended) | per-compilation caches; rules rerun on every call per the webpack brief |
| 23 | ≤10% watch-rebuild gate | SUPPORTED (amended) | the benchmark; judged on the check's own cost, decided 2026-09-30 (story) |
| 24 | Changelog items and README docs | SUPPORTED | `Release-Notes.md` `[Unreleased]`; the code tables in both READMEs |
| 25 | Definition of Done | PARTIAL (partly verified) | build and the core, webpack and compiler tests plus the webpack ESM e2e passed in the clean clone; lint and the full e2e rest on PR #125 |

## Gaps

- The diagnostics do not name the source file (item 18). Medium risk: addon authors map `out/*.js` back to the
  source themselves. Either carry the source file name in `AttributedOutput` and the message suffix, or record the
  decision that the emitted path is enough.
- The config error prints twice on the CLI: a recorded follow-up.
- The local checkout's `node_modules` predates #121: environment only.

## Executed vs read

- **Executed:**
  - `gh pr view` for all 8 PRs;
  - a clean clone of develop, then `pnpm install --frozen-lockfile` and `pnpm build`;
  - jest: core `src/compiler` (760 passed), webpack specs (130), compiler spec and test (146), webpack ESM e2e (11);
  - three CLI probes: the exit code with 91001/91010, the `esm`/`module` config error, and `ignore` with `--debug`.
- **Read:** the plan, all briefs and their amendments, the story's follow-ups, PR #125's body, both READMEs and
  `Release-Notes.md`.

Position: refuted
Evidence: executed
