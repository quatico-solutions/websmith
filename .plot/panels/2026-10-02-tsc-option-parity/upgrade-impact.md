<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# Upgrade impact for existing users

Executed: read the plan from `origin/idea/tsc-option-parity`, the cited code on `origin/develop`, `Release-Notes.md`,
and qs-magellan's tsconfig and websmith config files (read-only); ran `ts.getEmitScriptTarget` and
`ts.getESModuleInterop` against the repo's TypeScript 5.7.3. Not executed: a websmith build or the plan's fixtures.

## Findings that change the plan

1. **The "only node16/nodenext" claim is wrong for `module: preserve`.** In TypeScript 5.7.3,
   `getESModuleInterop({ module: Preserve })` returns `true` (CommonJS, ES2015, ESNext: `false`; Node16: `true`;
   NodeNext: `true`; `moduleResolution: bundler` alone: `false`). Target stays ES5 for `preserve`. So dropping
   `esModuleInterop: false` (`defaults.ts:16`) also changes `preserve` projects: default imports of CJS modules gain
   `__importDefault` / `__importStar` interop and `allowSyntheticDefaultImports` flips to true (fewer type errors).
   The Changelog sentence "Projects with other `module` values are unaffected" and the open point's "narrow
   (node16/nodenext ...)" must name `preserve` too, or be reworded as "projects whose `module` implies a newer
   target or interop".
2. **Type-checking changes as well as emit.** With `esModuleInterop` no longer pinned to `false`,
   `allowSyntheticDefaultImports` is derived true for node16/nodenext/preserve. Diagnostics that websmith used to
   report (default import of a module without default export) disappear; the opposite direction is possible with a
   newly derived `target` (ES2022/ESNext changes lib defaults and `useDefineForClassFields`, which defaults to true
   from ES2022 and changes class field emit and semantics). The Breaking note lists syntax and the interop helper
   only. Add: class-field semantics (`useDefineForClassFields`) and lib defaults. This is the most likely real
   runtime break for a node16/nodenext project.
3. **A third ES5 fallback is missing from the plan's audit.** `Compiler.ts:802` (`getCheckedEsm`) reads
   `target ?? "ES5"` for the message, and `getEmittedModuleKind({ module, target })` at `:798` depends on `target`.
   After slice 2 `ctx.getCompilerOptions().target` can be `undefined` for these profiles. The plan lists the
   `Latest` fallbacks (`:1208`, `:1215`, `:1285`, `system.ts:73`) but not this one. For an `esm` profile with
   `module` unset and `target` unset the message must still be accurate and the module kind must still come out as
   CommonJS. Add a unit test for the ESM check with unset target to slice 2.
4. **Breaking placement: keep it under `### Changed` with `**Breaking:**`.** The 0.10.0 notes use exactly that form
   for behaviour changes (`Release-Notes.md:76,79,101`), and this one changes emitted JavaScript silently with exit
   code 0, so a "Fixed" entry would hide it from people scanning for breaks. Resolve the first open point as
   proposed. Also state the release: the notes only have `[Unreleased]`, and the plan never says 0.11.0; slices 1
   and 3 are non-breaking, slice 2 makes the release a minor-with-breaking under 0.x. Say so in the plan's
   Changelog or Notes.
5. **The migration hint is incomplete.** "Set `target: ES5` and `esModuleInterop: false`" restores the output but
   also needs to cover `module: preserve` (same two keys) and should add that setting `target` explicitly also pins
   `useDefineForClassFields` behaviour only if `useDefineForClassFields: false` is added. Add that to the entry.
   Also note the profile route: the keys can go into a profile's `tsConfig` in `websmith.config.json`, which is where
   a user of a shared tsconfig would apply them.
6. **TypeScript 6.0 interaction.** TypeScript 6.0 changes the default `target`, so after slice 2 a user on TS 6 sees
   a second default change that is TypeScript's, not websmith's. The Breaking note should say that unset options now
   follow the installed TypeScript version's defaults, so upgrading TypeScript can change websmith output. This
   sentence is the long-term migration hint and costs one line.

## Who is affected (checked)

- **qs-magellan (`/Users/jwloka/Quatico/Magellan/qs-magellan/node`), not affected by slices 1 to 3.**
  - Root `tsconfig.json` sets `target: ES2020`, `module: commonjs`, `esModuleInterop: true`, `lib: ["ES2020"]`;
    `addons`, `cli`, `server`, `client` extend it (`client` overrides `lib` to `["ES2020","DOM"]`).
  - `packages/starter/tsconfig.json` is `module: Node16` but sets `target: ES2020` and `esModuleInterop: true`
    explicitly, so slice 2 changes nothing there.
  - The only `websmith.config.json` files are the starter templates
    (`packages/starter/templates/react-typescript-webpack/websmith.config.json`): profile `server` sets
    `outDir` and `module: "ESNext"`, no `lib`, no `target`; the template tsconfig sets `target: es6`,
    `esModuleInterop: true` and `jsx: "react"`. Slice 1 (`lib`) does not apply; the `jsx` open point does not apply
    because `jsx` is explicit.
  - magellan pins `@quatico/websmith-*` to `0.9.0` / `0.9.x`, so it meets 0.10.0's Node and exit-code breaks
    first; slice 2 is not its next risk.
- **Who is affected overall:** projects whose effective tsconfig has `module` of node16, nodenext or preserve and
  leaves `target` / `esModuleInterop` unset. Projects that extend a base config (`@tsconfig/node22` and similar)
  set both and are safe. Webpack-loader users with `module: esnext` and unset `target` stay ES5 as before.
- **`jsx` (open point):** dropping the spread turns a passing `.tsx` build into a failing one (TS5090-type error:
  "Cannot use JSX unless the '--jsx' flag is provided") for any project that never set `jsx`. That is a hard
  failure after 0.10's fail-on-error change, in a bugfix slice, for a case the plan's own motivation does not need.
  Recommend: **keep `jsx: Preserve` as an explicit websmith default** and say in a code comment why it deviates;
  slice 2 should delete only `target` and `esModuleInterop`. Do not spread `getDefaultCompilerOptions()` anymore,
  but keep the key.

## Approach, slices, overlap

- Slice order is right: slice 1 is a pure fix; slice 2 is one revertable PR; slice 3 is a refactor. For slice 2,
  split the release-note and test sweep carefully: the webpack-test snapshot updates are part of the breaking
  surface and belong in the same PR. Slice 2's tests are failing-before (nodenext fixture vs `tsc`), good.
- Slice 1 changes behaviour for users with profile `lib`: values passed as written currently degrade to `any`
  silently; after the change an unknown entry reports 6046 and, since 0.10, fails the build. That is a behaviour
  change for users who today have a typo'd `lib` that "works". Add one line to the Changelog Fixed entry: unknown
  names are now errors.
- Overlap: `ts7-rearchitecture` candidate slice (named in the plan); `loader-options-once` shares
  `convertEnumOptions` (plan names it). No further duplication seen.

## Open points: recommendations

1. Breaking note placement: `### Changed`, `**Breaking:**` (see finding 4).
2. `jsx`: keep `Preserve` as websmith default.
3. Pinned values (`strict`, `allowJs`, ...): keep, as the plan says.
4. TS 6.0: no action beyond the one-line note in finding 6.
5. Shared helper: decide before approval, as the plan says; not an upgrade-impact matter.

Verdict: amend
