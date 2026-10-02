<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# Match tsc for compiler options and defaults

> Make websmith resolve compiler options the way `tsc` does: convert profile `lib` names, stop pinning `target: ES5`
> and `esModuleInterop: false` where `module` implies newer values, and replace the hand-copied enum tables and the
> duplicated 6046 constant with values taken from TypeScript.

## Status

- **State:** Draft
- **Type:** bug
- **Story:** node24-esm-support
- **Review:** pr
- **Impl:** own branches
- **Rounds:** 1
<!-- Transition records — written by the workflow commands, not by hand:
- **Approved:** <date>, <who>, <channel>
- **Started:** <date>, <who>, <branch>   (one line per started branch)
-->

## Changelog

- Fixed: `lib` names in a profile `tsConfig` of `websmith.config.json` (e.g. `"lib": ["ES2022"]`) are converted the
  way `tsconfig.json` converts them. Before, they were passed as written and declarations degraded to `any`.
- **Breaking:** websmith no longer sets `target: "ES5"` and `esModuleInterop: false` when a project leaves them out.
  It uses the same defaults as `tsc`: with `module` `node16` or `nodenext`, output now targets ES2022 or ESNext
  (`const`, native `async`) instead of ES5 (`var`, `__awaiter`), and default imports of CommonJS modules use the
  `__importDefault` interop helper. `.d.mts` declarations of dynamic imports from CommonJS files now match `tsc`.
  Projects with other `module` values are unaffected. To keep the old output, set `"target": "ES5"` and
  `"esModuleInterop": false` in `tsconfig.json`.

## Motivation

The nodenext module fix (#124, `bug/nodenext-module-map`) left five follow-ups in the `node24-esm-support` story
(2026-09-26, "Follow-ups from the nodenext module fix"). All are places where websmith resolves compiler options
differently from `tsc`, so the same `tsconfig.json` gives different JavaScript and declarations. Checked on `develop`
at `d7ffdf4` with the built CLI against `node_modules/.bin/tsc` (TypeScript 5.7.3):

| # | Item | Still holds | Where | Evidence |
|---|---|---|---|---|
| 1 | Profile `lib` names not converted | yes | `packages/core/src/compiler/config/resolve-compiler-config.ts:81-99` (`convertEnumOptions`) | Only string values reach `ts.convertCompilerOptionsFromJson` (`:84`); arrays such as `lib` pass through unchanged. Reproduced: profile `"lib": ["ES2022"]` emits `f(): any` and `has(): any`, `tsc --lib es2022` emits `number` and `boolean`; with `"lib.es2022.d.ts"` written in the profile the output matches `tsc`. |
| 2 | Default `target` and `esModuleInterop` differ | yes | `packages/core/src/compiler/defaults.ts:9-21`, merged first at `options/options.ts:36`, `:47` and `options/ResolvedCompilerOptions.ts:371` | `tsDefaults` spreads `ts.getDefaultCompilerOptions()` (`{ target: ES5, jsx: Preserve }`) and sets `esModuleInterop: false`. Reproduced with `module: nodenext` and no `target`: websmith emits `var` and `__awaiter`/`__generator`, no `__importDefault`, and declarations `v: any`, `Promise<any>`; `tsc` emits `const`, native `async` and `__importDefault`. Same on the `transpileOnly` path. With `module: commonjs` and no `target`, websmith and `tsc` output are identical, and an explicit `target`/`esModuleInterop` in `tsconfig.json` is respected. |
| 3 | `.d.mts` declaration type differs | yes, caused by item 2 | — | Reproduced with `index.mts` → `import("./def.js")` (CJS, `export default def; export const x = 1`): `tsc` emits `Promise<{ default: typeof import("./def.js"); x: 1 }>`, websmith `Promise<typeof import("./def.js")>`. `tsc --esModuleInterop false` emits exactly websmith's type, and with `esModuleInterop: true` in `tsconfig.json` websmith matches `tsc`. Within websmith's control: it is the interop default. (In this repro the two shapes are the other way round from the story's wording; the cause is the same.) |
| 4 | `TARGET_MAP` is an identity map | yes | `packages/core/src/compiler/Compiler.ts:58-73`, used once at `:1011` in `normalizeCompilerOptions` | Maps each `ts.ScriptTarget` number to itself. A second hand-copied target table, `scriptTargetToString`, sits in `config/parsed-command-line.ts:155-174`. |
| 5 | Error code 6046 defined twice | yes | `Compiler.ts:77` (`TS_ERROR_CODE_INVALID_CLI_OPTION`, used `:1405`) and `config/resolve-compiler-config.ts:75` (`TS_ERROR_CODE_INVALID_OPTION_VALUE`, used `:88`) | Same value, two names. |

Item 2 is the one users see: a node16/nodenext project that relies on `tsc`'s implied defaults gets ES5 output from
websmith, CommonJS default imports compile without interop (so `def.value` reads `undefined` at runtime), and
declarations differ.

## Design

### Approach

- **Profile `lib` (slice 1).** `convertEnumOptions` also converts arrays of strings: pass the array to
  `ts.convertCompilerOptionsFromJson({ [key]: value }, "")` and keep the converted array (for `lib`:
  `"ES2022"` → `"lib.es2022.d.ts"`). An unknown entry reports the same 6046 error as an unknown `module` name and
  drops the option. The rule "keep only numeric results" becomes "keep what TypeScript converted". The profile
  `lib` merges with the `tsconfig.json` `lib` through `arrayMerge`, so both sides hold the converted file names.
- **Defaults (slice 2).** `tsDefaults` stops pinning values that `tsc` derives from other options: drop the
  `...ts.getDefaultCompilerOptions()` spread (its `target: ES5`) and `esModuleInterop: false`. TypeScript then
  computes the effective values (`ts.getEmitScriptTarget`, `ts.getESModuleInterop`) the way `tsc` does. Code that
  reads `compilerOptions.target` directly and falls back to `ts.ScriptTarget.Latest` (`Compiler.ts:1208`, `:1215`,
  `:1285`, `environment/system.ts:73`) keeps working; each fallback is checked and switched to
  `ts.getEmitScriptTarget(options)` where the parse target matters. Item 3 needs no change of its own: slice 2
  adds its `.d.mts` case as an e2e test.
- **Tables and constants (slice 3).** Remove `TARGET_MAP` and the `normalizeCompilerOptions` branch that uses it
  (identity, so no behaviour change); derive `scriptTargetToString` from `ts.ScriptTarget` like `moduleKindToString`
  next to it. Move the 6046 code into one exported constant in the compiler config module and use it in both
  places.
- **Tests per slice** (Definition of Done): unit tests in `packages/core` (assemble / act / assert, `testObj`,
  `actual`) for the changed function, and a CLI e2e case in `packages/compiler-test` that compiles a fixture with
  `tsc` and websmith and compares the output. The webpack loader shares `tsDefaults`, so slice 2 also runs
  `packages/webpack-test` and updates its snapshots where the default output changes.

### Open Points

- [ ] **Breaking note for slice 2.** Proposed: a `**Breaking:**` entry under `### Changed`, as for the Node.js and
      exit-code changes, with the explicit-options workaround. Alternative: list it under `### Fixed`, since the
      new output is what `tsc` produces. The affected set is narrow (node16/nodenext without explicit `target` or
      `esModuleInterop`), but the emitted JavaScript changes.
- [ ] **`jsx` default.** `ts.getDefaultCompilerOptions()` also sets `jsx: Preserve`; `tsc` leaves `jsx` unset and
      reports an error for `.tsx` files without it. Dropping the spread matches `tsc` but can turn a passing `.tsx`
      build into a failing one. Keep `jsx: Preserve` as a websmith default, or match `tsc`?
- [ ] **`strict: false` and the other pinned values** (`allowJs`, `declaration`, `removeComments`, …) equal `tsc`'s
      5.x defaults today and stay. TypeScript 6.0 changes some of them (see below).
- [ ] **TypeScript 6.0 deprecations** (`ts7-rearchitecture` story, "Candidate slice independent of the strategy").
      This plan does not take that slice, but overlaps it: slice 2 removes the `esModuleInterop: false` default and
      the pinned `target: ES5`, two of its hits; slice 3 removes the hand-copied ES3/ES5 target tables
      (`TARGET_MAP`, `scriptTargetToString`), part of its "ES3/ES5/AMD/UMD/System tables" hit. Left for that slice:
      the `strict: false` default, `Classic` resolution for addon compilation, the remaining tables, the repo
      tsconfigs and `--outFile`. Taking defaults from TypeScript instead of pinning them means websmith follows
      6.0's own default changes rather than fighting them; update the candidate slice's list once this plan lands.
- [ ] **Shared conversion helper with `loader-options-once`.** That sibling plan converts loader-option `tsConfig`
      strings (`packages/webpack/src/options.ts`) and will likely want `convertEnumOptions`. If it exports or moves
      the helper, slice 1 changes the same function: whichever lands second rebases. Agree on the helper's home
      (`resolve-compiler-config.ts` or a small `convert-options.ts`) before both start.

## Slices

### Profile lib names

- `bug/profile-lib-names` — `convertEnumOptions` converts string arrays such as `lib` through `ts.convertCompilerOptionsFromJson`; unit tests for valid, mixed-case and unknown names; e2e: profile `"lib": ["ES2022"]` gives the same declarations as `tsc --lib es2022` <!-- builds: array conversion in convertEnumOptions -->

### tsc defaults

- `bug/tsc-default-target-interop` — `tsDefaults` drops the `getDefaultCompilerOptions()` target and `esModuleInterop: false`; unit tests for the resolved options with and without explicit values; e2e: nodenext fixture without `target` matches `tsc` JS and declarations, including the `.d.mts` dynamic-import case (item 3), on the Program and `transpileOnly` paths; webpack-test snapshots updated; Breaking entry in `Release-Notes.md` <!-- builds: tsc-equivalent tsDefaults -->

### Option constants

- `bug/option-enum-tables` — remove `TARGET_MAP`, derive `scriptTargetToString` from `ts.ScriptTarget`, one shared 6046 constant; unit tests for the target-name conversion; no behaviour change, existing e2e suites green <!-- builds: shared TS 6046 constant, derived target names -->

## Notes

- Created 2026-10-02 from the `node24-esm-support` story follow-ups of 2026-09-26. Sibling plans drafted the same
  day: `loader-options-once` (loader-option `tsConfig` conversion, per-module option resolution),
  `cli-error-exit-gaps`, `esm-check-precision`; their items are not taken here.
- **Reproduced 2026-10-02** in a worktree build of `d7ffdf4` with throwaway fixtures, comparing
  `node packages/compiler/bin/bin.js -c … -p …` with `node_modules/.bin/tsc`:
  item 1 (profile `lib`), item 2 (nodenext without `target`: ES5 output, no interop, `any` declarations; also with
  `transpileOnly: true`; commonjs without `target` identical to `tsc`), item 3 (traced to the `esModuleInterop`
  default: `tsc --esModuleInterop false` reproduces websmith's type, `esModuleInterop: true` makes websmith match
  `tsc`). Items 4 and 5 confirmed by reading the code. Nothing dropped as already fixed.
- Item 1: in the repro websmith exited 0 and printed no diagnostic; the declarations degraded silently. The story
  mentions errors on the Program path; not seen with a `tsconfig.json` that also sets `lib`.
- Item 3 folded into slice 2 instead of getting its own slice: it has no separate cause.
- Slice order: `lib` first (pure fix), defaults second (behaviour change, one PR to revert if needed), tables and
  constants last (refactor, touches the files the first two change).
- Deliverable search (`plot-deliverable-search.sh`):
  - `convertEnumOptions` — the existing function at `resolve-compiler-config.ts:81`, extended by slice 1, not
    duplicated. Related: `convertValueToString` / `scriptTargetToString` in `parsed-command-line.ts:155-189`
    convert the other way (enum → CLI string); slice 3 touches the target table only.
  - `tsDefaults` — `packages/core/src/compiler/defaults.ts:9` (changed by slice 2). A separate `tsDefaults` in
    `packages/node/src/compiler-options.ts:9` already uses `target: ESNext` and `esModuleInterop: true`; it
    belongs to the node wrapper and is not changed.
  - `TARGET_MAP`, `TS_ERROR_CODE_INVALID_OPTION_VALUE` — only the definitions and uses listed above; no shared
    constant exists yet.
  - `profile lib conversion`, `esModuleInterop default` — no existing deliverable; hits are option declarations
    in `packages/api` and test fixtures.
