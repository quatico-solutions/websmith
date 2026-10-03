<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — cli-error-exit-gaps (wave 6, moved ahead: fast path for .d.ts and JavaScript)

- **Plan (canonical):** `docs/plans/2026-10-02-cli-error-exit-gaps.md` on `develop`
- **Approved:** 2026-10-02, Jan Wloka, plan-PR #136 merged
- **Branch:** `bug/fast-path-dts-js-syntax-errors` (base: `develop`)
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh` (on `PATH`); the implementer never merges it
- **Review of the code:** independent review, plus uncached gates run by the maintainer's session before merge

Waves 1 to 3 have merged: `bug/cli-project-directory` (#147), `bug/cli-config-parse-and-addons-dir` (#163) and
`bug/emit-skipped-rule` (#170). Waves 4 and 5 (`bug/report-config-option-errors`, `bug/report-file-less-diagnostics`)
wait on #134's errors-once slice (`bug/loader-option-errors-once`), which has not merged. The plan's Order paragraph
lets this slice "move ahead" in that case, because its diagnostics all carry a file and need no change to `report()`.
Nothing blocks it. Nothing waits on it either, but waves 4, 5 and 7 all edit `Compiler.ts` after you, so keep the
diff small.

### What to build

This is item 7 of the plan. All line numbers below were checked on `develop` at `44c47fc7`. The plan's `Compiler.ts`
numbers predate #161 to #173, so use these.

**On the fast path, `.d.ts` and JavaScript sources are never parsed.** The fast path is taken when no addon needs type
information and there is no `declaration`, or always with `transpileOnly` (`transpileInternal`, `Compiler.ts:1191`).
There:
- a `.d.ts` source returns `undefined` (`:1194-1195`; the plan cites `:1184-1185`);
- every other non-TypeScript source, `.js`/`.jsx`/`.mjs`/`.cjs` as well as `.json`, goes to `transpileJson`
  (`:1196-1199`, method at `:1513-1534`; the plan cites `:1188-1189`, `:1489`), which copies the content verbatim
  under `outDir` and parses nothing.

So a syntax error in either kind of file is never reported. The plan ran it on develop: a syntax error in
`src/c.d.ts`, and in `src/b.js` with `allowJs`, exits 0, while `tsc` exits 2. The Program and language-service paths
are not affected: `.d.ts` and JavaScript fall through to the default language-service branch (`:1263-1276`), whose
`getSyntacticDiagnostics` already reports them.

**`tsc` 5.7.3 (the workspace version, `node_modules/.bin/tsc`), run for this brief** on fixtures with `outDir: "out"`,
`types: []`, `include: ["src"]`, and a clean `src/a.ts`:

| Fixture | `tsc` diagnostics | Exit | `tsc` output |
|---------|-------------------|------|--------------|
| `src/c.d.ts`: `export declare const c: ;` | `src/c.d.ts(1,25): error TS1110: Type expected.` | 2 | `out/a.js` |
| same, `skipLibCheck: true` | same TS1110 | 2 | `out/a.js` |
| same, `noEmitOnError: true` | same TS1110 | **1** | nothing |
| `src/m.d.mts`: `export declare const m: ;` (`module: nodenext`) | `src/m.d.mts(1,25): error TS1110: Type expected.` | 2 | `out/a.js` |
| `allowJs`, `src/b.js`: `export const b = ;` | `src/b.js(1,18): error TS1109: Expression expected.` | 2 | `out/a.js`, `out/b.js` |
| `allowJs`, `module: nodenext`, `jsx: react-jsx`: `src/b.mjs` as above | `src/b.mjs(1,18): error TS1109: Expression expected.` | 2 | `out/b.mjs` and the rest |
| … `src/c.cjs`: `const 1 = 2;` | `src/c.cjs(1,7): error TS1134: Variable declaration expected.` | 2 | `out/c.cjs` |
| … `src/d.jsx`: `export const d = <div>;` | `src/d.jsx(1,19): error TS17008: JSX element 'div' has no corresponding closing tag.` and `src/d.jsx(2,1): error TS1005: '</' expected.` | 2 | `out/d.js` |
| `allowJs`, `src/ann.js`: `export const x: number = 1;` | `src/ann.js(1,17): error TS8010: Type annotations can only be used in TypeScript files.` | 2 | — |
| `allowJs`, `noEmitOnError: true`, `src/b.js` as above | same TS1109 | **1** | nothing |
| no `allowJs`, `src/b.js` as above | none | 0 | `out/a.js` |

TS8010 belongs here: `tsc` reports it as a syntactic diagnostic of a JavaScript file, and so does the mechanism below.
`tsc` emits despite syntax errors (exit 2) and writes nothing under `noEmitOnError` (exit 1).

**Expected websmith behaviour after this slice, on the fast path and with `transpileOnly`:**
- Each row above reports the same code, message and position, once. The CLI prints them as
  `<abs path> (1,25): Type expected.`, the format `bin.test.ts:446` asserts.
- The exit code is 1 wherever `tsc` exits 2 or 1 (plan, Open Point "Exit code").
- Output is unchanged:
  - A `.d.ts` source writes nothing.
  - A JavaScript source is still copied verbatim by `transpileJson`, not replaced by `transpileModule`'s output.
  - `.json` is untouched.
- Under `noEmitOnError`, the #170 rule applies per file: a JavaScript file with a syntax error is not written. Other
  files without an error still are, unlike `tsc`, which writes nothing. That per-file difference already holds for
  `.ts` on the fast path since #170, so do not change it.
- Without `allowJs`, JavaScript sources are not checked, as with `tsc`.

**Two facts the plan did not have — measured here with TypeScript 5.7.3:**

1. **`ts.transpileModule` cannot take a declaration file.** For `.d.ts`, `.d.mts`, `.d.cts` and `.d.css.ts`, valid or
   not, it throws `Error: Debug Failure. Output generation failed`. Its emit produces no output for a declaration
   file, and `transpileWorker` asserts that it does. The plan's Open Point "Slice 6 mechanism" names the fallback for
   exactly this case: "a single-file Program with `getSyntacticDiagnostics()`, as `transpileNodeModule` does". That
   fallback now applies to declaration files.
   - On the same inputs, such a Program (`noLib`, `noResolve`, `noCheck`, `allowNonTsExtensions`, a host that serves
     only that file, as in `transpileNodeModule`, `:1447-1503`) returns TS1110 at start 24 for `c.d.ts`, and nothing
     for a valid `.d.ts`.
   - For JavaScript, `ts.transpileModule(content, { fileName, compilerOptions, reportDiagnostics: true })` returns
     exactly the diagnostics in the table, with a file and start (b.js TS1109 at 17, c.cjs TS1134 at 6, d.jsx TS17008
     at 18 and TS1005 at 24, ann.js TS8010 at 16). It also returns nothing for valid JavaScript, a script file and
     JSX in a `.js` file.
   - With `module: commonjs` plus `moduleResolution: bundler`, the JavaScript call also returns TS5095 without a file.
     That error is why the plan keeps only diagnostics with a file.
2. **A `.d.mts` or `.d.cts` source crashes the fast path today.** The `.endsWith(".d.ts")` test at `:1194` misses them.
   The `isSourceFile` regex at `:1197` (`[cm]?ts`) matches them, so they go to `transpileSourceCode`, and with any
   `module` other than `node16`/`nodenext` they reach `ts.transpileModule` (`:1417`), which throws.
   `emitSourceFile`'s catch (`:548-565`) then reports `Error during transpilation of ".../m.d.mts": Error: Debug
   Failure. Output generation failed` and a `Transpilation failed` diagnostic. That was run with a pre-wave-1 build of
   the CLI, on a valid `export declare const m: number;`. Since wave 1, `command.ts:170-171` makes that an exit 1 for
   a valid file.
   - Classify declaration files with `ts.isDeclarationFileName(fileName)`, which is public in 5.7.3 and true for
     `.d.ts`, `.d.mts`, `.d.cts` and `.d.<ext>.ts`. That puts them all on the same syntax check. It is the same
     branch line, it is what `tsc` treats as a declaration file, and the plan's item is "`.d.ts` sources". State the
     `.d.mts` crash fix in the PR and in `Release-Notes.md`.

The plan is canonical; this brief is orientation.

### Settled decisions — do not re-derive them

**JavaScript: `ts.transpileModule` with `reportDiagnostics: true`; declaration files: a single-file Program with
`getSyntacticDiagnostics()`.**
- The plan's Open Point "Slice 6 mechanism" picks `transpileModule`, because the fast path already runs it for every
  `.ts` file (`:1417`). Each extra file costs one more call of the same kind.
- `ts.createSourceFile` was rejected: it exposes no public syntactic diagnostics (`parseDiagnostics` is internal;
  `panel.md` "Where they differ" 5, `compiler-pipeline.md` finding 10).
- For declaration files, `transpileModule` throws (above), so the plan's named fallback applies. Do not wrap
  `transpileModule` in a try/catch and treat the throw as "no errors": that hides every `.d.ts` syntax error.
- You may give the single-file Program its own small private helper. Do not refactor `transpileNodeModule` to share
  it: wave 7 and the TypeScript 6 slices edit that area.

**Keep only diagnostics with a file; discard the output text.**
- The option errors (TS5095 and the like) already reach the reporter through every `.ts` fragment and are deduplicated
  by `getDiagnosticKey` in `report()` (`:664-687`). Waves 4 and 5 own option and file-less errors. Do not add, move or
  deduplicate any other diagnostics here.
- Also filter `TS_ERROR_CODE_INVALID_OPTION_VALUE`, as `transpileSourceCode` does (`:1425`). The filter on `file`
  already drops those, since they have no file.

**Call `transpileModule` without transformers.** Its output is thrown away. Passing `ctx.getTransformers()` would run
addon transformers on files whose output they never touch. The `.ts` call at `:1417` passes them; this one must not.

**Check the fragment's `content`**, the text after processors, not a fresh `readFile`. The `.ts` fast path does the
same, so positions match what is compiled.

**Scope of the check:**
- Declaration files (`ts.isDeclarationFileName`) always.
- `.js`/`.jsx`/`.mjs`/`.cjs` only when `ctx.getCompilerOptions().allowJs` is set.
- Never `.json`: `transpileJson` also serves JSON, and the panel ruled it out (`compiler-pipeline.md` finding 10).
- Branch on the extension in `transpileInternal`'s fast-path block (`:1193-1202`). Leave the non-fast paths alone;
  they already report these errors.

**Output follows the #170 `emitSkipped` rule.** A fragment's `emitSkipped` is true only when it has no output files,
or when `noEmitOnError` is set and it carries an `Error`-category diagnostic.
- **Declaration files** return a fragment `{ outputFiles: [], diagnostics, emitSkipped: true }` instead of `undefined`.
  `processOutput`'s skipped branch (`:1081-1082`) still passes `output.diagnostics` on, so `report()` and, in watch
  mode, `emitWatchedFile` (`:838-851`) both see them without a change.
- **JavaScript** keeps `transpileJson`'s output files. It adds the syntax diagnostics to the fragment and sets
  `emitSkipped` by the rule, reading `noEmitOnError` from `ctx.getCompilerOptions()`. `transpileJson`'s own JSON
  behaviour, including its "JSON files are only emitted if an outDir is provided." diagnostic for an empty `outDir`,
  does not change.
- Leave `processOutput`, `report()`, `emitResult` (`:726-746`) and `transpileSourceCode` alone.

**Do not assert the JavaScript output path.** With `src/b.js` and `allowJs`, `tsc` writes `out/b.js` and websmith
writes `out/src/b.js` (plan Notes, "`allowJs` output layout"; seen again for this brief). That is a separate follow-up.
To check that a JavaScript file was or was not written, search `outDir` recursively for its base name.

**TS 7 inventory: add a line.** This slice adds a `transpileModule` use for JavaScript and a per-file Program for
declaration files. The plan's Notes require a line for each such use in
`docs/stories/ts7-rearchitecture/analysis-ts7-api-gap.md`, section 1.2, rows "Program / type checking" and
"Emit / transpile".

### Done when

**Unit tests in `packages/core/src/compiler/Compiler.spec.ts`**, next to the fast-path specs at `:1336-1360` and the
`.d.ts` specs at `:1734-1786`. Use AAA with `testObj` / `actual`, never a shared `testObj`, and a virtual
`createSystem`. Call `.createProfileContextsIfNecessary().emitSourceFile("/src/<file>", undefined, false)` and assert
on `actual.diagnostics` and `actual.files`. Each assertion below catches a specific naive fix:

- **Declaration file with a syntax error**, `export declare const c: ;` as `/src/c.d.ts`, fast path and with
  `transpileOnly: true`:
  - `actual.diagnostics` equals `[objectContaining({ code: 1110, category: Error, start: 24, file:
    objectContaining({ fileName: "/src/c.d.ts" }) })]`.
  - `actual.files` is `[]`.
  - Add `it.each` rows for `/src/m.d.mts` and `/src/m.d.cts` with `module: ESNext`, same code and start. This catches a
    fix that leaves `.endsWith(".d.ts")` in place.
- **Valid declaration file**, `declare const g: number;`:
  - `actual.diagnostics` is `[]`.
  - The reporter has no message.

  This catches `transpileModule` on `.d.ts`. Its throw lands in `emitSourceFile`'s catch as a code-0 "Transpilation
  failed" diagnostic, which the existing specs at `:1734-1786` (`actual.files` only) would not notice. Extend those
  two specs with `expect(actual.diagnostics).toEqual([])`, or add new ones; their `Record<exportName, ...>` is a
  semantic error, not a syntactic one, so it must stay silent. Add a valid `.d.mts` row under `module: ESNext` as
  well: today it fails with "Transpilation failed".
- **JavaScript with a syntax error under `allowJs`**, `outDir: "/build"`. `it.each` over these rows:

  | File | Source | Code | Start |
  |------|--------|------|-------|
  | `/src/b.js` | `export const b = ;` | 1109 | 17 |
  | `/src/b.mjs` | `export const b = ;` | 1109 | 17 |
  | `/src/c.cjs` | `const 1 = 2;` | 1134 | 6 |
  | `/src/ann.js` | `export const x: number = 1;` | 8010 | 16 |

  Run them under both `module: ESNext` and `module: NodeNext`. `NodeNext` takes `transpileNodeModule` for `.ts`, so it
  pins that the JavaScript check does not depend on the module kind.
  - `actual.diagnostics` holds exactly that one diagnostic, with the file.
  - `actual.files` holds one file whose text equals the source **verbatim**. This catches replacing the copy with
    `transpileModule`'s output, which turns `const` into `var` and rewrites `.cjs`/JSX.
  - Add `/src/d.jsx`, `export const d = <div>;`, with `jsx: ReactJSX`: codes 17008 and 1005.
- **JavaScript with an option error.** Use `module: CommonJS` with `moduleResolution: Bundler`, `allowJs` and the
  `b.js` syntax error. `actual.diagnostics` holds 1109 only, **not** 5095. This catches keeping file-less
  diagnostics.
- **JavaScript without `allowJs`**, same `b.js`: `actual.diagnostics` is `[]` and the copy is written as today. This
  pins the gate.
- **`noEmitOnError: true` with the `b.js` syntax error:** `actual.files` is `[]` and the diagnostic is still there.
  With a valid `b.js`, the copy is written. This pins the #170 rule on the new fragment.
- **`.json` unchanged:** the existing JSON spec just above `:1734` (`/src/config.json`) stays green with `allowJs: true`
  added. Its `actual.diagnostics` stays `[]`.
- **One `compile()` level spec** in the style of "reports syntax error once w/ fast path" (`:1099-1113`). Use
  `/src/a.ts` (valid) plus `/src/c.d.ts` (TS1110) and `/src/b.js` (TS1109) with `allowJs`. The reporter prints each
  error exactly once, as `Error: /src/c.d.ts (1,25): Type expected.\n` and `Error: /src/b.js (1,18): Expression
  expected.\n`.
- Every existing spec stays green. If one turns red, report it rather than weakening it.

**e2e in `packages/compiler/src/bin.test.ts`**, next to "should exit with status 1 and report the syntax error w/
syntax error on fast path" (`:436-446`). Use `createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target:
"esnext", types: [] })` and `createSourceFile`.
- **`.d.ts`.** Add `test.ts` (valid) and `c.d.ts` = `export declare const c: ;`.
  - Status 1.
  - The output contains `${path.join(testDirs.SOURCE_DIR, "c.d.ts")} (1,25): Type expected.` exactly once. This fails
    today.
  - `getOutput("test.js")` is defined.
- **`.d.ts` with `skipLibCheck: true`.** Same result. `tsc` reports it too, and the plan's item says "also with
  `skipLibCheck`".
- **Valid `.d.mts` with `module: "esnext"`.** Status 0 and no "Transpilation failed" in the output. This fails today
  with exit 1.
- **JavaScript with `allowJs: true`.** Add `test.ts` (valid) and `b.js` = `export const b = ;`.
  - Status 1.
  - `(1,18): Expression expected.` for `b.js` exactly once. This fails today.
  - `b.js` is found somewhere under `OUTPUT_DIR` (a recursive search, not a fixed path).
  - Add the same case with `c.cjs` = `const 1 = 2;`: `(1,7): Variable declaration expected.` once.
- **JavaScript with `allowJs` and `noEmitOnError: true`.** Status 1, and `b.js` is found nowhere under `OUTPUT_DIR`.
- **JavaScript without `allowJs`.** Status 0, as with `tsc`.
- Do not assert any JavaScript output path (see Settled decisions).

**Measured cost in the PR.** The plan requires "build time of a many-`.d.ts` fixture measured before and after".
- Build `develop` and the branch.
- Run `node packages/compiler/bin/bin.js -p <fixture>/tsconfig.json` five times each and state the medians, on:
  - a fixture with one `.ts` and 1000 generated `.d.ts` files (`export declare const x<i>: number; export interface
    I<i> { a: string }`);
  - the same fixture with 1000 `.js` files and `allowJs`.
- If the `.d.ts` cost is more than a few hundred milliseconds per thousand files, say so plainly. Do not optimise
  outside scope.

**Loader.** Run `packages/webpack-test` and state in the PR whether the loader's output changed. Expect no change:
its fixtures have no `.d.ts` or JavaScript module going through the websmith loader. A module the loader does get
with a `.js` extension under `allowJs` would now be syntax-checked too. Do not edit `packages/webpack/src`.

**Gates**, all green locally: `pnpm lint`, `pnpm build`, `pnpm test --skip-nx-cache`,
`pnpm test:e2e --skip-nx-cache`. Run `pnpm build` before the e2e, because `bin.test.ts` runs `bin/bin.js`.

**`Release-Notes.md`.** Add one entry under `## [Unreleased]` / `### Changed`, after the `emitSkipped` entry (the one
ending "… with `transpileOnly`."). Do not repeat the lead sentence; wave 1 added it. Follow the plan's Changelog:
- Syntax errors in `.d.ts` files and, with `allowJs`, in JavaScript sources (`.js`, `.jsx`, `.mjs`, `.cjs`) are
  reported and fail the build when no addon needs type information or with `transpileOnly`. Before, such a build
  exited 0.
  - Output does not change. JavaScript sources are still copied; under `noEmitOnError`, one with a syntax error is
    not written.
  - A valid `.d.mts` or `.d.cts` source no longer fails such a build with "Transpilation failed".

**README.** None. The exit-code line in `packages/compiler/README.md` belongs to wave 4.

### Bookkeeping

- Push the first real commit as soon as it exists.
- Open the PR with `plot-open-pr.sh` (on `PATH`). Do not use `gh pr create`.
- Once the PR exists, append `→ #<number>` to the `bug/fast-path-dts-js-syntax-errors` line in the plan's
  `## Slices` (under "### Fast path for .d.ts and JavaScript"), and commit that on this branch.
- Commits use Arlo's notation without a colon, for example
  `B Reports syntax errors in declaration files and allowJs sources on the fast path`. See the `commit-notation`
  skill.

### Repo facts

- Use pnpm 10 from `$HOME/.nvm/versions/node/v22.17.0/bin` (put it first on `PATH`). The Homebrew pnpm 11 fails with
  E401.
- Install with `--offline`. The Artifactory login in `~/.npmrc` has expired; never edit `~/.npmrc`. If you need a
  registry package, use an empty `NPM_CONFIG_USERCONFIG` file plus `--config.registry=https://registry.npmjs.org/`.
- For Node 24 runtime checks, use `$HOME/.nvm/versions/node/v24.21.0/bin/node`.
- Use `trash`, never `rm`.

### Scope guard

This branch owns:
- `packages/core/src/compiler/Compiler.ts`: the fast-path block of `transpileInternal` (`:1193-1202`), plus at most
  two new private helpers (the syntax check, and the JavaScript fragment's `emitSkipped`). Nothing else in the file.
- `packages/core/src/compiler/Compiler.spec.ts`
- `packages/compiler/src/bin.test.ts`
- `Release-Notes.md`
- `docs/stories/ts7-rearchitecture/analysis-ts7-api-gap.md`: the inventory lines
- the `→ #<PR>` on this slice's line in the plan

Do not touch:
- `processOutput`, `report()`, `emitResult`, `emitWatchedFile`, `transpileSourceCode`, `transpileNodeModule`, or
  `transpileJson`'s JSON handling in `Compiler.ts`
- `ResolvedCompilerOptions.ts` and `parsed-command-line.ts`, which wave 4 owns
- anything under `packages/webpack/src`

Branches in flight or starting at the same time, checked against their plans and briefs on `develop`:
- `feature/neutral-module-compiler` (`docs/plans/2026-10-01-vite-plugin.md`) adds
  `packages/core/src/compiler/ModuleCompiler.ts`, its spec and the `index.ts` exports. It shrinks
  `packages/webpack/src/TsCompiler.ts` and touches `compiler-instances.ts`, `webpack-hooks.ts` and `loader.ts`. Its
  brief forbids `Compiler.ts`, `Release-Notes.md` and READMEs.
  - No shared file.
  - Behavioural only: `ModuleCompiler` calls `emitSourceFile`, so the loader and the future Vite plugin inherit this
    check. That is intended.
- `infra/fix-transitive-alerts` (`docs/plans/2026-10-01-dependency-updates.md`) refreshes `pnpm-lock.yaml` and adds
  `pnpm.overrides` in `package.json`. TypeScript is pinned to `5.7.3` in every `package.json`, so the probes above
  still hold.
  - No shared file. If it merges first, rebase and run `pnpm install --offline` again.
- PR #171 `infra/typescript-6-ci-leg` changes `.github/workflows/pull-request.yml`, `docs/rules/workflow.md` and its
  plan, adding an advisory TypeScript 6.0.3 cell (`continue-on-error`).
  - No shared file.
  - If your new specs fail only in that cell, name it in the PR. `transpileModule`'s declaration-file behaviour and
    the JavaScript syntactic diagnostics may differ on 6.x.
- `bug/loader-tsconfig-enum-options` (`docs/plans/2026-10-02-loader-options-once.md`) moves `convertEnumOptions` into
  core and edits `options.ts`, `ResolvedCompilerOptions.ts`, `convert-enum-options.spec.ts`,
  `ResolvedCompilerOptions.spec.ts` and `options.spec.ts`. It adds a **Breaking** line to `Release-Notes.md` and
  updates the README.
  - It does not touch `Compiler.ts`, `Compiler.spec.ts` or `bin.test.ts`.

Real collisions:
- `Release-Notes.md` with `bug/loader-tsconfig-enum-options`: an append conflict under `## [Unreleased]`. Keep both
  entries.
- `Compiler.ts`, `Compiler.spec.ts` and `bin.test.ts`: none of the branches above edits them. The queued waves of
  this plan do: wave 4 (`report()`, `compile()`/`watch()` start), wave 5 (`report()` at `:666-670`, the per-file
  declaration Program) and wave 7 (`registerWatch`, `watch()`). So do the queued TypeScript 6 slices. Keep your diff
  to the fast-path block and the new helpers so those rebases stay trivial.

If you find something the plan did not anticipate, report it rather than improvising outside scope.
