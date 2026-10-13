<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — tsc-option-parity (slice: Profile lib names)

- **Plan (canonical):** `docs/plans/2026-10-02-tsc-option-parity.md` on `develop`
- **Approved:** 2026-10-02, Jan Wloka, plan-PR #135 merged
- **Branch:** `bug/profile-lib-names` (base: `develop`, at `ef29dce6` when this brief was written)
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh` (on PATH). Do not merge it yourself.
- **Review of the code:** an independent review, plus uncached gates run by the maintainer's session before merge

**Ordering.** The slice line carries `<!-- waits: bug/loader-tsconfig-enum-options -->`
(`docs/plans/2026-10-02-tsc-option-parity.md:210`). That branch merged today as #177 (merge `5a51f39e`), so this
slice can start now. It is the plan's last slice: "tsc defaults" merged as #161 and "Option constants" as #168. No
branch waits on this one. `bug/loader-option-errors-once` (#134) may run at the same time; see Scope guard.

Line numbers are from `develop` at `ef29dce6`. If they move, find the code by name.

### What changed on `develop` since the plan

- **#177 moved the function.** `convertEnumOptions` and `TS_ERROR_CODE_INVALID_OPTION_VALUE` now live in
  `packages/core/src/compiler/config/convert-enum-options.ts` (constant `:10-11`, function `:13-41`). They are
  re-exported from `config/index.ts:7`, and so from `@quatico/websmith-core`. (The path is `config/`, not
  `options/`.) The plan's `resolve-compiler-config.ts:81-99` is gone. That file now imports the function (`:12`) and
  calls it for file profiles at `:169-175`.
- **The final signature, as #177's PR body states it:**
  `convertEnumOptions(tsConfig: ts.CompilerOptions, location: string, reporter?: Reporter): ts.CompilerOptions`.
  `location` is the phrase after the value, e.g. `in profile 'p' of '<file>'`, `in profile 'p' of the loader options`
  or `in the loader options`. The message is
  `` `Invalid 'tsConfig.${key}' value '${value}' ${location}. ` + ts.flattenDiagnosticMessageText(error.messageText, " ") ``
  (`:32-36`). Today only `typeof value === "string"` reaches `ts.convertCompilerOptionsFromJson` (`:26-29`), and
  arrays pass through untouched (`:26-27`, pinned by `convert-enum-options.spec.ts:35-39`).
- **It now has four callers, and file profiles go through it two or three times:**
  1. `resolveCompilationConfig` for each file profile, reporting for used ones only (`resolve-compiler-config.ts:169-175`);
  2. `convertProfileEnumOptions` on every profile of the **merged** config (`ResolvedCompilerOptions.ts:394-405`,
     called `:187`). It runs again over the file profiles, which the first pass already converted;
  3. the loader-option `tsConfig` (`ResolvedCompilerOptions.ts:188`);
  4. `convertCliEnumOptions` on `cliArgs.options` (`:411-417`, called `:190`). It converts everything silently and
     then reports only the keys whose value differs from the raw `tsConfig`.

  In the loader, the webpack `createOptions` also calls `resolveCompilationConfig` with a `NoReporter`
  (`packages/webpack/src/options.ts:54`). That makes a third silent pass over file profiles. **Idempotence is
  load-bearing:** a `lib` entry the first pass turned into `lib.es2022.d.ts` must survive every later pass unchanged
  and unreported.
- **Review fix `f1a788fc`.** `getTsConfig` now receives the converted `this.config`
  (`resolvedOptions = { ...resolvedOptions, config: this.config, … }`, `ResolvedCompilerOptions.ts:197`). A selected
  inline profile's `tsConfig` therefore reaches `this.tsConfig` converted. Your `lib` conversion gets there by the
  same route without further wiring. Do not undo that line.
- **`lib` merging is already there.** `getTsConfig` spreads the profile over the `tsconfig.json` options (`:366-372`,
  so the profile wins). The constructor then deep-merges `parsedTsConfig` with `this.tsConfig` through `arrayMerge`
  (`:229-238`, and again `:258`). The `tsconfig.json`'s `lib` file names and the profile's `lib` end up in one
  de-duplicated union. That is the plan's "merges with the `tsconfig.json` `lib` through `arrayMerge`, so both sides
  hold file names". It needs no code: once the profile side holds file names, duplicates collapse.

Checked while writing this brief against TypeScript 5.7.3 (`packages/core/node_modules/typescript`):

- `ts.convertCompilerOptionsFromJson({ lib: ["ES2022"] }, "")` gives `["lib.es2022.d.ts"]`. So does `"es2022"`;
  `"DOM.Iterable"` gives `lib.dom.iterable.d.ts`. All three come back with no error.
- `{ lib: ["lib.es2022.d.ts"] }` and `{ lib: ["bogus"] }` both give `lib: []` and **one 6046**
  (`Argument for '--lib' option must be: 'es5', …`). This is why file names must be kept before conversion, and why
  conversion must go entry by entry: converting the whole array would report the already-converted names.
- `{ lib: "ES2022" }` (a string) gives TS5024, not 6046. The current code then passes the string through
  (`:30`, `:39`). The plan leaves that gap unchanged. Keep it so.

### The work

The plan's Design → "Profile `lib` (slice "Profile lib names")" and the slice line `:210` are the spec.

1. **An array branch in `convertEnumOptions`** (`convert-enum-options.ts:23-41`), for an explicit allow-list
   `["lib"]` only (a module constant beside `TS_ERROR_CODE_INVALID_OPTION_VALUE`). For `lib` arrays:
   - an entry matching `/^lib\..+\.d\.ts$/i` is kept as written;
   - any other string entry is converted alone, with `ts.convertCompilerOptionsFromJson({ lib: [entry] }, "")`. A
     result with one name keeps that name. A 6046 reports
     `Invalid 'tsConfig.lib' value '<entry>' <location>. <TypeScript's message>` through the same `reporter?` and
     drops the entry;
   - valid entries keep their order; an empty result stays an empty array (do not drop the key);
   - non-string entries pass through, as non-strings do today.

   Other arrays (`rootDirs`, `typeRoots`, `types`, `paths` values) pass through unchanged. A `lib` written as a
   string keeps today's pass-through. Keep it **one** exported function with the #177 signature. Factor the message
   into one helper so that the scalar branch and the `lib` branch cannot drift.
2. **Report each bad loader-option `lib` entry once.** `convertCliEnumOptions` decides what is "already reported" by
   `tsConfig[key] !== value` (`ResolvedCompilerOptions.ts:412`). That is a reference comparison. The constructor's
   `deepmerge` (`:119-150`) clones the loader's `tsConfig` and its `cliArgs.options` into two separate arrays. The
   webpack `createOptions` returns them as one object (`options.ts:51`, `:90`), and checked with `deepmerge` and the
   repo's `arrayMerge`, the clones are no longer `===`. With step 1 alone, `tsConfig: { lib: ["ES2022", "bogus"] }`
   as a loader option would report `bogus` **twice**: once at `:188` and once from `cliArgs.options`. Compare arrays
   by content there (same length, same entries in order). That is the only line of `ResolvedCompilerOptions.ts` this
   slice changes.
3. **No other wiring.** File profiles, inline profiles, the loader-option `tsConfig` and `cliArgs.options` all reach
   the function already (callers 1-4 above). Do not add a conversion in `packages/webpack` or in
   `resolve-compiler-config.ts`.
4. **Release notes and docs**, see below.

### Settled decisions — do not re-derive them

- **Allow-list `["lib"]`, not every string array** (Open Point "Array conversion scope"). Converting `rootDirs` /
  `typeRoots` with `basePath ""` would rewrite `./x` to `x` and still not resolve them as `tsc` does.
  `ts.optionDeclarations` is internal.
- **Entry by entry, keep the valid ones** (Open Point "Unknown `lib` entry"). That is `tsc`'s behaviour. Dropping the
  whole option would fall back to the target's default `lib` and cascade into unrelated errors.
- **`lib.*.d.ts` kept as written.** It keeps today's workaround working, and it makes the conversion idempotent
  across the repeated passes listed above.
- **The 6046 constant and the location phrase are #177's.** Reuse `TS_ERROR_CODE_INVALID_OPTION_VALUE` and the
  `location` argument. Add no second constant and no second wording.
- **Used-profile rule.** An unknown entry reports only where the existing callers pass a reporter: used file
  profiles, inline profiles in the selected closure, and the loader-option `tsConfig`. Unused profiles drop it
  silently, as for `module` today (`packages/webpack/README.md:97-98`).

### Not in this slice

These are #177 review LOWs. The plan's slice line covers none of them, so leave them. Name them in the PR as known
and unowned:

- **A file profile pulled in only by an inline `depends` loses its invalid value without a report.**
  `resolveCompilationConfig` computes "used" from the file's profiles alone (`resolve-compiler-config.ts:153`). When
  the selected profile exists only inline, that closure is empty, so the file pass drops the file profile's bad value
  silently (`:173`). The merged-config pass (`ResolvedCompilerOptions.ts:394-405`) then sees nothing left to report.
  After this slice the same holds for a bad `lib` entry in such a profile.
- **"… in the loader options." also shows for non-loader callers.** `LOADER_OPTIONS_LOCATION`
  (`ResolvedCompilerOptions.ts:388`) is used for any `tsConfig` passed to `ResolvedCompilerOptions`. That includes
  the programmatic `createOptions({ tsConfig })` of `@quatico/websmith-compiler` (core `options/options.ts:23-74`).
  Your `lib` message inherits that wording; do not change it here.
- **`"profiles" in loaderOptions` fires for `profiles: undefined`** (`ResolvedCompilerOptions.ts:184`; the webpack
  `createOptions` passes the key on with `"profiles" in args`, `options.ts:93`).

### Tests

**Unit, `packages/core/src/compiler/config/convert-enum-options.spec.ts`.** Rewrite `:35-39` ("should return arrays
unchanged w/ lib"), which pins today's pass-through. Add one case per input the slice line names:

- valid: `["ES2022", "DOM"]` gives `["lib.es2022.d.ts", "lib.dom.d.ts"]`;
- mixed case: `["es2022", "Dom.Iterable"]`;
- file name: `["lib.es2022.d.ts"]` stays as written and reports nothing;
- mixed valid/unknown: `["ES2022", "bogus"]` gives `["lib.es2022.d.ts"]` and **one** report whose `messageText`
  starts with `Invalid 'tsConfig.lib' value 'bogus' in the loader options. `;
- already converted: converting the output again gives an equal result and reports nothing. Extend the idempotence
  case at `:41-49` with a `lib`;
- `rootDirs: ["./a", "./b"]` and `types: ["node"]` stay unchanged;
- without a reporter, the unknown entry is dropped silently;
- `lib: "ES2022"` as a string passes through unchanged (the plan keeps that gap).

Build the expected TypeScript text from the installed TypeScript, as `tsMessageOf` does (`:12-15`). Add a `lib`
variant of it (`{ lib: [entry] }`) or match the websmith prefix only. The `--lib` value list differs between 5.x and
6.x, and the advisory TS 6.0.3 CI cell (#171) runs these tests.

**Unit, `packages/core/src/compiler/options/ResolvedCompilerOptions.spec.ts`**, in `describe("option names")`
(`:1357`). Its `createLoaderOptions` helper (`:1358-1359`) mirrors the loader's shape:

- loader `tsConfig: { lib: ["ES2022", "bogus"] }`: `tsConfig.lib` and `cliArgs.options.lib` contain
  `lib.es2022.d.ts`, and the reporter is called **once** for `bogus`. This case is red after step 1 and green after
  step 2;
- a config-file profile with `lib: ["ES2022"]` selected by `profile`: `getOptions("p").tsConfig.lib` contains
  `lib.es2022.d.ts` and not `ES2022`, and nothing is reported (the file pass and the merged pass together);
- a `tsconfig.json` with `"lib": ["es2020"]` and a selected profile with `lib: ["ES2022"]`: `testObj.tsConfig.lib`
  holds file names only, with no short names left.

**E2E, `packages/compiler-test/tests`.** Add a new file, e.g. `tsc-lib.test.ts`. Model it on `tsc-target.test.ts`:
`createOptions` + `Compiler` in process (`:65-70`), and `tsc` through
`execFileSync(process.execPath, [require.resolve("typescript/bin/tsc"), …])` (`:60-63`). Use `declaration: true` and
no `lib` in `tsconfig.json`. Use a source whose declarations depend on ES2022 lib types, e.g.
`export const f = () => [1, 2].at(0); export const has = (o: object) => Object.hasOwn(o, "x");`. Compare the `.d.ts`
output:

- profile `"lib": ["ES2022"]` gives the same declarations as `tsc --lib es2022`. This is red on `develop`: the plan
  reproduced `f(): any` / `has(): any` (Motivation table, item 1). Assert that the expected side contains
  `number | undefined`, so the test cannot pass on two equally degraded outputs;
- profile `"lib": ["lib.es2022.d.ts"]` still gives the same declarations;
- profile `"lib": ["ES2022", "bogus"]` reports an error diagnostic whose text starts with
  `Invalid 'tsConfig.lib' value 'bogus' in profile '<name>' of '<configFile>'` (use a collecting reporter instead of
  `NoReporter`). The valid entry still applies: the declarations match `tsc --lib es2022`. An error diagnostic is
  what makes the CLI exit 1 (`ErrorTrackingReporter`, `packages/compiler/src/command.ts:170-171`). A `bin.test.ts`
  case is optional.

No webpack-test case is required. The plan names CLI e2e only, and the loader path is covered by the unit test in
step 2.

### Release notes and docs

- **`Release-Notes.md`**, `## [Unreleased]` → `### Fixed`, appended after the #177 entry. Use the plan's Changelog
  bullet: "`lib` names in a profile `tsConfig` of `websmith.config.json` (e.g. `"lib": ["ES2022"]`) are converted
  the way `tsconfig.json` converts them. Before, they were passed as written and declarations degraded to `any`.
  File names such as `"lib.es2022.d.ts"` keep working. An unknown name is reported as an error and fails the build;
  the valid entries of the list are kept, as `tsc` does." Add "Loader-option `tsConfig` and inline profiles too",
  since the same function serves them.
- **README:** no CLI flag, config key or addon API changes, so nothing is required. Optional: one clause on the
  `tsConfig` bullet in `packages/compiler/README.md:97` saying that option names, `lib` included, are accepted as in
  `tsconfig.json`.

### Done when

- The `lib` branch, with the unit cases above green. No assertion hard-codes TypeScript's `--lib` value list.
- The loader-option `lib` case reports `bogus` exactly once.
- The compiler-test e2e: `ES2022` matches `tsc --lib es2022` (red on `develop`), `lib.es2022.d.ts` still matches,
  and `["ES2022", "bogus"]` reports the 6046 message and keeps `ES2022`.
- Existing suites unchanged and green. In particular, `resolve-compiler-config.spec.ts`, the #177 cases in
  `ResolvedCompilerOptions.spec.ts:1357-1485` and `webpack-test/tests/webpack-loader-option-names.test.ts` pass
  unmodified.
- **Gates, all green:** `pnpm lint`, `pnpm build`, `pnpm test --skip-nx-cache`, `pnpm test:e2e --skip-nx-cache`. Say
  in the PR whether the advisory TS 6.0.3 cell is green.
- **Tests follow `docs/rules/testing.md`:** assemble / act / assert with no part comments, `testObj` and `actual`,
  no shared `testObj`. New files carry the MIT header (`pnpm license:add`). Do not add them to the `license:check`
  list.

### Repo mechanics

- **pnpm 10** from `$HOME/.nvm/versions/node/v22.17.0/bin`: put it first on `PATH`. The Homebrew pnpm 11 fails with
  E401.
- **Installs:** `pnpm install --offline`. Never edit `~/.npmrc`. This branch needs no new package.
- **Commits:** Arlo's notation without a colon (`commit-notation` skill), e.g.
  `B Converts lib names of profile tsConfig entry by entry` and `B Reports a bad loader-option lib entry once`.
- **Deleting files:** use `trash`, never `rm`.

### Bookkeeping

- Push the first green commit as soon as it exists.
- Open the PR with `plot-open-pr.sh`, never `gh pr create`, then give it a descriptive title.
- Append `→ #<number>` to the `bug/profile-lib-names` line (`docs/plans/2026-10-02-tsc-option-parity.md:210`), before
  its `<!-- builds: -->` comment, and commit that on this branch.

### Scope guard

This branch owns:

- `packages/core/src/compiler/config/convert-enum-options.ts` and its spec;
- in `packages/core/src/compiler/options/ResolvedCompilerOptions.ts`, **only** the `unreported` filter of
  `convertCliEnumOptions` (`:411-417`), plus new cases in `describe("option names")` of its spec;
- a new e2e file in `packages/compiler-test/tests` (no changes to existing compiler-test files or snapshots);
- `Release-Notes.md` (one `### Fixed` bullet), optionally `packages/compiler/README.md:97`, and the `→ #<PR>` line in
  the plan.

Do not touch:

- the rest of `ResolvedCompilerOptions.ts`: the constructor between `:180` and `:198`, `LOADER_OPTIONS_LOCATION`,
  the `profiles` check at `:184`, `getTsConfig`, and the `errors: []` at `:250`. The LOWs above and
  `bug/report-config-option-errors` (#136) live there;
- `resolve-compiler-config.ts`, `profile-closure.ts`, `resolve-profile.ts`;
- `packages/core/src/compiler/Compiler.ts` (the 6046 filter at `:1430` and `:1543` stays);
- `packages/core/src/compiler/ModuleCompiler.ts`, everything in `packages/webpack/src`, `packages/webpack-test`;
- `package.json` files, `pnpm-lock.yaml`, tsconfigs, `.github/`.

**Parallel with `bug/loader-option-errors-once` (#134).** Both are core-side, but they share no file. That slice
owns `packages/core/src/compiler/ModuleCompiler.ts`, `packages/webpack/src/loader.ts`, `webpack-hooks.ts`, the
webpack README and webpack-test. It does not touch `ResolvedCompilerOptions.ts` or `convert-enum-options.ts`. The
only shared file is `Release-Notes.md`, where both append to `## [Unreleased]`. Whoever merges second rebases and
keeps both entries.

Other branches that may be in flight:

- **`bug/loader-unknown-profile-error`** (#134, waits on #172, merged) edits `ResolvedCompilerOptions.ts` after
  `resolveProfile` (`:196`) and `resolve-profile.ts`. There is no line overlap with `:411-417`.
- **`bug/typescript-6-test-fixtures`** (#144) moves compiler-test and webpack-test fixtures off `ES5` / `Node10`. A
  new test file of yours does not collide with it. Do not set `target: ES5` or `moduleResolution: node10` in your
  fixture.

If you find something the plan did not anticipate beyond the items above, report it rather than improvising outside
scope.
