<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# Match tsc for compiler options and defaults

> Make websmith resolve compiler options the way `tsc` does: convert profile `lib` names, stop pinning `target: ES5`
> and `esModuleInterop: false` where `module` implies newer values, and replace the hand-copied enum tables and the
> duplicated 6046 constant. Scope is option resolution and the output it produces; whether websmith reports the
> same diagnostics as `tsc` (type errors on the default CLI path) is not part of this plan.

## Status

- **State:** Approved
- **Type:** bug
- **Story:** node24-esm-support
- **Review:** pr
- **Impl:** own branches
- **Rounds:** 1
- **Approved:** 2026-10-02, Jan Wloka, plan-PR #135 merged
- **Started:** 2026-10-02, Jan Wloka, `bug/tsc-default-target-interop`
- **Started:** 2026-10-02, Jan Wloka, `bug/option-enum-tables`
<!-- Transition records — written by the workflow commands, not by hand:
- **Approved:** <date>, <who>, <channel>
- **Started:** <date>, <who>, <branch>   (one line per started branch)
-->

## Changelog

Release: the next minor, 0.11.0. Slices "Profile lib names" and "Option constants" are non-breaking; "tsc defaults"
makes 0.11.0 a minor release with a breaking change, as allowed under 0.x.

- Fixed: `lib` names in a profile `tsConfig` of `websmith.config.json` (e.g. `"lib": ["ES2022"]`) are converted the
  way `tsconfig.json` converts them. Before, they were passed as written and declarations degraded to `any`. File
  names such as `"lib.es2022.d.ts"` keep working. An unknown name is now reported as an error (and, since 0.10.0,
  fails the build); the valid entries of the list are kept, as `tsc` does.
- **Breaking** (under `### Changed`): websmith no longer sets `target: "ES5"` and `esModuleInterop: false` when a
  project leaves them out. For these two options it uses the same defaults as `tsc` 5.x. Affected are projects whose
  `module` implies a newer target or interop — `node16`, `nodenext` and `preserve` — and that leave `target` or
  `esModuleInterop` unset:
  - with `node16` or `nodenext`, output targets ES2022 or ESNext (`const`, native `async`) instead of ES5 (`var`,
    `__awaiter`), and the newer target changes the default `lib` and turns on `useDefineForClassFields`, so class
    fields are emitted as `Object.defineProperty`-style own properties (`[[Define]]` semantics), which can change
    runtime behaviour of classes that rely on setters or on fields declared without an initializer;
  - with `node16`, `nodenext` and `preserve`, default imports of CommonJS modules use the `__importDefault` /
    `__importStar` helpers and `allowSyntheticDefaultImports` is on, so some type errors about missing default
    exports disappear; `.d.mts` declarations of dynamic imports from CommonJS files now match `tsc`.
  Projects with other `module` values are unaffected. To keep the old output, set `"target": "ES5"`,
  `"esModuleInterop": false` and, if class-field semantics matter, `"useDefineForClassFields": false` in
  `tsconfig.json`, or in a profile's `tsConfig` in `websmith.config.json` when the `tsconfig.json` is shared.
  Options a project leaves unset now follow the installed TypeScript's defaults, so upgrading TypeScript (for
  example to 6.x) can change websmith's output the same way it changes `tsc`'s.

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
declarations differ. A `module: preserve` project gets the same missing interop (`tsc` derives `esModuleInterop`
true for it; its target stays ES5). On TypeScript 6 the pinned `esModuleInterop: false` is worse: it fails every
project that leaves it unset with TS5107, on the Program and the `transpileOnly` path (measured on 6.0.3 by
`typescript-6-support`, #144, table row 4).

## Design

### Approach

- **Defaults (slice "tsc defaults").** `tsDefaults` (`packages/core/src/compiler/defaults.ts:9-21`) stops pinning
  values that `tsc` derives from other options: drop the `...ts.getDefaultCompilerOptions()` spread (its
  `target: ES5`) and `esModuleInterop: false`, and keep `jsx: ts.JsxEmit.Preserve` as an explicit websmith default
  with a code comment saying why (Open Point "jsx default"). TypeScript then derives the effective target and
  interop during emit the way `tsc` does; the panel's tsc-semantics juror simulated exactly this change and got
  output trees byte-identical to `tsc` 5.7.3 for nodenext, node16, commonjs, esnext+bundler, preserve, no options,
  node16 with explicit ES5, and `-o`.
- **One websmith-owned effective-target helper.** Code that reads `compilerOptions.target` directly must not see
  `undefined` where `tsDefaults` used to supply ES5. It does not call `ts.getEmitScriptTarget` or
  `ts.getESModuleInterop`: both exist at runtime but are absent from `typescript.d.ts` and from the TypeScript 7
  surface (Open Point "Helper"). Instead a new `getEffectiveTarget(options)` in
  `packages/core/src/compiler/config/effective-options.ts` returns the explicit `target`, else ES2022 for
  `module: node16`, ESNext for `nodenext`, else `ts.getDefaultCompilerOptions().target` (public API: ES5 on 5.x,
  ES2025 on 6.x, so it follows the installed TypeScript). It operates on `ts.CompilerOptions` only, no `ts.System`
  or host, so it can move with a websmith-owned options type later. No interop helper: no websmith code reads the
  effective interop value; TypeScript derives it itself. `typescript-6-support` (#144) slice 2 extends this same
  module with its version-aware `module` default instead of adding a second helper. The audit is bounded to these
  readers, each switched to the helper and covered by a unit test:
  - `Compiler.ts:1208`, `:1215`, `:1285` and `environment/system.ts:73` (parse `languageVersion`, today
    `?? ts.ScriptTarget.Latest`, which after the change would parse with Latest where `tsc` parses with the
    effective target);
  - `Compiler.ts:798` (`getEmittedModuleKind({ module, target })` in `getCheckedEsm`) and `:802` (the message's
    `target ?? "ES5"`): with `module` and `target` unset, an `esm` profile must still classify as CommonJS and the
    message must name the effective target. `getEmittedModuleKind` (`esm/check-esm.ts:95`) already treats unset
    target as ES5, so on 5.x it needs no change; its 6.x default (`module` esnext) is #144's row 14;
  - `Compiler.ts:983` (the `target: … ?? 99` log line) prints the effective target instead of `99`.
- **`transpileOnly` on TypeScript 6.** Slice "tsc defaults" also changes the `transpileOnly` default target. That
  stays neutral or better on 6.x: `transpileModule` reports TS5107 for deprecated options (measured by #144 on
  6.0.3), and the slice removes two websmith-set deprecated values (`ES5`, `esModuleInterop: false`) without adding
  one.
- **Profile `lib` (slice "Profile lib names").** Builds on #134 `loader-options-once`, whose slice
  `bug/loader-tsconfig-enum-options` moves `convertEnumOptions` into an exported module of `@quatico/websmith-core`
  (Open Point "Helper home"); this slice extends it there and lands after it. Changes:
  - an allow-list of array options converted by name: `["lib"]` only. Other string arrays (`rootDirs`,
    `typeRoots`, `types`, `paths` values) pass through unchanged, as today; converting them with `basePath ""` would
    silently rewrite `./x` to `x` and still not resolve them against the config directory as `tsc` does;
  - each `lib` entry converts on its own through `ts.convertCompilerOptionsFromJson({ lib: [entry] }, "")`;
  - an entry that already is a file name (`/^lib\..+\.d\.ts$/i`, e.g. `lib.es2022.d.ts`) is kept as written, so
    today's workaround keeps working and the conversion is idempotent: the loader may convert options that core
    converts again;
  - an unknown entry reports 6046 (the same message format as an unknown `module` name) and is dropped; the valid
    entries are kept, as `tsc` does for `["ES2022", "bogus"]`. Dropping the whole option would fall back to the
    target's default `lib` and cascade into unrelated errors;
  - the profile `lib` merges with the `tsconfig.json` `lib` through `arrayMerge`, so both sides hold file names.
  The pre-existing gap that `lib: "ES2022"` written as a string (TS5024) passes through is not changed.
- **Tables and constants (slice "Option constants").** Remove `TARGET_MAP` (`Compiler.ts:58-73`, identity for
  0..11, 99, 100) and its `normalizeCompilerOptions` branch (`:1011`), no behaviour change. Replace the table in
  `scriptTargetToString` (`config/parsed-command-line.ts:155-174`) by a lookup derived from `ts.ScriptTarget` with
  explicit entries where the reverse map gives a name `--target` rejects: `99` → `esnext` (`ts.ScriptTarget[99]` is
  `"Latest"`), `100` → `json`, and `12` → `es2025` (absent on 5.7.3, `"LatestStandard"` on 6.0.3; asked for by #144,
  row 10). The same function names the target in the `Compiler.ts:802` message, which today prints `Latest` for
  ESNext. `moduleKindToString` keeps its reverse lookup but gets unit cases for every `ts.ModuleKind` value
  `--module` accepts (`none`, `es2015`, `node16`, `nodenext`, `preserve` and the rest), so an alias that the reverse
  map resolves to a name `tsc` rejects fails a test. The 6046 code becomes one exported constant next to
  `convertEnumOptions` (in `resolve-compiler-config.ts`, or in #134's module once that has landed) and is used there and at `Compiler.ts:1405`. The slice's last commit
  updates the `ts7-rearchitecture` story's "Candidate slice independent of the strategy": the `esModuleInterop:
  false` default, the implied `target: ES5` and the ES3/ES5 target tables are marked done by this plan, the rest
  points to #144's ownership table.
- **Tests per slice** (Definition of Done): unit tests in `packages/core` (assemble / act / assert, `testObj`,
  `actual`) for every changed function, and a CLI e2e case in `packages/compiler-test` that compiles a fixture with
  `tsc` and with websmith and compares the output. The webpack loader shares `tsDefaults`, so slice "tsc defaults"
  also runs `packages/webpack-test` and updates its snapshots where the default output changes; those snapshot
  changes belong to the same PR, as part of the breaking surface.

### Cross-plan

- **#134 `loader-options-once`:** owns moving `convertEnumOptions` into an exported module of
  `@quatico/websmith-core` (its slice `bug/loader-tsconfig-enum-options`). This plan's slice "Profile lib names"
  builds on that module and waits for it (`waits:` annotation on the branch line).
- **#144 `typescript-6-support`:** this plan owns, per #144's ownership table, the `esModuleInterop: false` and
  `target: ES5` defaults (slice "tsc defaults") and the target tables including `12` / ES2025 (slice "Option
  constants"). #144's slice 2 `bug/typescript-6-deprecated-options` depends on both and extends the
  `effective-options.ts` helper. `strict: false` belongs to #144 (its open point 3), not here.
- **#136 `cli-error-exit-gaps`:** owns `-p <directory>`; this plan does not touch `--project`, directories or
  TS505x. #136's option-diagnostics slice should run after slice "tsc defaults", since a changed default `target`
  can surface new TS5xxx option combinations. Whether websmith reports type errors the way `tsc` does (the panel's
  shared blind spot: exit 0 on a plain type error on the default CLI path) is #136's or a separate plan's.

### Open Points

- [x] **Breaking note for slice "tsc defaults"** — decided: a `**Breaking:**` entry under `### Changed` in
      `Release-Notes.md`, worded as in the Changelog above (affected `module` values node16, nodenext, preserve;
      `useDefineForClassFields` and default `lib`; migration via `tsconfig.json` or a profile `tsConfig`; unset
      options follow the installed TypeScript), pending approval. Reason: the emitted JavaScript changes silently
      with exit 0, and 0.10.0 lists behaviour changes the same way (`Release-Notes.md:76,79,101`); a `### Fixed`
      entry would hide it from readers scanning for breaks. All three jurors agreed.
- [x] **`jsx` default** — decided: keep `jsx: Preserve` as an explicit, commented websmith default, pending
      approval. Reason: dropping it does not make `.tsx` builds fail; executed by the panel, a `.tsx` file without
      `jsx` then compiles to `a.js` containing raw `<div />` with exit 0 and no diagnostic (today `a.jsx`).
      Silently invalid output is worse than the deviation from `tsc`, and keeping it changes nothing for anyone.
- [x] **Helper: TypeScript internals or a websmith helper** — decided: the websmith-owned `getEffectiveTarget` in
      `config/effective-options.ts`, pending approval. Reason: `ts.getEmitScriptTarget` / `ts.getESModuleInterop`
      are not in `typescript.d.ts` (a cast, two more untyped symbols) and not in the TypeScript 7 surface; one small
      helper is a single seam that #144 extends for 6.x and that can be deleted when websmith supports only
      TypeScript 6+. #144 records the same.
- [x] **Helper home for `convertEnumOptions`** — decided: #134's slice `bug/loader-tsconfig-enum-options` moves it
      into an exported module of `@quatico/websmith-core`; slice "Profile lib names" builds on it and lands after
      it, pending approval. Reason: one owner for the move avoids two plans rewriting the same function in
      parallel; the loader needs the export first, `lib` conversion can wait.
- [x] **Array conversion scope** — decided: an explicit allow-list `["lib"]`, pending approval. Reason: `lib` is
      the only string-array option whose entries are enum names; using the config directory as `basePath` would
      start resolving `rootDirs` / `typeRoots` in a place that does not do so today, a behaviour change this plan
      does not need. `ts.optionDeclarations` (which would let the list be derived) is internal.
- [x] **Unknown `lib` entry** — decided: report 6046 per unknown entry and keep the valid entries, pending
      approval. Reason: that is `tsc`'s behaviour; dropping the whole option falls back to the target's default
      `lib` and cascades into unrelated errors.
- [x] **`strict: false` and the other pinned values** (`allowJs`, `declaration`, `removeComments`, …) — decided:
      they stay; they equal `tsc` 5.x defaults. `strict: false` on TypeScript 6 is decided by #144 (its open point
      3), not by this plan, pending approval.
- [x] **TypeScript 6 deprecations overlap** — decided: split per #144's ownership table (see Cross-plan); slice
      "Option constants" updates the `ts7-rearchitecture` story's candidate-slice list in its last commit, not
      "once this plan lands", pending approval. Reason: otherwise the story and the plans both claim the same hits.
- [x] **Release** — decided: 0.11.0, a minor release with a breaking change under 0.x, pending approval. Reason:
      only slice "tsc defaults" is breaking, and it is opt-out through two explicit options.

## Slices

### tsc defaults

- `bug/tsc-default-target-interop` — `tsDefaults` drops the `getDefaultCompilerOptions()` spread and `esModuleInterop: false`, keeps an explicit commented `jsx: Preserve`; `getEffectiveTarget` in `config/effective-options.ts` used at `Compiler.ts:798`, `:802`, `:983`, `:1208`, `:1215`, `:1285` and `system.ts:73`; unit tests for the helper (explicit target, node16, nodenext, other `module`, unset), for the resolved options with and without explicit values, and for `getCheckedEsm` on an `esm` profile with unset `module` and `target` (CommonJS, accurate message); e2e in compiler-test: fixtures without `target`/`esModuleInterop` for node16, nodenext, preserve and commonjs (unchanged) match `tsc` JS and declarations, including the `.d.mts` dynamic-import case (item 3) and a class with fields (`useDefineForClassFields`), on the Program and `transpileOnly` paths, plus a `.tsx` fixture without `jsx` that still emits `.jsx`; webpack-test snapshots updated in the same PR; Breaking entry under `### Changed` in `Release-Notes.md` <!-- builds: tsc-equivalent tsDefaults, getEffectiveTarget in effective-options.ts --> → #161

### Option constants

- `bug/option-enum-tables` — remove `TARGET_MAP` and its `normalizeCompilerOptions` branch, derive `scriptTargetToString` from `ts.ScriptTarget` with explicit entries for 12 (`es2025`), 99 (`esnext`) and 100 (`json`) and use it in the `Compiler.ts:802` message, one exported 6046 constant used by `convertEnumOptions` and `Compiler.ts:1405`, the `ts7-rearchitecture` story's candidate slice updated in the last commit; unit tests for every target value incl. 12/99/100 and for `moduleKindToString` over all `--module` names; e2e: a compiler-test case passing `--target esnext` through the CLI args path reaches `tsc` as `esnext`, existing suites green <!-- builds: derived target names with explicit 12/99/100 entries, shared TS 6046 constant -->

### Profile lib names

- `bug/profile-lib-names` — `convertEnumOptions` (as moved by #134) converts the `lib` array entry by entry: short names to file names, `lib.*.d.ts` entries kept as written, unknown entries reported as 6046 and dropped while valid ones stay; other arrays untouched; unit tests for valid, mixed-case, file-name, mixed valid/unknown, already-converted (idempotent) and `rootDirs`-unchanged inputs; e2e: profile `"lib": ["ES2022"]` gives the same declarations as `tsc --lib es2022`, profile `"lib": ["lib.es2022.d.ts"]` still does, profile `"lib": ["ES2022", "bogus"]` fails with the 6046 message; Changelog Fixed entry in `Release-Notes.md` <!-- builds: lib conversion in convertEnumOptions --> <!-- waits: bug/loader-tsconfig-enum-options -->

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
- Item 3 folded into slice "tsc defaults" instead of getting its own slice: it has no separate cause.
- Slice order: defaults first (behaviour change, one PR to revert if needed; #144 slice 2 and #136's option
  diagnostics wait for it), tables and constants second (refactor; #144 slice 2 also waits for it), `lib` last
  (waits for #134's `bug/loader-tsconfig-enum-options`). Rejected: keeping `lib` first, as in the first draft; with
  the dependency on #134 that would hold the two slices #144 needs behind a third plan.
- Deliverable search (`plot-deliverable-search.sh`):
  - `convertEnumOptions` — the existing function at `resolve-compiler-config.ts:81`, moved by #134 and
    extended by slice "Profile lib names", not duplicated. Related: `convertValueToString` / `scriptTargetToString` in `parsed-command-line.ts:155-189`
    convert the other way (enum → CLI string); slice "Option constants" touches the target table only.
  - `tsDefaults` — `packages/core/src/compiler/defaults.ts:9` (changed by slice "tsc defaults"). A separate `tsDefaults` in
    `packages/node/src/compiler-options.ts:9` already uses `target: ESNext` and `esModuleInterop: true`; it
    belongs to the node wrapper and is not changed.
  - `TARGET_MAP`, `TS_ERROR_CODE_INVALID_OPTION_VALUE` — only the definitions and uses listed above; no shared
    constant exists yet.
  - `profile lib conversion`, `esModuleInterop default` — no existing deliverable; hits are option declarations
    in `packages/api` and test fixtures.
- **Amended after the draft panel** (2026-10-02, `.plot/panels/2026-10-02-tsc-option-parity/`, unanimous `amend`):
  slice "Profile lib names" now accepts `lib.*.d.ts` entries, converts only `lib` and keeps valid entries on an
  unknown one, and builds on #134's move of `convertEnumOptions`; the Breaking note names `module: preserve`,
  `useDefineForClassFields` and the default `lib`, the profile route and that unset options follow the installed
  TypeScript; a websmith-owned `getEffectiveTarget` replaces the non-public `ts.getEmitScriptTarget` /
  `ts.getESModuleInterop`; the slice "tsc defaults" audit adds `Compiler.ts:798`, `:802` and `:983`; `jsx:
  Preserve` stays with the executed reason; slice "Option constants" covers 12, 99 and 100 explicitly, the
  `moduleKindToString` names and the `ts7-rearchitecture` story edit; release 0.11.0 stated; ownership against
  #144 and #136 recorded under Cross-plan; slices reordered (defaults, constants, `lib`); the abstract no longer
  implies diagnostic parity.
