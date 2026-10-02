<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# TypeScript compiler semantics

Executed (own build of `origin/develop`, TypeScript 5.7.3, `node_modules/.bin/tsc` vs the built CLI `packages/compiler/bin/bin.js -c websmith.config.json -l p -p tsconfig.json`): profile `lib` repro; slice 2 simulated by deleting the `getDefaultCompilerOptions()` spread and `esModuleInterop: false` from the bundled `tsDefaults` and diffing output trees against `tsc` for nodenext, node16, commonjs, esnext+bundler, preserve, no options, node16+explicit es5, plus `-o` (transpileOnly); direct `ts.convertCompilerOptionsFromJson`, `ts.getEmitScriptTarget`, `ts.getESModuleInterop` probes. Only read: the cited line numbers in `Compiler.ts`, `system.ts`, `options.ts`.

## Findings that change the plan

1. **Slice 1 breaks the existing workaround and is not idempotent.** `ts.convertCompilerOptionsFromJson({ lib: ["lib.es2022.d.ts"] }, "")` returns `lib: []` plus a 6046 error (checked; also for `LIB.ES2022.D.TS`). Only short names (`es2022`, case-insensitive) convert. The plan's own repro notes that writing `"lib.es2022.d.ts"` in the profile currently matches `tsc` (executed, confirmed: `f(): number`). After slice 1 those profiles lose the option and get a 6046 error. Decide: accept file names too (skip conversion when the entry already is `lib.*.d.ts`), or call it out as Breaking. Recommend accepting both, which also keeps the function safe if it ever runs on already-converted options (see the `loader-options-once` overlap).
2. **Slice 1 "converts every string array" is wider than `lib`.** With `basePath` `""`, `rootDirs: ["src","./x"]` becomes `["src","x"]` and `typeRoots: ["./types"]` becomes `["types"]` (checked). That is a silent rewrite and still not `tsc`'s behaviour (tsc resolves against the config directory). Either limit the array path to options whose declaration type is a list of enum names (`lib`; `ts.optionDeclarations` is internal, so an explicit allow-list `["lib"]` is simplest), or pass `path.dirname(configFilePath)` as basePath, which `convertEnumOptions` already receives. Put the choice in the plan.
3. **"An unknown entry ... drops the option" is not what `tsc` does.** `tsc` reports 6046 and keeps the valid entries (`["ES2022","bogus"]` gives `["lib.es2022.d.ts"]` plus the error). Dropping the whole `lib` falls back to the target's default lib and produces cascading errors. Say which is intended; keeping valid entries is the `tsc` parity. Also note `convertEnumOptions` filters only 6046: `lib: "ES2022"` as a string gives error 5024 and then passes the raw string through (existing behaviour, pre-existing gap).
4. **`jsx` open point: keep `jsx: Preserve`.** With the spread dropped, a `.tsx` file and no `jsx` option compiled to `a.js` containing raw `<div />`, exit 0, no diagnostic (executed). Today it yields `a.jsx`. `tsc` reports TS17004, but websmith surfaced no diagnostic for it (nor for a plain type error in my fixture; exit 0, so its error reporting is not `tsc`'s here). The plan's premise that dropping it "turns a passing build into a failing one" does not hold: it turns it into silently invalid output. Recommend keeping `jsx: Preserve` as an explicit, documented websmith default (it matches `getDefaultCompilerOptions()` today, so no behaviour change), or only dropping it together with an error report.
5. **Slice 3 trap: `ts.ScriptTarget[99]` is `"Latest"`, not `"ESNext"`** (checked on 5.7.3: `Latest` is declared after `ESNext`, so the reverse mapping wins). "Derive `scriptTargetToString` from `ts.ScriptTarget` like `moduleKindToString`" yields `"latest"`, which `--target` rejects. The plan needs a unit case for 99 expecting `esnext`; the same reverse lookup already prints `Latest` in the esm message at `Compiler.ts:802`. Verified `TARGET_MAP` is an identity map (0..11, 99, 100), so removing it is safe.

## 1. Problem

- Item 1: real (executed). Profile `"lib": ["ES2022"]` gives `f(): any; has(): any`, file-name form gives `number`/`boolean`; exit 0, silent.
- Item 2: real, and the target behaviour is exactly `tsc`'s. 5.7.3 `getEmitScriptTarget`: node16 gives ES2022, nodenext gives `Latest` (ESNext), everything else ES5; `getESModuleInterop`: true for node16, nodenext, preserve, false otherwise. The changelog wording "ES2022 or ESNext" is correct. After the simulated slice 2 the output trees were byte-identical to `tsc` for nodenext (JS, `.d.ts`, `.d.mts` incl. the dynamic-import type), node16, commonjs, esnext/bundler, preserve, none, node16+es5. Under `-o` the JS is identical (declarations are not emitted there, as expected).
- Item 3: caused by item 2, confirmed by the identical `.d.mts` after the simulated change.
- Items 4, 5: real by reading (`Compiler.ts:58-73`, `:77`, `resolve-compiler-config.ts:75`).

## 2. Approach

- Dropping only the pinned target and interop is the right shape; no other pinned value differs from 5.x defaults (`strict`, `allowJs`, `declaration`, `removeComments`, `pretty` all equal or are inert). `jsx` is the only value from `getDefaultCompilerOptions()` besides `target` (it returns just `{ target: 1, jsx: 1 }`), see finding 4.
- Target readers: `Compiler.ts:1208`, `:1215`, `:1285`, `system.ts:73` fall back to `Latest` where `tsDefaults.target` used to supply ES5, so the parse `languageVersion` for unset target changes from ES5 to Latest. `tsc` parses with `getEmitScriptTarget`; switching them is the right call, and `createVersionedFile` uses `tsConfig.target ||` on `tsDefaults` itself (`system.ts:73` is `getVersionedFile`, which passes `tsDefaults`), so that one needs the same change. Low risk, but list it in the unit tests.
- `getEmittedModuleKind` (`esm/check-esm.ts:95`) already treats unset target as ES5 and is consistent with `tsc` for unset module and target; with `module` set the target is irrelevant. No change needed.
- The `.mts`/`esModuleInterop` claim that "the story's wording is the other way round" is correct as stated.

## 3. Slices

- Order is sound. Slice 1 needs the amendments above (1, 2, 3) and a test that `lib.es2022.d.ts` still works. Slice 2 is one reviewable PR; its e2e matrix should cover node16 (ES2022) as well as nodenext (ESNext), plus one non-node `module` to prove no change. Slice 3 needs finding 5.
- Tests: slice 2 e2e would fail before the change (verified: DIFF before, IDENTICAL after).

## 4. Overlap

- `loader-options-once` (#134): shares `convertEnumOptions`; the plan already names it. Add: whichever lands first must keep the conversion idempotent (finding 1), because loader `tsConfig` may be resolved more than once.
- `ts7-rearchitecture`: the plan's description of the overlap is accurate. Note TypeScript 6.0 makes `esModuleInterop` and a newer `target` the defaults anyway, so slice 2 loses nothing there.

## 5. Open points to decide before approval

- Breaking note: `### Changed` with `**Breaking:**` (recommended; JS output changes for node16/nodenext, ES5 to ES2022/ESNext).
- `jsx`: keep `jsx: Preserve` (recommended, finding 4).
- New: accept `lib.*.d.ts` entries in slice 1; keep valid entries on a bad name; restrict array conversion to `lib` (or use the config directory as basePath).
- Other pinned values stay; agreed.

Verdict: amend
