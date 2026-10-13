<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — typescript-6-support (slice: own-compilations)

- **Plan (canonical):** `docs/plans/2026-10-02-typescript-6-support.md` on `develop` (slice line `:322`)
- **Approved:** 2026-10-02, Jan Wloka, plan-PR #144 merged
- **Scope widened:** 2026-10-13, Jan Wloka — this slice also owns every TypeScript 6.0.3 failure that no other slice
  owns (the list below)
- **Branch:** `bug/typescript-6-own-compilations` (base: `develop`, at `fa114cbe` when this brief was written)
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh` (on PATH); the implementer never merges it
- **Review of the code:** an independent review plus uncached gates, run by the maintainer's session before merge

**Ordering.** This is the plan's "Own compilations" slice: ownership-table rows "ESM check's `target` fallback",
"`strict: false` default" and "`Classic` / `Node10` in websmith's own compilations" (measured-table rows 6, 7, 9 and
14). Its `waits: bug/option-enum-tables` is satisfied: #168 merged, and #135 (`tsc-option-parity`) is delivered, so
`getEffectiveTarget` (`packages/core/src/compiler/config/effective-options.ts:13`) and core's `SCRIPT_TARGET_NAMES`
exist. `bug/node-tsc-ignore-config` (#184, open) runs beside you; see the Scope guard. Nothing waits on this branch,
but the plan's later slices (`feature/typescript-6-module-kinds`, `feature/cli-typescript-peer`,
`feature/typescript-6-peer-range`) start from a 6.0.3 cell that this slice and #184 make green.

**What changed on `develop` since the plan.**
- **#161** removed websmith's `target`/`esModuleInterop` defaults; `defaults.ts:9` says so. Only `strict: false`
  (`packages/core/src/compiler/defaults.ts:21`) is left of the old pins.
- **#161/#168** already route the non-ESM message through `getEffectiveTarget`: `Compiler.ts:821` computes the target,
  `:829` prints it. The plan's "`Compiler.ts:802` falls back through `getEffectiveTarget`" is **done**. What is left of
  row 14 is the `?? ts.ScriptTarget.ES5` in `getEmittedModuleKind` (`packages/core/src/compiler/esm/check-esm.ts:102`).
- Line numbers moved: `Classic` is at `AddonRegistry.ts:577` (plan: `:602`), `Node10` at `WebpackAddonService.ts:304`
  (plan: `:297`). `environment.ts:394`/`:396` still hold.
- **#183** (fixtures) merged: compiler-test, webpack-test and `bin.test.ts` are clean on 6.0.3 except the two
  `compile-tsc` TS5112 cases (#184's).
- **#181** (loader option errors once) and **#182** (Vite plugin, merged after the CI run below) touched
  `Compiler.ts`/`ModuleCompiler.ts`. #182 shifted `Compiler.ts` by about 6 lines below `:409`; every citation here is
  from `fa114cbe`. #182's own 6.0.3 cell (job 115303299973) has the same failures as below, and its new suites pass
  (`websmith-vite` unit 32/32, `websmith-vite-test` e2e 8/8).

### The failures, measured

**Evidence.** CI job 115299468771, `dist (24, typescript 6.0.3)` of PR #183's run (develop + #183 = `a24984de`).
Reproduced locally in a detached worktree of `a24984de` with the CI override recipe, Node 24.21.0, pnpm 10: the same
counts and test names in every suite. #182's 6.0.3 cell (job 115303299973, on `fa114cbe`'s content) agrees.

**Every failing test on the cell, with its owner:**

| Suite (nx project) | File | Failing | TS cause | Owner |
|---|---|---|---|---|
| testing unit | `testing/src/compilation/environment.spec.ts` "compilationEnv#compiled …" (4: existing project ×2, late setup, with project) | 4/32 | TS5011 layout: env writes `outDir` w/o `rootDir`, emit lands in `dist/src/` | **this slice** (product: env) |
| loader unit | `webpack/src/loader.spec.ts` "TsCompiler compatibility with Compiler" (4) | 4 | TS5011 (+5111 chain) in `Compiler` diagnostics, fixtures `outDir: "./bin"` w/o `rootDir` | **this slice** |
| loader unit | `webpack/src/TsCompiler.spec.ts:119` "… \"fragment\" and \"write\" target …" | 1 | TS5107 `target=ES5` (`:132`) + `noEmitOnError` → no files | **this slice** |
| node unit | `node/src/websmith/Compiler.spec.ts` (3), `compile.spec.ts` (2) | 5/57 | TS5112, `Version 5.7.3` literal | `bug/node-tsc-ignore-config` (#184) |
| core unit | `core/src/compiler/Compiler.spec.ts` `setOptions` (`:616`), `watch` (`:2208`, `:2263`, `:2306`, `:2363`, `:2537`, `:2562`) | 7 | TS5011 layout (`outDir` w/o `rootDir`), output `undefined` | **this slice** |
| core unit | `Compiler.spec.ts` "compile w/ esm profile" `:4392`, `:4408` | 2 | 6.x default target ES2025 → ES module emit → ESM check runs (91010); the tests assume 5.x's CommonJS | **this slice** |
| core unit | `Compiler.spec.ts:5004` "reports TS1479 unlabelled …" | 1 | `nodenext` on 6.0.3 allows `require` of ESM: no TS1479 | **this slice** |
| core unit | `Compiler.spec.ts:5163`, `:5173` "… option error on fast path" | 2 | TS5095 (`bundler` + `commonjs`) is valid on 6.0.3 | **this slice** |
| core unit | `Compiler.spec.ts:5253` "parses with effective target for addonEmitOnly detection …" (node16, nodenext) | 2 | product: `getEffectiveTarget` is wrong on 6.x (see below) | **this slice** |
| core unit | `core/src/compiler/config/resolve-compiler-config.spec.ts:358` | 1 | TypeScript's own `--module` value list differs by major (literal at `:371`) | **this slice** |
| core unit | `core/src/environment/compile-service.spec.ts:79` | 1 | default lib `/lib.d.ts` (5.x) vs `/lib.es2025.full.d.ts` (6.x) | **this slice** |
| compiler unit | `compiler/src/bin.spec.ts` `:270`, `:299`, `:331`, `:364`, `:387`, `:415`, `:438`, `:462`, `:495` | 9/108 | TS5011 layout + TS5107 `node10` (`:275` …`:500`), `es5` (`:332`), `Node10` (`:341`); `.d.ts.map` literal (`:326`) | **this slice** |
| core e2e | `core/src/compiler/Compiler.test.ts:39`, `:64`, `:231` | 3/8 | TS5011 (`outDir: "/bin"` w/o `rootDir`) | **this slice** |
| loader e2e | `webpack/src/loader.test.ts:139`, `:226`, `:303`, `:383` | 4 | TS5011 + TS5107 `es5` (`:230`, `:254`, `:270`, `:413`, `:429`) / `node10` (`:309`, `:333`, `:350`) | **this slice** |
| loader e2e | `webpack/src/webpack.test.ts:138` (`.d.ts.map` literal `:175`), `:242` (`toContain("getFoobar")` `:255`), `:313` (ES5 subject) | 3 | map `mappings` differ by major; 5.x CommonJS emit keeps `exports.getFoobar`, so the assertion is vacuous; TS5107 `target=ES5` | **this slice** |
| examples e2e | `example-addons/tests/foo-bar-generator.test.ts:36`, `export-yaml-generator.test.ts:34`, `foobar-replace-processor.test.ts:33`, `foobar-replace-transformer.test.ts:55` | 4 | TS5011 layout through `compilationEnv` (`dist/src/…`) | **this slice** (env) |
| examples e2e | `foobar-export-processor.test.ts:45`, `:66`; `foobar-replace-transformer.test.ts:24` | 3 | 6.x emits `"use strict";` for script files whatever `strict` is (only `alwaysStrict: false` stops it, and that is TS5107) | **this slice** |
| compiler-test e2e | `compiler-test/tests/compile-tsc.test.ts` ES2020 ×2 | 2/61 | TS5112 | `bug/node-tsc-ignore-config` (#184) |

**Totals:** 58 failing tests (39 unit, 19 e2e). **51 are this slice's**, 7 are #184's. No failing test belongs to
`typescript-6-module-kinds`, `cli-typescript-peer` or `peer-range` today; each of those adds its own red-before e2e.
Green on the cell: lint, api unit, vite unit, compiler e2e (`bin.test.ts` 95/95), webpack-test 102/105 (3 skipped),
vite-test.

### Measured facts the fixes rest on (executed for this brief)

- **TypeScript 6.0.3 derives no `target` from `module`.** Runtime `ts.getEmitScriptTarget({ module })`: 6.0.3 gives
  `12` for `Node16`, `NodeNext`, `CommonJS`, `ESNext` and unset; 5.7.3 gives `9`, `99`, `1`, `1`, `1`.
  `getEffectiveTarget` returns ES2022/ESNext for node16/nodenext on both majors, so on 6.x websmith parses with a
  target `tsc` does not use (the `Set {12, 9}` in the `:5253` failure). `effective-options.spec.ts:23`/`:29` pin the
  wrong 6.x value and pass.
- **`"use strict"` on 6.0.3:** `transpileModule("function f(){}", { module: ESNext, target: ESNext, strict: false })`
  emits `"use strict";`; only `alwaysStrict: false` stops it, and that is TS5107. 5.7.3 emits it only under `strict`.
- **TS1479:** the `Compiler.spec.ts` FILES program (`:4883`–`:4911`) with `module`/`moduleResolution` `Node16` reports
  `[1479, 2835]` on both 5.7.3 and 6.0.3; with `NodeNext`, 6.0.3 reports only `[2835]`.
- **TS5110** (`moduleResolution: node16` + `module: commonjs`) is an option error on both majors and `tsc` still emits
  (measured by the fixtures brief; `bin.test.ts` uses it since #183).
- **Product edits 1–4 below, applied in scratch worktrees of `fa114cbe` on both majors** (no test edits):
  - 6.0.3: the 26 `Error: 5107` lines from `@quatico/websmith-testing`'s addon compile in the e2e log (13
    `node10`, 13 `ES5`) drop to **0**; examples e2e 7 → 3 failed (the three `"use strict"` cases); testing unit still 4
    → 3 (the written-tsconfig literals below); dropping `strict` adds **no** e2e failure on 6.0.3.
  - 5.7.3: compiler-test 61/61, webpack-test 104/105 (1 skipped), loader e2e 38/38, core e2e 8/8, examples 11/11,
    compiler e2e 95/95. Unit: only the `strict: false` literals (16) and the env tsconfig literals (3) go red.
  - Two 6.0.3 webpack-test cases change with item 1 (the `webpack-esm-consumer` case below).

### What to build

Line numbers are from `develop` at `fa114cbe`. Commit in the order below.

#### Websmith's own compilations and defaults (product)

1. **No `moduleResolution` in the three addon compilations.**
   - `packages/core/src/compiler/addons/AddonRegistry.ts:577` (CLI): delete `moduleResolution: Classic`. Options are
     `module: CommonJS`, `noResolve: true` (`:571`–`:581`), so omission is node10 on 5.7.3, bundler on 6.0.3, no
     diagnostic on either (plan, executed by the panel).
   - `packages/webpack/src/WebpackAddonService.ts:304` (loader): delete `moduleResolution: Node10`. `module: CommonJS`
     (`:303`). Update the comment at `:348` ("Node10 resolution ignores package.json \"exports\"") to say it applies
     where TypeScript's default resolution is node10 (5.x); on 6.x the default (bundler) reads `exports`. The
     options hash (`calculateSourceHash`, `:325`) changes, so existing addon caches recompile once; that is wanted.
   - `packages/testing/src/compilation/environment.ts:394`–`:396`: `target: ES5` → `ES2020` (as `AddonRegistry.ts:575`),
     delete `moduleResolution: Node10`. `module: CommonJS` stays.
   - **TS 5.7.3 constraint:** all three sites are `module: CommonJS`, so omission is safe. Never write `Bundler` here:
     with CommonJS it is TS5095 on 5.7.3.
2. **Drop the `strict: false` pin** (`packages/core/src/compiler/defaults.ts:21`, open point 3). An unset `strict`
   then follows the installed TypeScript (off on 5.x, on with 6.x). No other product code reads it, except the debug
   summary's `?? true` at `Compiler.ts:1015`, which is a display fallback like its neighbours; leave it (finding below).
3. **`compilationEnv` gets an explicit `rootDir`** (`environment.ts`, product of `@quatico/websmith-testing`): add
   `rootDir: resolvePath(this.system, this.rootDir, options?.tsConfig?.rootDir ?? sourceDir)` next to `outDir` in the
   constructor's `tsConfig` (`:61`), and write the same `rootDir` into the default tsconfig (`:93`). `sourceDir` is
   `:46`. On 5.7.3 the layout is unchanged whenever sources live in `src/` (all users in the repo; the testing README's
   `/__TEST__/dist/bar.js` example at `packages/testing/README.md:57` describes exactly this); on 6.0.3 it removes the
   `dist/src/` layout and the TS5011. A caller's own `rootDir` wins.
   - *Rejected: putting `rootDir` only into the written tsconfig.* `resolveCompilerOptions` (`:52`) runs before the file
     is written (`:89`), so the env's compile options would not see it.
4. **`getEffectiveTarget` follows the installed major**
   (`packages/core/src/compiler/config/effective-options.ts:13`–`:26`): on TypeScript 6 and later return
   `ts.getDefaultCompilerOptions().target` for an unset `target`, whatever `module` is; keep the node16 → ES2022 /
   nodenext → ESNext derivation for 5.x. Key it on `Number(ts.versionMajorMinor.split(".")[0]) >= 6` and say why in a
   comment (the measured `getEmitScriptTarget` table). Do not call `ts.getEmitScriptTarget`: it is not in
   `typescript.d.ts` (plan, "Findings carried over").
5. **`getEmittedModuleKind`** (`check-esm.ts:97`–`:103`): replace `?? ts.ScriptTarget.ES5` (`:102`) with
   `?? getEffectiveTarget({})` (import from `../config/effective-options`, not the `config` barrel). Its only product
   caller already passes an effective target (`Compiler.ts:821`), so this is the row-14 fallback, not a behaviour fix.

#### Tests (the 51 failures, plus the literals the product edits turn red)

Unit-test conventions (assemble / act / assert, `testObj`, `actual`, no shared `testObj`) apply to new and rewritten
cases. **No version-dependent literals:** an expectation that differs by major comes from TypeScript of the running
major, or the case runs on one major only with the major in its title (`describeOnTs5` as #183 did:
`const describeOnTs5 = Number(ts.versionMajorMinor.split(".")[0]) < 6 ? describe : describe.skip;`; `it`-level
skips trip `jest/no-standalone-expect` in some packages).

- **`strict: false` literals** (red on **both** majors after item 2): remove `strict: false` from the expected objects
  only (fixtures that *set* `strict: false` as input stay). Sites: `core/src/compiler/options/options.spec.ts:61`,
  `:203`, `:230`, `:378`, `:396`, `:570`, `:738`, `:769`; `ResolvedCompilerOptions.spec.ts:49`, `:67`, `:96`, `:112`,
  `:484`, `:536`, `:569`, `:612`, `:656`, `:797`, `:1240`, `:1259`; `Compiler.spec.ts:193`, `:1075`;
  `compiler/src/command.spec.ts:92`, `:119`; `compiler/src/bin.spec.ts:144`, `:171`, `:194`. Check each is an
  expectation before deleting (`options.spec.ts:284`/`:298` are inputs). Measured: 13 core + 3 compiler tests.
- **`testing/src/compilation/environment.spec.ts`**: the written-tsconfig literals `:162`, `:241`, `:270` gain
  `"rootDir":"/target/src"` (red on both majors after item 3). The 4 `#compiled` cases then pass unchanged.
- **`core/src/compiler/Compiler.spec.ts`**:
  - `setOptions` `:616` and the six `watch` cases (`:2208`, `:2263`, `:2306`, `:2363`, `:2537`, `:2562`): add
    `rootDir: "/src"` to the base `tsConfig`. Measured on 6.0.3: the six `watch` cases pass. `setOptions` then shows
    `"use strict";` (its source `class Target {}` is a script): make the source a module (`export class Target {}`)
    and update the inline snapshot on 5.7.3; its subject is `buildDir`, not script emit.
  - `:4392`, `:4408` (default target): their subject is 5.x's "unset `module` + default target → CommonJS". Put them in
    a `describeOnTs5` block ("… on TypeScript 5"), and add one case for 6.x
    ("checks ES module output w/o module and default target on TypeScript 6": expects `[91010]` for the same
    fixture). Derive which applies from `getEmittedModuleKind({ target: getEffectiveTarget({}) })` if you prefer one
    case; never two literals.
  - `:5004` TS1479: give `createNodeNextProgram` (`:4892`) a `module` parameter and build this case with
    `Node16`/`Node16` (measured: 1479 on both majors). The TS2835 cases keep `NodeNext`.
  - `:5163`, `:5173`: `moduleResolution: Bundler` → `Node16` with `module: CommonJS`; expect `5110` instead of `5095`.
  - `:5239`/`:5253` "parses with effective target …" and the debug summary `:5270`: the `node16`/`nodenext` rows
    expect `getEffectiveTarget(tsConfig)` (or the default target on 6.x); with item 4, `:5253` passes on 6.0.3.
- **`core/src/compiler/config/effective-options.spec.ts:23`, `:29`** and **`core/src/environment/system.spec.ts:69`**
  (node16/nodenext rows): expectations per running major (ES2022/ESNext on 5.x, the default target on 6.x). They turn
  red on 6.0.3 with item 4 (measured) and must not be "fixed" back.
- **`core/src/compiler/esm/check-esm.spec.ts:716`** "yields CommonJS w/o module and target": expect
  `getEmittedModuleKind({ target: getEffectiveTarget({}) })`'s kind, i.e. CommonJS on 5.x, ES2015 on 6.x; rename to
  "… the installed TypeScript's default target". Keep the explicit-target cases (`:710`, `:722`–`:746`).
- **`core/src/compiler/config/resolve-compiler-config.spec.ts:358`**: build the expected text from TypeScript's own
  message: the part after "`.json'. `" is `ts.flattenDiagnosticMessageText(ts.parseCommandLine(["--module",
  "NodeLatest"]).errors[0].messageText, "\n")`. Check that this yields the `:371` text on 5.7.3 before relying on it.
- **`core/src/environment/compile-service.spec.ts:79`**: expect `` `/${ts.getDefaultLibFileName(config.options)}` ``
  and rename the case ("returns the installed TypeScript's default lib").
- **`core/src/compiler/Compiler.test.ts`** (e2e) `:52`, `:77`, `:234` (and `:223` for symmetry): add `rootDir: "/src"`.
- **`compiler/src/bin.spec.ts`**: mirror #183's `bin.test.ts` change. `createTsConfig` (`:782`) writes
  `rootDir: "src"` when `outDir` is set and `rootDir` is not; `moduleResolution: "node10"` → `"bundler"` at `:275`,
  `:306`, `:369`, `:392`, `:420`, `:443`, `:467`, `:500` (all `target: "esnext"`, no `module`: an ES module kind, where
  omission is **Classic on 5.7.3** and breaks `@types/*`, measured by #183); `:332` `target: "es5"` → `"es2020"` (the
  profile overrides to ESNext); `:341` `Node10` → `Bundler` (profile `module: ESNext`); the `.d.ts.map` literal at `:326`
  becomes a comparison with what TypeScript of the running major emits (as `bin.test.ts:133` does with `emitWithTsc`).
- **`webpack/src/TsCompiler.spec.ts:132`**: `target: ES5` → `ES2015` (the case asserts files and `"use strict"`, which
  CommonJS emits on both majors).
- **`webpack/src/loader.spec.ts`** `:43`, `:105`, `:168`, `:231`: `rootDir: "./src"` next to every `outDir: "./bin"`
  (tsconfig JSON at `:46`/`:108`/`:171`, `tsConfig` and `cliArgs.options` at `:63`/`:72`/`:75`, `:124`/`:133`/`:136`,
  `:187`/`:196`/`:199`, `:245`/`:254`/`:257`). Read each fixture's file paths first.
- **`webpack/src/loader.test.ts`**: `createTsConfig` (`:801`) adds `rootDir: "src"` like `bin.spec.ts`; every
  `tsConfig` with `outDir: testDirs.OUTPUT_DIR` passed to `Compiler`/`TsCompiler` gets `rootDir: testDirs.SOURCE_DIR`;
  `es5`/`ES5` → `es2015`/`ES2015` at `:230`, `:254`, `:270`, `:413`, `:429` (no case asserts ES5 output; `:483`–`:486`
  check names only); `node10` → `bundler` at `:309`, `:333`, `:350` (the case is ESNext/ESNext).
- **`webpack/src/webpack.test.ts`**: `:175` map literal → comparison with TypeScript's emit of the running major;
  `:255` `toContain("getFoobar")` → `toContain("getCLIENT")` (measured: passes on 5.7.3 too; the old assertion matched
  `exports.getFoobar` on 5.x and nothing on 6.x; leave `:271`, a different addon); `:313` (subject: ES5 downlevel)
  goes into a `describeOnTs5` block. Optional, not required: `moduleResolution: "node"` at `:146`, `:345`, `:384`,
  `:484`, `:592`, `:663`, `:801` passes on 6.0.3 today; replace with `"bundler"` only where the fixture's module is
  ESNext, and say so in the PR.
- **`example-addons/tests/`**: the four layout cases pass with item 3 (measured). The three `"use strict"` cases
  (`foobar-export-processor.test.ts:45`, `:66`, `foobar-replace-transformer.test.ts:24`) keep script sources (the
  subject is "no export added"). Compare after removing one leading `"use strict";\n`, with a one-line comment that
  TypeScript 6 always emits it for scripts; or compare with `ts.transpileModule` of the expected source and the same
  options. Never a second literal snapshot.
- **`webpack-test/tests/webpack-esm-consumer.test.ts:67`** "should warn about unresolved package with types only under
  package.json exports": red on 6.0.3 after item 1 (measured). On 6.x the loader's addon compile resolves `exports`,
  so there is no warning, and `:58` (the addon applies) still passes. Make `:67` 5.x-only (title "… on TypeScript 5")
  and add the 6.x case "should not warn … on TypeScript 6" (no `WARN.*Cannot find module 'exports-only-package'`).

#### The plan's e2e

- **"An addon project compiles on 6.0.3 without TS5107 and unchanged on 5.7.3"**: compiler-test, through
  `compilationEnv` (as `bar-addon.test.ts`) with a `ReporterMock`/spy reporter: no reported diagnostic has code 5107,
  and the addon is active. Red before on 6.0.3 (the 26 `Error: 5107` lines above). For the CLI and the loader there is
  no red-before: `AddonRegistry` reads only `program.emit()` diagnostics (`:726`) and `WebpackAddonService` throws only
  when emit diagnostics exist (`:353`–`:360`); the deprecation never surfaced there. webpack-test's red-before is the
  `webpack-esm-consumer` 6.x case above. Say this in the PR rather than inventing a red-before.
- **"An addon that calls `ts.factory` in a `before` transformer runs and changes the output … through the CLI and the
  loader"**: already covered, green on both cells, by `compile-websmith.test.ts:321` (`foobar-replace-transformer`,
  `context.factory.createIdentifier`, asserts `function barfoo`) and `webpack-websmith.test.ts:183` (same addon). Name
  them in the PR; add a case only if review finds they do not assert changed output.
- **"A project without `strict` follows the installed TypeScript"**: one compiler-test e2e in the style of
  `tsc-defaults.test.ts`: a project with a TS7006 source (`export const f = (a) => a;`), no `strict`, `rootDir` set;
  websmith's error codes equal `tsc`'s (none on 5.7.3, `7006` on 6.0.3), read from the outputs. Red before on 6.0.3
  (websmith pinned `strict: false`). Use `compile([], { tsConfig: { project } })` for `tsc` so #184's TS5112 does not
  touch it.

### Done when

The plan's slice line is the specification; the scope widening adds the 51 tests above.

- **6.0.3 cell, in the PR's own run** (before → after):

  | nx project | unit | e2e |
  |---|---|---|
  | `@quatico/websmith-testing` | 4 → **0** | — |
  | `websmith-loader` | 5 → **0** | 7 → **0** |
  | `@quatico/websmith-core` | 16 → **0** | 3 → **0** |
  | `@quatico/websmith-compiler` | 9 → **0** | 0 → 0 |
  | `@quatico/websmith-examples` | — | 7 → **0** |
  | `@quatico/websmith-node` | 5 → 5 (#184's; 0 once #184 merged) | — |
  | `@quatico/websmith-compiler-test` | — | 2 → 2 (#184's; 0 once #184 merged), plus the new e2e green |
  | `websmith-loader-test` | — | 0 → **0** (with the esm-consumer 6.x case) |
  | vite, vite-test, api | 0 | 0 |

  Every remainder is #184's, by name: after this slice only #184's 7 tests fail on the 6.0.3 cell, and with #184 the
  cell is green. Lint is green on 6.0.3 today. (websmith's TS5011 reporting is not in this slice; see below.)
- **No TS5107 from websmith's own options.** Grep the 6.0.3 job log (ANSI stripped) for `Error: 5107`: 0 lines (26
  before). Quote the grep.
- **5.7.3 cells:** `dist (22)` and `dist (24)` green; every snapshot body unchanged except the regenerated
  `setOptions` inline snapshot. List every snapshot hunk.
- **`strict`:** `git grep -n "strict: false" packages/core/src/compiler/defaults.ts` is empty.

Gates: `pnpm lint`, `pnpm build`, `pnpm test --skip-nx-cache`, `pnpm test:e2e --skip-nx-cache` locally on 5.7.3; the
affected suites on 6.0.3 with the recipe below.

**`Release-Notes.md`**, under `## [Unreleased]`:
- `### Changed` (`:19`), after the `target`/`esModuleInterop` entry (`:30`), the plan's Breaking line: "**Breaking
  (TypeScript 6 only):** websmith no longer pins `strict: false`; an unset `strict` follows the installed TypeScript
  (off on 5.x as before, on with 6.x, as `tsc` does). Combined with 0.10.0's fail-on-error, a project without `strict`
  in `tsconfig.json` can fail its build on 6.x. Set `"strict": false` to keep the old behaviour." Point to the
  `target`/`esModuleInterop` entry.
- `### Fixed` (`:106`), append: the plan's TS5107 line ("on TypeScript 6, websmith no longer fails with deprecation
  errors (TS5107) for options it sets itself: `moduleResolution` `classic`/`node10` when it compiles addons (CLI and
  webpack loader), and `target: ES5` / `node10` in `@quatico/websmith-testing`"); `compilationEnv` sets `rootDir` to
  its source directory, so output paths are the same on TypeScript 5 and 6; on TypeScript 6 the loader compiles addons
  with TypeScript's default module resolution, which reads `package.json` `exports` (no "Cannot find module" warning);.
- **README:** none required. `packages/testing/README.md:57` already shows the `dist/<file>` layout.

**How to run 6.0.3 locally** (same recipe as #171/#183; never edit `~/.npmrc`):

```bash
export PATH="$HOME/.nvm/versions/node/v24.21.0/bin:$HOME/.nvm/versions/node/v20.19.4/bin:$PATH"  # node 24, pnpm 10
export NX_DAEMON=false
git worktree add --detach "$S" HEAD && cd "$S"          # S in your scratch dir; commit first
pnpm install --frozen-lockfile --offline
pnpm pkg set pnpm.overrides.typescript=6.0.3
: > "$S/.empty-npmrc"
NPM_CONFIG_USERCONFIG="$S/.empty-npmrc" pnpm install --no-frozen-lockfile --config.registry=https://registry.npmjs.org/
pnpm -r exec node -p "require('typescript/package.json').version"    # every line 6.0.3
pnpm build && pnpm test --skip-nx-cache && pnpm test:e2e --skip-nx-cache
cd - && git worktree remove --force "$S"
```

Do not run two full suites in parallel on one machine: two concurrent `test:e2e` runs cut `websmith-loader-test`
short twice during this brief's measurements.

### Not in this slice

Reporting TS5011 once, as `tsc` does, and failing where `tsc` 6 fails with `declaration: true` (websmith exits 0
today) moved to `bug/typescript-6-root-dir-once`, because it changes exit codes. It waits on this slice. This slice's
fixtures keep `rootDir` explicit, so they do not depend on it.

### Found while writing this brief — report, do not fix

- The debug summary (`Compiler.ts:1005`–`:1022`) prints fallbacks that are not `tsc`'s defaults (`strict ?? true`,
  `sourceMap ?? true`, `declaration ?? true`, `noEmit ?? true`, `moduleResolution ?? 2`). Debug output only.
- `README.md:191` shows `"target": "es5"` in a profile example; `packages/webpack/README.md:95` uses
  `moduleResolution: "bundler"` with CommonJS as its TS5095 example, which is valid on 6.x. Docs for the
  module-kinds slice.
- `bin.test.ts`'s `classic` case (kept by #183, TS5070 subject) and `Compiler.test.ts:199` (`target: ES5` in a debug
  case) still use deprecated values and pass on 6.0.3. A 7.0 concern.

### Scope guard

This branch owns:
- `packages/core/src/compiler/{defaults.ts,config/effective-options.ts,esm/check-esm.ts,addons/AddonRegistry.ts}`
  `packages/webpack/src/WebpackAddonService.ts`;
  `packages/testing/src/compilation/environment.ts`;
- the specs and e2e files named above in `packages/core`, `packages/compiler/src/*.spec.ts`, `packages/webpack/src`,
  `packages/testing/src`, `packages/example-addons/tests`, and in webpack-test `webpack-esm-consumer.test.ts`;
  in compiler-test the new e2e files;
- its `### Changed` and `### Fixed` lines in `Release-Notes.md`, and the `→ #<PR>` suffix on its own line in the plan
  (`docs/plans/2026-10-02-typescript-6-support.md:322`, before the `<!-- builds: -->` comment).

Do not touch:
- **`packages/node/**`** and `packages/compiler-test/tests/tsc-ignore-config.test.ts` (#184,
  `bug/node-tsc-ignore-config`, open now), nor `compile-tsc.test.ts` and its snapshot: their two red cases are #184's
  TS5112 and turn green when it merges;
- `packages/compiler/src/bin.test.ts`: it is green on both cells;
- TS5011 reporting: `Compiler.ts`'s option-diagnostic handling, `ModuleCompiler.ts`, `webpack-loader-option-names.test.ts`
  and `compiler-test/tests/tsc-root-dir.test.ts` (`bug/typescript-6-root-dir-once`);
- `package.json` files, `pnpm-lock.yaml`, tsconfigs, `.github/workflows/*` (peer ranges and the matrix are the
  peer-range slice's; dependabot #185/#186 touch manifests);
- the node16/nodenext module-kind checks at `Compiler.ts:960` and `:1426` and `packages/api` option types (`feature/typescript-6-module-kinds`);
- `checkTypeScript()` and the CLI's `typescript` dependency (`feature/cli-typescript-peer`).

Shared files with #184: `Release-Notes.md` (both append under `### Fixed`; rebase and keep both) and the plan file
(different lines: #184 suffixes `:310`, you `:322`). Whoever merges second rebases.

If the cell shows a failure this brief does not name, triage it by error code and report it in the PR rather than
improvising outside scope.

### Repo facts for the implementer

- pnpm 10 is at `$HOME/.nvm/versions/node/v20.19.4/bin/pnpm` (Homebrew pnpm 11 fails with E401). CI is pnpm 9.
- Installs on the branch use `--offline`. The Artifactory login in `~/.npmrc` is expired; never edit it.
- `test:e2e` needs `pnpm build` first; e2e suites spawn the built CLI and loader, so rebuild after product edits.
- New files need the MIT header (`pnpm license:add`); never add them to the `license:check` list.
- Commits in Arlo's notation without a colon (`commit-notation` skill), e.g. `B Compiles addons without
  moduleResolution`, `B Stops pinning strict false`, `B Gives compilationEnv a rootDir`, `B Derives no target from
  module on TypeScript 6`, `t Gives core specs a rootDir and version-neutral expectations`.
- Use `trash`, never `rm`.

### Bookkeeping

- Push the first real commit early; the PR's 6.0.3 cell is the main evidence.
- Open the PR with `plot-open-pr.sh`, not `gh pr create`.
- In the PR body: the before/after table per nx project, the `5107` grep, the snapshot hunks and the e2e
  red-before notes above.
