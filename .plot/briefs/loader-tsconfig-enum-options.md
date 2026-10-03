<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — loader-options-once (option names: loader-tsconfig-enum-options)

- **Plan (canonical):** `docs/plans/2026-10-02-loader-options-once.md` on `develop`
- **Approved:** 2026-10-02, Jan Wloka, plan-PR #134 merged
- **Branch:** `bug/loader-tsconfig-enum-options` (base: `develop`)
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh` (on PATH). Do not merge it yourself.
- **Review of the code:** an independent review, plus uncached gates run by the maintainer's session before merge

**Ordering.** The plan has this slice wait on `bug/loader-resolve-options-once`. That branch merged as #165, so this
slice can start now. The earlier waves have merged too: `infra/esm-bench-watchdog` (#153) and
`bug/depends-closure-core` (#172). #168 (`bug/option-enum-tables`, #135) has also merged, and it matters here. It
removed `TARGET_MAP`, added `scriptTargetToString` and left one 6046 constant, `TS_ERROR_CODE_INVALID_OPTION_VALUE`,
directly above `convertEnumOptions` so that this slice moves the two together. One branch in another plan waits on
this one: #135's `bug/profile-lib-names` (`<!-- waits: bug/loader-tsconfig-enum-options -->` in
`docs/plans/2026-10-02-tsc-option-parity.md:210`). It extends `convertEnumOptions` "as moved by #134" to the `lib`
array. See "What #135 needs from the moved module" below. No other #134 slice waits on this one.

Line numbers are from `develop` at `44c47fc7`. If they move, find the code by name. The plan's citations have moved
since approval. The current locations are in the table below.

### What to build

**The failure, reproduced on `develop`.** Loader options reach TypeScript with their option names unconverted.
`createOptions` spreads the loader's `tsConfig` into `cliArgs.options` unchanged (`packages/webpack/src/options.ts:51`),
returns the same object as `tsConfig` (`:90`), and merges an inline `config` unconverted (`:66`). Only profiles read
from a file go through `convertEnumOptions` (`packages/core/src/compiler/config/resolve-compiler-config.ts:82`, called
at `:195`). The following were checked while writing this brief, by running `createOptions` +
`ResolvedCompilerOptions` and `TsCompiler.build` directly against `develop`:

- Loader option `tsConfig: { module: "NodeNext" }` gives `ResolvedCompilerOptions.tsConfig.module === "NodeNext"`
  and `cliArgs.options.module === "NodeNext"` (strings). The fast path compares `module` with
  `ts.ModuleKind.Node16`/`NodeNext` (`packages/core/src/compiler/Compiler.ts:1414`), so it takes plain
  `transpileModule` instead of `transpileNodeModule`. In a project whose `package.json` has `"type": "module"`,
  `build` emits **CommonJS** (`"use strict"; … exports.a = void 0;`). The same option as the number `199` emits
  `export const a = 1;`. This holds with `transpileOnly` both `true` and `false`. This is the red e2e.
- `tsConfig: { moduleResolution: "nope" }` and an inline profile's `target: "bogus"` pass through as strings with no
  diagnostic. The build succeeds, and the profile's `getOptions("inline").tsConfig.target` is `"bogus"`.
- A string `module` that reaches `ts.createProgram` throws `module is a string value; tsconfig JSON must be parsed
  with parseJsonSourceFileConfigFileContent …` (checked against TypeScript 5.7.3). The fast path hides this. An
  addon that needs type information does not.

**The top-level `profiles` loader option is dead end to end.** It is declared in
`packages/api/src/options/WebpackLoaderOptions.ts:27-30` with the doc comment "Profiles configuration from loader
options". It is not destructured by the webpack `createOptions` (`options.ts:16`) and is not in its result
(`:82-92`), so `resolveLoaderOptions` (`loader-options.ts:60-71`) drops it before core sees it. The run above
confirms that `"profiles" in createOptions(...)` is `false`. It is also stored, unread, in
`ResolvedCompilerOptions.profiles` (`ResolvedCompilerOptions.ts:107-108`, `:164`). A user who passes it gets no
error, and `profile: "x"` then fails as an unconfigured profile.

**Where the plan's citations are now:**

| Plan says | Now on `develop` |
|---|---|
| `convertEnumOptions`, `resolve-compiler-config.ts:81` | `:82` (doc `:78-81`); the 6046 constant `:75-76`; call `:195` (plan: `:186`) |
| `ResolvedCompilerOptions` "before `getTsConfig` (`:178`)" | `this.config` merged at `:178`; `resolveProfile` `:187`; `getTsConfig` `:189`; again in `getOptions(profile)` `:298` |
| `createOptions` reports to a `NoReporter` (`loader-options.ts:59`, `options.ts:15`) | `loader-options.ts:66` (`createOptions(options)` in `resolveLoaderOptions`), `options.ts:15` |
| inline `config.profiles` replaces file profiles (`options.ts:66`) | still `:66`, but see "Found while writing this brief" |
| `ResolvedCompilerOptions.ts:98`, `:154` (`profiles` field) | `:107-108`, `:164` |

**The work** (the plan's Design → Approach, "Convert names (item 2)" and "The top-level `profiles` loader option", is
the spec):

1. **Move, not copy.** Create `packages/core/src/compiler/config/convert-enum-options.ts` with `convertEnumOptions`
   and `TS_ERROR_CODE_INVALID_OPTION_VALUE` (keep the name and its comment). Delete both from
   `resolve-compiler-config.ts`, which then imports them. In `config/index.ts:7`, re-export the constant from the new
   module and add `convertEnumOptions`. Keep the exported name `TS_ERROR_CODE_INVALID_OPTION_VALUE` reachable from
   `./config`, so the import at `Compiler.ts:27` does not change. `config/index.ts` already reaches
   `@quatico/websmith-core` (`compiler/index.ts:17`, `src/index.ts:7`). The existing file-profile tests
   (`resolve-compiler-config.spec.ts:330-380`, `:453-459`) stay green and unchanged. They prove the move is neutral.
2. **Make the location a parameter.** Today the message is built from `name` and `configFilePath`. The plan names
   three wordings in the #131 format. Each is followed by TypeScript's flattened message, as today:
   - file profile: `Invalid 'tsConfig.module' value 'x' in profile 'p' of '<configFile>'.` (unchanged)
   - inline profile: `Invalid 'tsConfig.module' value 'x' in profile 'p' of the loader options.`
   - loader-option `tsConfig`: `Invalid 'tsConfig.module' value 'x' in the loader options.`

   A signature such as `convertEnumOptions(tsConfig, location, reporter?)` serves all three. Here `location` is the
   phrase after the value (`in profile 'p' of '<file>'`, `in profile 'p' of the loader options`,
   `in the loader options`). Keep it **one** function.
3. **Idempotent.** It already passes non-strings through (`:85-87`). Pin that in a test: converting the output again
   gives the same object and reports nothing. File profiles will now pass through it twice (step 4).
4. **Apply it in `ResolvedCompilerOptions`**, between `this.config = deepmerge(...)` (`:178`) and `getTsConfig`
   (`:189`), with `this.reporter`. In the loader, that is the collecting `ConfigErrorReporter`
   (`TsCompiler.ts:91`, `:173-177`):
   - on each profile's `tsConfig` of the merged `this.config.profiles`. `getOptions(profile)` (`:298`) reads
     `this.config`, so converting it in place covers every profile lookup;
   - on the loader-option `tsConfig`, which by then is **both** `resolvedOptions.tsConfig` and
     `resolvedOptions.cliArgs.options`. See "Found while writing this brief". Report each bad key once.
5. **`createOptions` does not convert.** Its reporter is a `NoReporter`, and errors raised there are lost (panel
   loader-config finding 2).
6. **Remove `profiles`** from `WebpackLoaderOptions`. A loader options object that still carries it gets a config
   error: `'profiles' is not a loader option; use 'config.profiles'.`, reported through `this.reporter`, once per
   options resolution. Because the webpack `createOptions` drops the key today, it has to pass the key's
   **presence** through for core to see it (see "Found while writing this brief").
7. **Docs.** In `packages/webpack/README.md`, under "Loader Options" (`:61-69`): `tsConfig` and `config.profiles`
   accept option names as `tsconfig.json` does, and unknown names are configuration errors. Add one line saying
   that a top-level `profiles` is an error and that profiles belong in `config.profiles`. The README never listed
   `profiles` as an option, so there is no line to delete.

The plan is canonical. This brief is orientation.

### Settled decisions — do not re-derive them

- **Convert in core's `ResolvedCompilerOptions`, not in `createOptions`.** The draft converted in the webpack
  `createOptions`. The loader-config juror showed that it reports to the default `NoReporter`
  (`options.ts:15`, `loader-options.ts:66`), so the "unknown names are config errors" half would be lost. The
  downstream juror wanted `resolveCompilerOptions`, which is the same direction and the same object (panel "Where they
  differ", item 1; Open Point "`convertEnumOptions` location", decided). Do not add a second conversion in
  `packages/webpack`.
- **Own module, exported from `@quatico/websmith-core`.** #135 (Open Point "Helper home", decided) and #134 agreed
  that this slice owns the move and that `bug/profile-lib-names` builds on it afterwards. One owner avoids two plans
  rewriting the same function in parallel. Do not add the `lib` array handling here.
- **Convert the merged config.** An inline profile and a file profile with the same name are merged. Converting only
  the loader's `config.profiles` would miss inline values that override converted file values.
- **File profiles keep their conversion and wording.** They are still converted in `resolveCompilationConfig` with
  the file path. Values the first pass converted are numbers, and the second pass passes them through, so nothing is
  reported twice.
- **Remove `profiles` and report it as an error. Do not deprecate it.** The panel recommended an error plus a
  deprecation note, while the plan chose removal plus an error, with a **Breaking** line (Open Point "Top-level
  `profiles` loader option", decided). The option has been ignored since `2c7aab3a`. Wiring it through would
  duplicate `config.profiles`, and webpack configs are often untyped JavaScript, so removing the type alone stays
  silent.
- **The 6046 constant moves with the function.** #168 put it at `resolve-compiler-config.ts:75-76` for exactly this
  move (`.plot/briefs/option-enum-tables.md`, item 4). Do not create a second constant.

### Found while writing this brief — the plan did not settle these

- **The loader's `tsConfig` lives in two places.** `createOptions` spreads it into `cliArgs.options` (`options.ts:51`)
  and returns that object as `tsConfig` (`:90`). Both are deep-merged into `resolvedOptions` (`:117-148`).
  `getTsConfig` lets the TSC keys of `cliArgs.options` "override everything" (`:341-351`, `:362`), and `this.tsConfig`
  is merged with `this.cliArgs.options` again at `:249`. `module`, `moduleResolution`, `target` and `jsx` are TSC
  keys (`packages/api/src/CompilerArguments.ts:34-35`, `:148`, `:156`). **If only `tsConfig` is converted, the
  string comes back from `cliArgs.options`.** Convert both, and report from one pass only. A test that counts
  reports must expect exactly one per bad key. On the CLI path, `cliArgs.options` comes from `parsedCommandLine` and
  is already numeric, so the pass changes nothing there.
- **Which inline profiles report.** The plan says "each profile's `tsConfig` of the merged config". The README says
  "Errors of profiles the build does not use are not reported" (`packages/webpack/README.md:95`), and
  `resolveCompilationConfig` follows that rule for files (`isUsed ? reporter : undefined`, `:195`). Use the same rule:
  report for the profiles in `getProfileClosure(profileName, this.config, …)`, and convert the others silently,
  dropping their unknown names as the file path does. Say so in the PR.
- **`options.ts:66` no longer decides the merge.** `createOptions` replaces file profiles with inline ones through
  `Object.assign`, but `ResolvedCompilerOptions` reads the file again (`loadCompilationConfig`, `:400-418`) and
  `deepmerge`s it with the loader's `config` (`:178`). The run above shows the file profile and the inline profile
  side by side in `this.config.profiles`. Once the file pass has run, every 6046 left in the merged config comes from
  an inline value, so "of the loader options" is the right wording. Do not change the merge here.
- **`profiles` must survive `createOptions` to be reported.** Recommended: when the raw options have an own
  `profiles` key, `createOptions` passes it through, and `ResolvedCompilerOptions` reports it when `loaderOptions`
  has it. Removing the type removes the field from `WebsmithLoaderConfig` too (`WebsmithLoaderConfig.ts:10`), so read
  it with an `in` check, not a cast. `getOptionsHash` (`loader-options.ts:73-84`) still hashes it, which is harmless.
- **`profiles` has a second, CLI-side copy.** `LoaderOptions.profiles` (`CompilerArguments.ts:230`) and
  `LOADER_OPTIONS_KEYS` (`:204`) are pinned by `CompilerArguments.spec.ts:66`, `:70` ("exactly 9") and `:99`. Core
  `createOptions` forwards the key (`packages/core/src/compiler/options/options.ts:31`, `:61`, test
  `options.spec.ts:317`) into the unread `ResolvedCompilerOptions.profiles`. No commander flag exists
  (`packages/compiler/src/command.ts:34-80`), so only programmatic callers reach it. Remove the field and the key in
  the same commit as the `WebpackLoaderOptions` removal, under the same Breaking line. This path gets no new error,
  since the plan's error is for loader options. If the reviewer objects, revert that commit alone.
- **There is no `--tsConfig` CLI flag.** The plan's reason for converting in core says the CLI's `--tsConfig` JSON
  gains the same behaviour. What actually gains it is the programmatic `createOptions({ tsConfig })` /
  `resolveCompilerOptions` API that `@quatico/websmith-compiler` exports (`packages/compiler/src/index.ts:8`). Add one
  core unit test for that path, and no CLI e2e.

### Done when

The plan's slice line is the specification. These are the assertions a naive implementation would pass without:

- **e2e, `module: "NodeNext"` as a loader option takes the nodenext path:** a project with `"type": "module"`
  emits `export`, not `exports.` (red on `develop`, as shown above). Asserting only that the build passes is green
  today.
- **e2e, `module: "nope"`:** the build fails, and `countOf(output, "Invalid 'tsConfig.module' value 'nope' in the
  loader options")` is **1** over several modules. Use the `countOf` pattern in
  `packages/webpack-test/tests/webpack-profile-config.test.ts:55-61`.
- **e2e, a loader with a top-level `profiles`:** the build fails once with `use 'config.profiles'`.
- **Unit, `ResolvedCompilerOptions.spec.ts`:** a loader `tsConfig` name is a number in **`tsConfig` and in
  `cliArgs.options`**, and in `getOptions(profile).tsConfig`. An inline profile overriding a converted file profile
  of the same name ends up numeric. A bad inline key in a profile outside the selected closure is dropped and not
  reported.
- **Unit, `convert-enum-options.spec.ts`:** the three wordings; idempotence (converting the output again gives an
  equal result and no report); numbers and non-enum strings such as `outDir` pass through; no reporter means
  silently dropped.
- **Unit, `options.spec.ts` (webpack):** `createOptions` does not convert, and it passes the presence of `profiles`
  through.
- **No message hard-codes TypeScript's value list.** It differs between 5.x and 6.x. Build the expected text with
  `ts.flattenDiagnosticMessageText` from the installed TypeScript, or match the websmith prefix. (The existing
  assertion at `resolve-compiler-config.spec.ts:371` is already 5.x-only. Leave it as it is.)

Also:

- **Gates, all green:** `pnpm lint`, `pnpm build`, `pnpm test --skip-nx-cache`, `pnpm test:e2e --skip-nx-cache`.
- **`Release-Notes.md`**, under `## [Unreleased]`:
  - `### Fixed`: "Loader-option `tsConfig` and inline `config.profiles` accept option names such as
    `module: "NodeNext"`, as `tsconfig.json` does, and report unknown names as configuration errors."
  - `### Removed`, replacing its `TBA` (`Release-Notes.md:124-126`): a **Breaking:** line saying that the top-level
    `profiles` loader option is removed from `WebpackLoaderOptions` (and from `LoaderOptions`, if you take that
    commit), and that passing it fails the build with a configuration error pointing to `config.profiles`.
- **README:** `packages/webpack/README.md`, as in step 7.
- **Tests follow `docs/rules/testing.md`:** assemble / act / assert with no part comments, `testObj` and `actual`,
  no shared `testObj`.
- **New files carry the MIT license header** (`pnpm license:add`). Do not add them to the `license:check` list.

### What #135 needs from the moved module

`bug/profile-lib-names` extends this module (its plan, Design → "Profile `lib`", and the slice line `:210`). Leave it:

- **One exported function in `convert-enum-options.ts`**, the only conversion in the codebase. The new
  `ResolvedCompilerOptions` call sites go through it, so `lib` conversion reaches loader options with no further
  wiring. The panel asked for exactly that (loader-config verdict, "`lib: ["ES2022"]` in loader-option `tsConfig`
  works too").
- **A per-key structure that an array branch fits into.** Today only `typeof value === "string"` reaches
  `ts.convertCompilerOptionsFromJson` (`:85-88`). #135 adds an allow-list `["lib"]` that converts entry by entry,
  keeps `lib.*.d.ts` entries, and drops unknown ones with the same 6046 message. Keep array values passing through
  untouched here.
- **Idempotence as a tested contract.** File profiles now pass through the function twice, so #135's
  `lib.*.d.ts` rule depends on it. Its "already-converted" unit test goes into your `convert-enum-options.spec.ts`.
- **The location parameter and the 6046 constant beside the function.** #135's message for an unknown `lib` entry
  reuses both.
- Name the final signature in the PR description, so that #135's brief can cite it.

### Repo mechanics

- **pnpm 10** from `$HOME/.nvm/versions/node/v22.17.0/bin`: put it first on `PATH`. The Homebrew pnpm 11 fails with
  E401.
- **Installs:** `pnpm install --offline`. The Artifactory login in `~/.npmrc` is expired. **Never edit `~/.npmrc`.**
  If a registry package is unavoidable, use an empty file as `NPM_CONFIG_USERCONFIG` plus
  `--config.registry=https://registry.npmjs.org/`. This branch needs no new package.
- **Node 24** is at `$HOME/.nvm/versions/node/v24.21.0/bin/node`, for runtime checks.
- **Commits:** Arlo's notation without a colon (`commit-notation` skill). For example,
  `r Moves convertEnumOptions into its own core module`,
  `B Converts option names of loader tsConfig and inline profiles` and
  `B!! Rejects the top-level profiles loader option`.
- **Deleting files:** use `trash`, never `rm`.

### Bookkeeping

- Push the first real commit (the move, green) as soon as it exists.
- Open the PR with `plot-open-pr.sh`, never `gh pr create`. Then give it a descriptive title.
- Append `→ #<number>` to the `bug/loader-tsconfig-enum-options` line in the plan's `## Slices`
  (`docs/plans/2026-10-02-loader-options-once.md:250`, before its `<!-- builds: -->` comment) and commit that on this
  branch.

### Scope guard

This branch owns:

- `packages/core/src/compiler/config/convert-enum-options.ts` and its spec (new), its lines in `config/index.ts`, and
  the removal from `resolve-compiler-config.ts`;
- `packages/core/src/compiler/options/ResolvedCompilerOptions.ts` (the conversion, the `profiles` report, and removing
  the `profiles` field) and its spec;
- `packages/webpack/src/options.ts` (passing on the presence of `profiles`) and `options.spec.ts`;
- `packages/api/src/options/WebpackLoaderOptions.ts`, plus `CompilerArguments.ts`/`.spec.ts` and core
  `options/options.ts`/`.spec.ts` if you take the `LoaderOptions` commit;
- the e2e cases in `packages/webpack-test/tests` (prefer `webpack-profile-config.test.ts` or a new file; no snapshot
  changes);
- `Release-Notes.md`, `packages/webpack/README.md`, and the `→ #<PR>` line in the plan.

Do not touch:

- `packages/core/src/compiler/Compiler.ts`. The `./config` re-export keeps its import (`:27`) and its 6046 use
  (`:1425`) working unchanged;
- `packages/webpack/src/TsCompiler.ts`, `compiler-instances.ts`, `webpack-hooks.ts`, `loader.ts`,
  `loader-options.ts`;
- `getFragmentProfile`, `resolve-profile.ts` and the profile validation (`bug/loader-unknown-profile-error`);
- the `lib` array conversion (#135's `bug/profile-lib-names`);
- `package.json` files, `pnpm-lock.yaml`, tsconfigs, `.github/`, webpack-test snapshots.

In flight or starting now, checked against their plans and briefs on `develop`:

- **`feature/neutral-module-compiler`** (`docs/plans/2026-10-01-vite-plugin.md`, #132;
  `.plot/briefs/neutral-module-compiler.md`). It extracts the loader's per-module compile from `TsCompiler.ts` into a
  core `ModuleCompiler`, including `ConfigErrorReporter` (`TsCompiler.ts:91-129`), and adds export lines to
  `packages/core/src/compiler/index.ts`. Its brief marks `options.ts`, `loader-options.ts`, `ResolvedCompilerOptions.ts`,
  `packages/api`, READMEs and `Release-Notes.md` as off-limits to it, and says this slice "may start earlier … if one
  of them lands first, rebase onto it". **No file collision** while you stay out of `TsCompiler.ts` and
  `compiler/index.ts`, because your export goes into `config/index.ts`. **Behavioural:** your config errors reach
  webpack through `ConfigErrorReporter`. If the extraction lands first, check that the collected errors still
  surface with the e2e counts above.
- **`infra/fix-transitive-alerts`** (`docs/plans/2026-10-01-dependency-updates.md`). It changes `pnpm-lock.yaml` and
  the manifests and bumps webpack to `^5.104.1`. **No file collision.** **Behavioural:** a new webpack can shift
  `packages/webpack-test` output. If it merges first, rebase and re-run the e2e suite before you attribute a red e2e
  to your change.
- **PR #171 `infra/typescript-6-ci-leg`** edits `.github/workflows/pull-request.yml`, the TS 6 plan and
  `docs/rules/workflow.md`. **No file collision.** Once it merges, an advisory TS 6.0.3 cell compiles and tests your
  code. That is why no new assertion may hard-code TypeScript's 6046 value list. Say in the PR whether that cell was
  red before your change.
- **`bug/fast-path-dts-js-syntax-errors`** (`docs/plans/2026-10-02-cli-error-exit-gaps.md:201`, starting with you).
  It edits the `Compiler.ts` fast path (`:1411-1440`, which holds the `TS_ERROR_CODE_INVALID_OPTION_VALUE` filter at
  `:1425`), `Compiler.spec.ts`, `bin.test.ts` and `Release-Notes.md`. **Collision:** `Release-Notes.md`. Both of
  you add a `### Fixed` entry; it is append-only, so rebase and keep both. **No `Compiler.ts` collision** as long as
  the constant stays exported from `./config` under its name. Renaming or moving the export path would force an edit
  in their region.

The later #134 slices, `bug/loader-unknown-profile-error` (core option resolution in `ResolvedCompilerOptions.ts`,
after `resolveProfile`, `:187`) and `bug/loader-option-errors-once`, have no branches yet. Keep your
`ResolvedCompilerOptions.ts` diff between `:178` and `:189` and in the `profiles` field, so they rebase cleanly.

If you find something the plan did not anticipate beyond the items above, report it rather than improvising outside
scope.
