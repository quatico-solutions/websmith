<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->


# Delivery panel — Behaviour lens — 2026-10-02-esm-check-precision

Position: supported
Evidence: executed

## Setup (executed)

- Detached worktree of `origin/develop` @ 584666a2 (contains merges 55c9be70 #145, c59594fc #160, e93d2b95 #167,
  c9d69d8d #173), Node 22.17.0, `NX_DAEMON=false`, `pnpm install --frozen-lockfile --offline`, `pnpm build` (9/9 ok).
- CLI: `node <wt>/packages/compiler/bin/bin.js --profile client --project tsconfig.json --configFile websmith.config.json`
  (plus `--addonsDir addons` for item 9) in hand-written fixtures under the scratchpad. Emitted output run under
  Node 24.21.0 to confirm the runtime outcome of each reported / not-reported construct.
- Loader: own driver script (`webpack` + `websmith-loader` resolved from `packages/webpack-test`, same rule shape as
  `webpack-esm-check.test.ts`: `transpileOnly`, profile `target`, `node` profiles as `depends: ["node"]`).
- Fixtures are my own, not copies of the e2e sources; several are adjacent inputs the tests do not use (marked *adj*).

## Per deliverable

| # | Behaviour | Run | Printed | Verdict |
|---|-----------|-----|---------|---------|
| 1 | UMD guard: `typeof module === "object" && module.exports` → `factory(require, exports)` | CLI node, `umd.ts` | nothing on umd.js; Node 24 loads it (`{"umd":1}`) | Done |
| 1 *adj* | `typeof exports === "object" ? __dirname + require(...) : …` | CLI node, `umd2.ts` | nothing; Node 24 → `"esm"` | Done |
| 1 neg | unrelated `typeof module` test, unguarded `require` | CLI node, `umd3.ts` | `umd3.js (3,18): ESM91001` | Done (still reported) |
| 1 loader | own UMD wrapper, `javascript/esm` under bundler and node; `javascript/auto` under node | wp driver | `exit=0 errors=[] warnings=[]` ×2; auto: only webpack's own "Critical dependency" warning | Done |
| 2 | shadowed default (`const esmpkg` in inner function) | CLI node, `shadow.ts` | nothing; Node 24 `{"value":[2,1]}` | Done |
| 2 *adj* | shadowing by arrow parameter and `catch (esmpkg)` | CLI node `shadow2.ts`; loader bundler+node `javascript/esm` | nothing; loader `exit=0 errors=[]` both | Done |
| 2 neg | unshadowed `esmpkg()` | CLI + loader node | `shadow3.js (2,8): ESM91021`; loader `errors=["ESM91021"]` | Done (still reported) |
| 3 | `./b.js?v=1`, `./my%20file.js`, *adj* `./b.js#frag` under node | CLI node, `query.ts` | nothing; Node 24 loads `{"q":[1,2,1]}` | Done |
| 3 | `./d.json?v=1` under node | CLI node; loader node | `jsonq.js (2,15): ESM91013`; loader `errors=["ESM91013"]`; Node 24 `ERR_IMPORT_ATTRIBUTE_MISSING` | Done |
| 3 | `./b%2Fx.js` under node stays unresolved | CLI node | `ESM91012 … "./b%2Fx.js" resolves to no file` | Done |
| 3 | 91010 hint before query | CLI node `./b?v=1` | `add the extension: "./b.js?v=1"` | Done |
| 3 | bundler: `./b.js?v=1`, `./b.js#x`, file `a#b.js` as `./a#b.js` pass; `./my%20file.js` → 91012 | CLI bundler | only `q.js (5,19): ESM91012 "./my%20file.js"` | Done |
| 4 | 91013 bare JSON `jpkg/d.json`, *adj* `exports`-mapped `xjpkg/data` | CLI node; loader node | two 91013 on jsonbare.js; loader `errors=["ESM91013"]` for `xjpkg/data`; Node 24 `ERR_IMPORT_ATTRIBUTE_MISSING` | Done |
| 5 | `import("./b")`, `import("./lib")` in `.cts`→`.cjs` | CLI node (nodenext) | `dyn.cjs (4,29): ESM91010`, `dyn.cjs (5,32): ESM91011`; Node 24 `ERR_MODULE_NOT_FOUND` | Done |
| 5 *adj* | `import("../b")` in a `.js` under `"type": "commonjs"` dir | CLI node | `out/cj/c.js (4,26): ESM91010` | Done |
| 5 loader | `.cts` with `import("./b")` | wp driver node | `ESM91010` | Done |
| 6 | bundler dirs: `./dir` (other.js only) 91012 w/ heuristic message; `./d2` module-only, `./d3` index.mjs, `./d4` extensionless main pass; *adj* `./d5` (pkg.json without fields), `./d6` (`"main": ""`) 91012; `./nothing` plain 91012 | CLI bundler | exactly dir, d5, d6 (heuristic text naming `resolve.mainFiles`/`mainFields`, `esm.ignore`, `check: "warn"`) and nothing (plain text) | Done |
| 7 | transformer adding only `addSyntheticLeadingComment` not named | CLI node + addon | `out/test.js (2,18): ESM91001 … (source "src/test.ts", profile "client")`, output has `/* banner */` | Done (README L302 wording present) |
| 8 | fallback = addons that changed the file, or none | same run; rewrite variant | unattributed finding names no addon; result-processor rewrite names `addons: nested-compiler` | Done |
| 9 | nested compile through wrapped `ctx.getSystem()` | CLI node + result-processor addon | `out/nested/inner.js (1,18): ESM91001 … (source "nested/inner.ts", profile "nested")` — once, outer addon not named | Done |
| 9 *adj* | file rewritten by outer processor after nested check | variant | nested finding (1,18) + outer finding (2,18) `addons: nested-compiler` | Done |
| 9 *adj* | `ctx.getSystem()` passed directly | variant, cwd without tsconfig.json | once, nested profile | Done |
| 10 | 91022 `epkg/internal.js`, `"."` with `require`-only `rpkg` | CLI node | two 91022, listing exported subpaths; Node 24 `ERR_PACKAGE_PATH_NOT_EXPORTED` | Done |
| 10 | 91022 silent under `customConditions` (`development`-only export) | CLI node, two fixtures | without: `a.js (2,19): ESM91022`; with: nothing | Done |
| 10 | 91023 `npkg/sub` (hint `npkg/sub.js`), `npkg/dir` (hint `npkg/dir/index.js`), *adj* `npkg/both` (dir + both.js) → dir hint | CLI node | three 91023 with those hints; Node 24 `ERR_MODULE_NOT_FOUND` / `ERR_UNSUPPORTED_DIR_IMPORT` ×2 | Done |
| 10 | 91024 `@app/l` paths alias | CLI node | `subpaths.js (7,19): ESM91024 … "@app/*"`; Node 24 `ERR_MODULE_NOT_FOUND` | Done |
| 10 | passes: exported `epkg/feature`, self-reference `missfx/b`, `#x`, symlinked workspace `wpkg`, `npkg/sub.js` | CLI node `ok.ts` | nothing; Node 24 loads `ok.js` | Done |

## Adjacent findings (do not refute a plan promise, recorded for the moderator)

- **Nested compile with `ctx.getSystem()` passed directly crashes when the cwd has a `tsconfig.json`:**
  `Error in result processor "nested-compiler": Error: Cannot read file 'tsconfig.json': host.readFile is not a
  function.` `observeWrites` builds the observed system with `Object.create(system, { writeFile })`
  (`CompilationContext.ts:116`, predates the plan, 661e175c), and `parsed-command-line.ts:31` /
  `ResolvedCompilerOptions.ts:375` spread `{ ...system }`, which drops the inherited `readFile`. The ESM dedup itself
  holds (run from a cwd without `tsconfig.json`: reported once). But README L308-309, added by #167, says the nested
  compile "through `ctx.getSystem()`, directly or through a copy of it, is checked once" — in the common setup the
  direct form does not compile at all. The unit test (`Compiler.spec.ts:4450`) uses a virtual system and does not hit it.
- **Loader, cold build, `import("./dir")`:** the first build reports 91010 with hint `"./lib2.js"` instead of 91011
  (the directory's output is not yet on disk); a warm build gives 91011 `"./lib2/index.js"`. Same for an ES module
  `.ts` importer, so it is a pre-existing loader ordering limitation, not specific to item 5. The build fails either way.
- README (L311) says the nested dedup "also holds" with two copies of websmith-core; the plan said that case falls
  back to a double check. Not run (needs two installs); a docs/plan divergence for the deliverable lens.
- 91022 message lists `module-sync` among the conditions (plan text: `node, import, default`); correct for Node 24.

## Executed vs read

- **Executed:** worktree build; every row above through the real CLI binary (25 runs over 8 fixtures) or the
  webpack loader driver (10 runs); Node 24.21.0 on the emitted files for items 1–5 and 10.
- **Read only:** the plan; `bin.test.ts` / `webpack-esm-check.test.ts` helpers (for setup shape);
  `CompilationContext.observeWrites`, `Compiler.ts:768-795`, the two system spreads; README L302-312;
  `git diff --stat` of the four merges and their ancestry in `origin/develop`. I did not review the PR diffs line by line.
