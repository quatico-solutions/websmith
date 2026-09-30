<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# behaviour

Plan: `docs/plans/2026-09-24-esm-output-check.md`. Setup: `git archive` of develop `ce7627f` into the scratchpad,
`pnpm install --frozen-lockfile --offline`, then fresh builds of `api`, `core`, `webpack` and `compiler`. Fixture
projects are in `scratchpad/fx/{p1..p9,w1,w2}`.

## Evidence (executed)

| # | Check | Result | Output (abridged) |
|---|-------|--------|-------------------|
| 1a | A processor addon injects `require` under `"type": "module"` with `esm: { runtime: "node" }` | pass | `dist/index.js (2,19): ESM91001 … (profile "client", addons: req-addon)`, exit 1; `node dist/index.js` throws `ReferenceError` at the same position |
| 1b | The same with `check: "warn"` | pass | `Warning: … ESM91001`, exit 0 |
| 1c | The same without `esm` | pass | nothing reported, exit 0 |
| 1d | A `.cts` emitting `export` into `.cjs` (`module: Preserve`) | pass | `dist/shim.cjs (1,1): ESM91030`, exit 1 |
| 1d' | A `ResultProcessor` writes JavaScript through `ctx.getSystem().writeFile` | pass | 91030 and 91001, both naming `rp-addon`, exit 1 |
| 1e | Extensionless and directory imports | pass | 91010 with the hint `"./b.js"`; 91011 with `"./utils/index.js"` |
| 1f | A named import a CommonJS package lacks | pass | `ESM91020: "missing" is not a named export of CommonJS module "cjspkg"` |
| 1f' | Code that must not be flagged | pass | `createRequire(import.meta.url)`, a `typeof module` guard and `__exportStar` re-exports: nothing reported |
| 1f'' | 91005, 91013, 91021 | pass | all fire; Node confirms 91013 with `ERR_IMPORT_ATTRIBUTE_MISSING` |
| 1g | `esm` with `tsConfig.module: CommonJS` gives one config error | **FAIL** | printed twice per run: once with the relative config path and once with the absolute one |
| 1g' | Related config behaviour | observed | the error also fails `--profile good`; `--module commonjs` adds a third, different error; the existing `depends` error and the new `esm.runtime` error are doubled too |
| 1h | `ignore: ["dist/*.cjs"]` with `--debug` | pass | `ESM check skipped …: matches esm.ignore pattern` |
| 1i | `esm` is not inherited through `depends` | pass | only the client output is flagged |
| 2a | TypeScript type error on the Program path | pass | exit 1 |
| 2b | Syntax error on the Program path | pass | exit 1 |
| 2c | Syntax error on the default `transpileModule` fast path | gap | nothing reported, exit 0, the broken output is written; `transpileModule(..., { reportDiagnostics: true })` returns TS1109, which websmith discards |
| 3a | webpack-cli, a `javascript/esm` rule, `require` in `b.ts` | pass | `ERROR in ./src/b.ts … ESM91001`, exit 1 (also under `transpileOnly`) |
| 3b | The same with `check: "warn"` | pass | `WARNING in ./src/b.ts`, exit 0 |
| 3c | `runtime: "bundler"`, a `.ts` under `"type": "module"`, no rule type | pass | compiled successfully |
| 3d | A `.mts` entry | pass | builds, and `node dist/main.js` runs |
| 3e | webpack watch: add `require`, then remove it | pass | the error on rebuild 2 clears on rebuild 3; only `b.ts` rebuilt |
| 3f | `webpack-esm-check.test.ts` in a scratch copy | flaky | 8 of 8 non-watch tests pass; the 3 watch tests fail under CPU load (a spurious first rebuild uses up the step); develop CI is green |
| 4 | CLI `--watch` | pass | reports ESM91001 on the edit and stays alive |

## Gaps

- **Config errors print twice** (1g). This contradicts the plan's "reported once". `resolveCompilationConfig` runs
  twice per CLI run.
- **One bad profile fails every profile** (1g'). The whole config is validated, not only the selected profile.
- **Syntax errors on the fast path are dropped** (2c). This predates the plan, but it undercuts "an error-level
  diagnostic fails the build".
- **91010/91011 under `bundler` in the loader.** The plan table's `bundler` column differs from the loader's
  behaviour, which follows the brief's amended decision. This is not a runtime false negative.
- **The webpack watch e2e tests are timing-flaky under CPU load.**

## Executed vs read

- **Executed:** every row of the evidence table above, fresh in this session.
- **Read:** the plan; both READMEs; `resolve-compiler-config.ts`; the call chain of `loadCompilationConfig` and
  `createOptions`; the fast path in `Compiler.ts`; develop's CI status.

Position: refuted
Evidence: executed
