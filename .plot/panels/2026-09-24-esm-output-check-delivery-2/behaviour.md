<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# behaviour

Plan: `docs/plans/2026-09-24-esm-output-check.md`. Evidence: PRs #115, #119–#123, #125–#129 on develop `3de39b1`.

## Setup

- I made a copy with `git archive 3de39b1 | tar -x` into `scratchpad/juror-behaviour/repo`.
- I ran `pnpm install --frozen-lockfile --offline` (pnpm 10.34.1, Node 22.17.0, `NX_DAEMON=false`), then built
  `api`, `core`, `websmith-loader`, `compiler` and `node` from that copy.
- The fixture projects are in `scratchpad/juror-behaviour/fx/`:
  - CLI: `p1*`, `c1`, `s1`, `s2`, `r1`, `k1`–`k3`, `a1`, `t1`, `t2`, `w1`;
  - webpack: `wp1`.
- The CLI ran as `node repo/packages/compiler/bin/bin.js`. webpack ran as webpack-cli 5 / webpack 5.97.1 from
  `packages/webpack-test`, with `repo/packages/webpack/lib/index.js` as the loader.
- The CLI loads `websmith.config.json` only when `-c` is passed. This is old behaviour, not part of this plan (see
  Findings), so every CLI run below passes `-c websmith.config.json`.
- I killed every watch process I started and checked that none was left.

## Evidence (executed)

### Wave 5 behaviours

| # | Check | Result | Output (abridged) |
|---|-------|--------|-------------------|
| W5-1 | #127, CLI: the diagnostic names the source file | supported | `dist/index.js (2,22): ESM91001: "require" is not defined in ES module output; … (source "src/index.ts", profile "client", addons: req-addon).`, exit 1 |
| W5-2 | #127, a file a result processor creates names no source | supported | `dist/gen.js (1,1): ESM91032: … (profile "client", addons: rp-addon).` |
| W5-3 | #127, CLI `--watch` | supported | `dist/k.js (1,18): ESM91001: … (source "src/k.ts", profile "client")` |
| W5-4 | #127, webpack loader | supported | `ERROR in ./src/b.ts … out/b.js (1,18): ESM91001: … (source "src/b.ts", profile "client").` |
| W5-5 | #129, syntax error on the fast path (no addons) | supported | `src/bad.ts (1,18): Expression expected.` and `src/m.mts (1,18): Expression expected.`, exit 1; the output is still written |
| W5-6 | #129, the same with `--transpileOnly`, `--declaration`, `--module nodenext`, and `--declaration --module nodenext` | supported | the same two errors each time, exit 1; `--declaration` writes `bad.d.ts` and `m.d.mts` |
| W5-7 | #129, syntax errors in `.ts` and `.cts` next to an ESM finding (Program path) | supported | `src/bad.ts (1,18)` and `src/c.cts (1,18)` `Expression expected.`, plus ESM91001, exit 1 |
| W5-8 | #129, CLI watch reports a syntax error on rebuild | supported | `src/k.ts (1,18): Expression expected.`; the watcher stayed alive until I killed it |
| W5-9 | #129, loader syntax error, `transpileOnly` false and true | supported | `Module Error (from …/webpack/lib/index.js): src/c.ts (1,18): Expression expected.`, `compiled with 2 errors`, exit 1 |
| W5-10 | #128, CLI `--profile bad` (`esm` with `tsConfig.module: CommonJS`) | supported | one line: `Profile 'bad' of '…/websmith.config.json' sets 'esm', but its 'tsConfig.module' is 'CommonJS'. …`, exit 1 |
| W5-11 | #128, CLI `--profile baddep` (unknown profile in `depends`) and `--profile badrt` (`esm.runtime: "deno"`) | supported | one error each: `Unknown profile 'nope' in 'depends' …` and `Unknown 'esm.runtime' value 'deno' …`, exit 1 |
| W5-12 | #128, CLI `--profile good` in a config that also holds the three broken profiles | supported | no output, exit 0 |
| W5-13 | #128, CLI `--profile ondep`, which depends on `bad` | supported | `bad`'s error printed once, exit 1 |
| W5-14 | #128, CLI without `--profile` | supported | no output, exit 0 |
| W5-15 | #128, CLI `--profile goodesm --module commonjs` | supported | one error: `Profile 'goodesm' sets 'esm', but its effective 'module' is 'CommonJS' from tsconfig.json, a dependent profile or the command line. … The ESM check skips this profile.`, exit 1. Round 1 saw three errors here. |
| W5-16 | #128, loader with a valid profile while broken profiles exist | supported | no config error printed, `compiled successfully` |
| W5-17 | #128, loader with the broken profile selected (`depends: ["nope"]`, `esm.runtime: "x"`) | **refuted** | both errors printed 3 times (2 modules) and 5 times (4 modules) as `[ERROR] ❌ Error: …`, then `webpack 5.97.1 compiled successfully`, exit 0 |
| W5-18 | Loader with profile `badmod` selected (`esm` plus `tsConfig.module: CommonJS`, `moduleResolution: Node10`) | **refuted** | `Profile 'badmod' … sets 'esm', but its 'tsConfig.module' is 'CommonJS'.` printed twice, then `compiled successfully`, exit 0 |
| W5-19 | #126, `webpack-esm-check.test.ts` with the repo's jest | supported | 11/11 pass, twice. The 3 watch tests passed again at load average 4–8, with the other jurors' builds running. |

### Round 1 behaviours re-run for regressions

| # | Check | Result | Output (abridged) |
|---|-------|--------|-------------------|
| R-1a | A processor injects `require`, `"type": "module"`, `runtime: "node"` | supported | ESM91001, exit 1; `node dist/index.js` throws `ReferenceError: require is not defined in ES module scope` |
| R-1b | The same with `check: "warn"` | supported | `[WARN] … ESM91001 …`, exit 0 |
| R-1b' | The same with `check: "off"`, and without `esm` | supported | nothing reported, exit 0 |
| R-1d | `.cts` with `module: Preserve` gives ESM in `.cjs`; top-level `await` in `.cts` | supported | `dist/shim.cjs (1,1): ESM91030`; `dist/tla.cjs (1,1): ESM91033`, exit 1 |
| R-1d' | A result processor writes `.js` / `.cjs` through `ctx.getSystem().writeFile` | supported | `dist/gen.js ESM91032` and `dist/rp.cjs ESM91030`, both naming `rp-addon` |
| R-1e | Extensionless, re-export, directory and unresolved `import()` imports | supported | 91010 with hint `"./b.js"` (`a.js`, `reexp.js`); 91011 with `"./utils/index.js"`; 91012 for `./nofile.js` |
| R-1f | Named import a CommonJS package lacks; default import of an `__esModule` module | supported | `ESM91020: "missing" is not a named export of CommonJS module "cjspkg" …`; `ESM91021: default import of CommonJS module "esmod" …` |
| R-1f' | Code that must not be flagged | supported | nothing reported for any of: `createRequire(import.meta.url)`, `typeof module` and `typeof require` guards, `__exportStar` re-exports, `def.default()`, literal `import("./b.js")` |
| R-1f'' | 91003, 91004, 91005, 91013, 91031 | supported | `__dirname` gives 91003; `module.exports =` mixed with `export` gives 91004; no `"type"` gives a 91005 warning, exit 0; JSON import gives 91013; `"type": "commonjs"` gives 91031 |
| R-1h | `ignore: ["dist/skip.cjs"]` with `--debug` | supported | `ESM check skipped "dist/skip.cjs": matches esm.ignore pattern "dist/skip.cjs".` |
| R-1i | `esm` is not inherited through `depends` | supported | `server` (no `esm`) writes `require` into `dist-server/index.js`, which is not flagged; `client` output is flagged |
| R-1 attr | Attribution | supported | transformer `tx-addon` named on `dist/tx.js` 91003; processor `req-addon`; result processor `rp-addon`; no addon named for constructs from the project's own source |
| R-2a | Type error on the Program path | supported | `src/te.ts (1,14): Type 'string' is not assignable to type 'number'.`, exit 1 |
| R-2c | TypeScript diagnostics labelled as ESM check (NodeNext, Program path) | supported | `src/a.ts (1,19): Relative import paths need explicit file extensions … (ESM check, profile "client")`, plus ESM91010 |
| R-3a | Loader, `javascript/esm` rule, `require` in `b.ts` | supported | `ERROR in ./src/b.ts … ESM91001`, exit 1; also with `transpileOnly` |
| R-3b | Loader with `check: "warn"` | supported | `WARNING in ./src/b.ts`, exit 0 |
| R-3c | Loader, `runtime: "bundler"`, no rule type (`javascript/auto`) | supported | `compiled successfully`, exit 0 |
| R-3d | Loader `.mts` module | supported | builds; `node dist/main.js` prints `1 1 1 mts` |
| R-3e | Loader watch: add `require`, then remove it | supported | rebuild 2 reports 91001 on `./src/b.ts` only; rebuild 3 is clean |
| R-3e' | Loader watch, `runtime: "node"`: flip `package.json` `"type"` | supported | 4 modules get ESM91031 after the flip to `commonjs`; clean after the flip back |
| R-3g | Loader, dependent profile checked under its own `esm` | supported | `out-dep/d.js (1,18): ESM91003 … (source "src/d.ts", profile "wdep")`, exit 1, while the target profile has no `esm` |
| R-4 | CLI `--watch` | supported | reports on edit, stays alive, clean after the fix |

## Evidence (read only)

| Check | Result | Note |
|-------|--------|------|
| `Release-Notes.md` `[Unreleased]` | read | "The CLI now prints each configuration error once". Scoping is claimed for the CLI and the loader; printing once is claimed only for the CLI. The list of errors that fail loader builds does not include configuration errors. |
| `packages/compiler/README.md` § ESM check | read | Its last sentence still says "The webpack loader is not checked yet". `packages/webpack/README.md` and the release notes say the loader runs the check. This is out of date. |
| `packages/webpack/src/TsCompiler.ts`, `loader.ts` | read | Config errors go to the reporter (console) during option resolution, not through `this.emitError`. This matches W5-17 and W5-18. |
| `ResolvedCompilerOptions.ts` `resolvePathsWithRules` | read | With no `--configFile`, no config file is resolved. The README says it defaults to `./websmith.config.json`. This rule predates the plan. |

## Findings

- **All four wave-5 fixes hold in the CLI.** I ran each one and saw it work:
  - #127: diagnostics name the source file in the CLI, in watch mode and in the loader.
  - #129: fast-path and per-file declaration syntax errors print and exit 1, and the loader reports them too.
  - #128: the CLI validates only the selected profile and its dependencies, and prints each error once.
  - #126: the watch e2e tests passed 3 of 3 times under load.
- **No regressions** in the round-1 behaviours: every row that passed in round 1 still passes.
- **Loader config errors are printed repeatedly and do not fail the build** (W5-17, W5-18). With a broken profile
  selected in the loader, each configuration error goes to the console once per loader call: twice to five times in
  my runs. webpack then reports `compiled successfully` and exits 0.
  - Two plan texts are contradicted. One is the profile whose `esm` contradicts `tsConfig.module`: it "is a
    configuration error reported once at config resolution". The other is § Failure semantics, which says an
    error-level diagnostic fails the build; the loader is to report through `this.emitError`, and "This applies to
    every error-level diagnostic … because an 'error' that cannot fail a build is only coloured text".
  - The ESM check is also skipped for that profile, so a `badmod` build passes silently apart from the console text.
  - The plan's Changelog lists only syntax errors, declaration-emit errors and ESM findings as failing loader builds.
    That list does not explicitly exclude configuration errors. The Release Notes promise "printed once" only for
    the CLI.
  - Round 1 did not test this in the loader, so it is not a regression. It is a gap in what the plan promises.
- **Observed, not counted against the plan:**
  - In the loader, a dependent profile's own processor addon did not change that profile's output: `out-dep/c.js`
    had no injected `require`. The target profile got the change through `depends`. The CLI applies it, and flags
    `out-dep/c.js` for profile `wdep`. This looks like how the loader already applied addons before this plan, and
    I did not verify that.
  - `--profile baddep` also prints the unrelated warning `Custom profile configuration "baddep" found, but no profile
    provided`.
  - The CLI ignores `./websmith.config.json` unless `-c` is passed. This predates the plan.

Position: refuted
Evidence: executed

The refutation rests on W5-17 and W5-18, which I executed. In the webpack loader, a configuration error for the
selected profile, including the `esm` versus `module` contradiction, prints more than once and leaves the build
green. Every CLI behaviour and every round-1 behaviour I ran is supported.

## Executed vs read

- **Executed:** every row of the two executed tables, fresh in this session against `3de39b1`. That includes 2 full
  runs and 1 watch-only run of `packages/webpack-test/tests/webpack-esm-check.test.ts`.
- **Not executed:**
  - the full `pnpm lint`, `pnpm test`, `pnpm build` and `pnpm test:e2e` suites;
  - the compiler-test e2e;
  - the `perf:esm` benchmark.
- **Read:**
  - the plan;
  - the round-1 panel files;
  - `Release-Notes.md` `[Unreleased]`;
  - the ESM sections of both READMEs;
  - `command.ts`, `resolve-profile.ts`, `ResolvedCompilerOptions.ts` (config loading);
  - `TsCompiler.ts` and `loader.ts` (diagnostic routing).
