<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — loader-options-once (slice: Unconfigured profile)

- **Plan (canonical):** `docs/plans/2026-10-02-loader-options-once.md` on `develop`
- **Approved:** 2026-10-02, Jan Wloka, plan-PR #134 merged
- **Branch:** `bug/loader-unknown-profile-error` (base: `develop`, at `fa114cbe` when this brief was written)
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh` (on PATH). Do not merge it yourself.
- **Review of the code:** an independent review, plus uncached gates run by the maintainer's session before merge

**Ordering.** The slice line carries `<!-- waits: bug/depends-closure-core -->`
(`docs/plans/2026-10-02-loader-options-once.md:251`). That branch merged as #172 and added `getProfileClosure`
(`packages/core/src/compiler/config/profile-closure.ts:26-58`), which returns the `depends` targets that are not
configured in `missing` instead of dropping them, for this slice to report. So this slice can start now. No slice
waits on this one.

Line numbers are from `develop` at `fa114cbe`. If they move, find the code by name.

### What changed on `develop` since the plan

Since the plan was written, #165 (resolve once), #172 (`getProfileClosure`), #177 (enum names in
`ResolvedCompilerOptions`), #174 (neutral `ModuleCompiler`), #180, #181 (option errors once) and #182 (Vite plugin
tracer) have merged.

| Plan says | Now on `develop` |
|---|---|
| `getFragmentProfile` only warns (`TsCompiler.ts:362-368`) | `packages/webpack/src/TsCompiler.ts:143-150`, called through the `checkProfile` override (`:103-105`) from the constructor (`:58-61`) and from `ModuleCompiler.updateLoaderConfig` (`packages/core/src/compiler/ModuleCompiler.ts:242`). It warns through `loaderOptions.warn` (`:54`), which is a no-op unless the user passes `warn`, so in practice it prints nothing. |
| `createOptions` resolves the profile with a `NoReporter` (`options.ts:89`) | Unchanged: `packages/webpack/src/options.ts:89`. The profile the build uses is resolved again in core, `ResolvedCompilerOptions.ts:196`, with the collecting `ConfigErrorReporter` (`ModuleCompiler.ts:97-135`) |
| `resolveProfile` returns early on `!config` (`resolve-profile.ts:9-24`) | Same file and lines. In `ResolvedCompilerOptions` the early return never fires: `this.config` is always an object (`:180`). It reports a **`WarnMessage`** (`resolve-profile.ts:20`). `ConfigErrorReporter` collects errors only (`ModuleCompiler.ts:117`), so the warning goes to the `DefaultReporter` and is printed to the console, outside webpack's stats. |
| `emitSourceFile` throws `No profile with name "x" configured.` (`Compiler.ts:571`) | `packages/core/src/compiler/Compiler.ts:576`, reached from `ModuleCompiler.build`'s target emit (`ModuleCompiler.ts:384`) |
| `Unknown profile 'x' in 'depends'` reported by `resolveCompilationConfig` | `packages/core/src/compiler/config/resolve-compiler-config.ts:159-165`, for profiles of the **file** in the selected closure only. Profiles from the loader's inline `config.profiles` are not checked at all. |
| Config errors reported once (#131) | #181: `getConfigErrors()` (`ModuleCompiler.ts:208-211`) is reported once per compilation by `afterCompile` (`packages/webpack/src/webpack-hooks.ts:49-69`, dedup set `:58-68`), keyed by the formatted message; without compiler hooks the loader calls `takeUnreportedConfigErrors(resourcePath)` (`ModuleCompiler.ts:218-230`, `loader.ts:42-44`), which keeps one carrier module per error. Both are cleared only by a new option resolution (`setOptions`, `ModuleCompiler.ts:194-202`). |
| (not in the plan) | #182 added a second `ModuleCompiler` host, the Vite plugin (`packages/vite/src/plugin.ts`). It reports `getConfigErrors()` in `buildEnd`, and its `transform` returns `null` when the fragment has no JavaScript. It does not override `checkProfile`. |

**Reproduced on `fa114cbe`** (built loader, Node 22, a `webpack-profile-config.test.ts`-style script spawning webpack
with `transpileOnly: true`; `src/index.ts` re-exports `hello.ts` and `other.ts`):

| Case | Printed today (exit code) | The slice must print |
|---|---|---|
| `profile: "missing"`, config `{ profiles: { a, b } }` | `[WARN] Missing profile: The following profile is passed but not configured "missing".` on the console, then `ERROR in ./src/index.ts` / `Module build failed (from …/webpack/lib/index.js):` / `Error: No profile with name "missing" configured.` with a 5-frame stack (`Compiler.emitSourceFile` … `loader`). Exit 1 | one `ERROR in Profile 'missing' is not configured in '<dir>/websmith.config.json'. Available profiles: a, b.`; no `Module build failed`, no stack, no console warning. Exit 1 |
| same, two entries `hello.ts` and `other.ts` | the stack trace **twice**, `webpack compiled with 2 errors`. Exit 1 | the error **once** |
| same under `thread-loader` (`workers: 1`) | `Thread Loader (Worker 0)` / `No profile with name "missing" configured.` with the stack. Exit 1 | the error once, on the carrier module |
| `profile: "missing"`, no `configFile` | the console warning and the stack trace. Exit 1 | `Profile 'missing' is passed but no websmith.config.json was found.` once. Exit 1 |
| `profile: "valid"`, `configFile` that does not exist | `ERROR in No configuration file found at "<dir>/websmith.config.json".` **and** the stack trace for `"valid"`. Exit 1 | the `No configuration file found` error and `Profile 'valid' is passed but no websmith.config.json was found.`, each once. Exit 1 |
| `profile: "missing"`, config `{}` (no `profiles` key) | the console warning and the stack trace. Exit 1 | `Profile 'missing' is not configured in '<dir>/websmith.config.json'. Available profiles: none.` once |
| `profile: "missing"`, no config file, inline `config: { profiles: { a } }` | the console warning and the stack trace. Exit 1 | `Profile 'missing' is not configured in the loader options. Available profiles: a.` once |
| `profile: "a"`, config `{ profiles: { a: { depends: ["nope"] } } }` | `ERROR in Unknown profile 'nope' in 'depends' of '<dir>/websmith.config.json'.` once. Exit 1 (already right) | `Unknown profile 'nope' in 'depends' of '<dir>/websmith.config.json'. Available profiles: a.` once |
| `profile: "a"`, no config file, inline `config: { profiles: { a: { depends: ["nope"] } } }` | **nothing**, `webpack compiled successfully`, exit 0 | `Unknown profile 'nope' in 'depends' of the loader options. Available profiles: a.` once. Exit 1 |

The CLI on the same `fa114cbe` build (`node packages/compiler/lib/bin.js -p tsconfig.json …`):
`--profile missing` with or without `--configFile` prints only the `[WARN] Missing profile: …` line, **writes no
output and exits 0**. `--profile a --configFile ./missing.json` prints `No configuration file found …` and the same
warning, exit 1.

### The work

The plan's Design → "Unconfigured profile (item 7)" is the spec: profile validation moves into core option
resolution as a configuration error, reported once, and modules fail with that error instead of the thrown `Error`.

**How the error travels (settled here).** As a configuration error collected during option resolution, i.e. through
#181's path, not as a module diagnostic. `ResolvedCompilerOptions` reports an `ErrorMessage` to `this.reporter`, which
is the collecting `ConfigErrorReporter` in every `ModuleCompiler` host. From there `getConfigErrors()` carries it: once
per compilation through `afterCompile` (also across two loader rules, since the key is the formatted message), once
per worker on a carrier module without hooks, and in the Vite plugin's `buildEnd`. It lives until the next option
resolution, so a watch rebuild keeps failing until `websmith.config.json` is fixed, and the edit rebuilds the modules
(the config file is a module dependency since #165). `bug/loader-cached-config-errors` later carries all config
errors through the persistent cache, this one included, with no extra work. Rejected: emitting it per module from
`build` (N copies, the bug itself), keeping the throw (stack trace), a separate profile-error channel in the loader
(a second dedup next to #181's, and the Vite plugin would need it too).

1. **One validator in core.** Replace `resolveProfile` (`packages/core/src/compiler/config/resolve-profile.ts:9-24`)
   with `validateProfile(name, config, location, reporter): void` in the same file, exported from `config/index.ts`
   (`:10`) instead of `resolveProfile`. It reports `ErrorMessage`s (code 0, no file) in the #131 format, `available`
   being `Object.keys(config.profiles ?? {})` in config order joined with `, `, or `none`:
   - no `name`: nothing;
   - no profiles and no `location` (no readable config file, no inline profiles):
     `Profile '<name>' is passed but no websmith.config.json was found.`;
   - `name` not configured: `Profile '<name>' is not configured in <location>. Available profiles: <available>.`;
   - every `missing` entry of `getProfileClosure(name, config, "dependents-first")`:
     `Unknown profile '<dep>' in 'depends' of <location>. Available profiles: <available>.`

   `location` is `'<configFile>'` (quoted, the path `ResolvedCompilerOptions` resolved, `this.configFile`) when that
   file exists, else `the loader options` when the merged config has profiles (inline `config.profiles`, the #177
   wording), else `undefined`.
2. **Call it in `ResolvedCompilerOptions`** (`packages/core/src/compiler/options/ResolvedCompilerOptions.ts:196`):
   `this.profile = profileName;` then `validateProfile(profileName, this.config, location, this.reporter)`. The profile
   name stays set even when it is unknown: `ModuleCompiler` needs it to skip the emit (step 4). Remove the
   `resolveProfile` import (`:28`). Keep your diff in this file to `:183-198` and the import.
3. **Move the `depends` report.** Delete `resolve-compiler-config.ts:159-165`; the validator now reports missing
   targets for file and inline profiles alike. `resolveCompilationConfig` keeps its closure (`:153`) for the `esm` and
   enum checks. The four specs that pin the report there (`resolve-compiler-config.spec.ts:147`, `:176`, `:447`,
   `:584`) move to the validator's spec with the new wording. The error now comes after a profile's `esm` and enum
   errors, because those are reported while the file is read (`ResolvedCompilerOptions.ts:118`) and the validator runs
   later. Update the order in `TsCompiler.spec.ts:533-536`, and the texts in `ModuleCompiler.spec.ts:246`, `:258`.
4. **Skip the emit in core.** Add `public isProfileConfigured(): boolean` to `ModuleCompiler`: true without a profile
   or when `Object.hasOwn(this.getOptions().config?.profiles ?? {}, this.profile)`. In `build`
   (`ModuleCompiler.ts:327`), return right after the `onDependency` setup (`:350`) and before the dependent-profile
   loop (`:352`) when it is false: `{ fragment: { version: 0, files: [], writtenFiles: [] }, diagnostics: [],
   dependencies: { files: [], missing: [] } }`. No addon setup, no emit, so `Compiler.ts:576` is not reached. Update
   the class comment (`:136-143`) with the contract: a host finishes such a module without output; the config error
   fails the build. The Vite plugin needs no change: its `transform` returns `null` for a fragment without JavaScript
   and `buildEnd` raises the config error.
5. **Remove the profile hook.** Delete `checkProfile` from `ModuleCompiler` (`:434-437`) and its override plus
   `getFragmentProfile` from `TsCompiler` (`:103-105`, `:143-150`), and the constructor block that calls it
   (`TsCompiler.ts:58-61`). `updateLoaderConfig` sets `this.profile = profileName || undefined` (`ModuleCompiler.ts:242`),
   and the comment at `:174` no longer points to `checkProfile`. No other implementer exists (Vite does not override it).
6. **Finish the module in the loader.** In `packages/webpack/src/loader.ts`, after the no-hooks reporting (`:42-44`)
   and before `this.version = fragment.version` (`:48`): when `!instance.isProfileConfigured()`, call
   `this.callback(null, "")` and return. The options files are already registered as dependencies (`:37-39`), so
   fixing the profile rebuilds the module. Without this, `processResultAndFinish` reports
   `No processed output found for "<file>" with profile "missing"` on every module
   (`packages/webpack/src/result-handling.ts:396-398`). Add `isProfileConfigured: () => true` to the instance stub of
   `setUpLoader` (`loader.spec.ts:367-376`).
7. **`createOptions`.** `packages/webpack/src/options.ts:89` passes `profile` through as is (with a `NoReporter`,
   `resolveProfile` returned it unchanged anyway); drop the import (`:8`). Core validates.
8. **Docs and release notes**, see below.

### Settled decisions — do not re-derive them

- **Severity: error.** The plan says "config error". The old warning came from a time when an unknown profile still
  built; today it throws in the loader and writes nothing in the CLI.
- **The CLI gets the same error and exits 1.** `ResolvedCompilerOptions` is shared, and the plan places the validation
  there. The CLI reports it through its reporter, and `command.ts:170` sets exit code 1 on any reported error. No CLI
  code changes. Today the CLI warns, writes nothing and exits 0, so no working build breaks. The plan's boundary ("the
  CLI's handling of the same throw stays with #136") has nothing left to cover: the CLI never reaches the throw, and
  `docs/plans/2026-10-02-cli-error-exit-gaps.md` has no slice for it. Name the exit-code change in the PR and in
  `Release-Notes.md`.
- **`depends` targets through the closure.** The plan: "The validation walks the unified closure, so a missing
  `depends` target is the same error". The #172 brief assigns the `Unknown profile … in 'depends'` report to this
  slice. Moving it covers inline `config.profiles` (the silent exit 0 above) and leaves one place that reports it. The
  wording stays recognisable (`Unknown profile 'x' in 'depends'` still matches the e2e `countOf` at
  `webpack-profile-config.test.ts:59`, `:75`), plus the available profiles the slice line asks for.
- **`checkProfile` goes.** The plan only says "`getFragmentProfile` removed". Once validation is in option resolution
  the hook validates nothing, and keeping an empty protected hook in a class Vite now subclasses invites a second
  validation path.
- **Not this slice:** cycles (no slice names a cycle error; #172 made them stop silently), the persistent cache
  (`bug/loader-cached-config-errors`), and `reportMissingAddons` warnings (unchanged).

### Found while writing this brief — the plan did not settle these

- **Inline profiles.** The plan names only `'<configFile>'` and the no-config case. With a profile defined only in the
  loader's `config.profiles`, the location is `the loader options`, as #177 words it.
- **Config file without profiles** (`{}`): `… is not configured in '<configFile>'. Available profiles: none.` A missing
  config file gets both its existing `No configuration file found` error and the "no websmith.config.json was found"
  error. Both are true, and each is reported once.
- **The two existing e2e cases test a missing config file by accident.** `websmith-loader.test.ts:166-186`
  ("should throw error with transpileOnly false") and `:188-208` ("should throw error with unknown profile name")
  write the config with `writeWebsmithConfig(config)`, whose default directory is `test-output/`
  (`tests/test-files.ts:12`), but pass `configFile` in `testDirs.PROJECT_DIR`. Both build with a missing config file;
  that is why a **configured** profile `"valid"` throws in the first. Fix `:188-208` to write into
  `testDirs.PROJECT_DIR` and expect `Profile 'unknown' is not configured in '…websmith.config.json'. Available
  profiles: existing.`. Rename `:166-186` to what it tests ("should fail w/ profile and missing config file") and
  expect `Profile 'valid' is passed but no websmith.config.json was found.`. Assert with a RegExp. `WebpackBuild`
  rejects with the stats text.
- **The Vite plugin benefits without a change.** An unknown profile in Vite used to throw in `transform`. Now the
  module is left to Vite and `buildEnd` fails the build with the config error. Covered by the core unit test; no Vite
  e2e here (the plugin's own e2e is `packages/vite-test`, out of this slice).

### Tests

**Unit, core.**

- New `packages/core/src/compiler/config/resolve-profile.spec.ts` (red first: `validateProfile` does not exist): no
  name; unknown name with profiles in a file (message, `Available profiles: a, b.` in config order); with no
  profiles key (`none`); no location (the "no websmith.config.json" text); inline location; a missing `depends` target
  two levels down (`a → b → nope`) reported once; a known profile with known `depends` reports nothing. Use
  `jest.fn()` on a `NoReporter` and compare `ErrorMessage`s, as `resolve-compiler-config.spec.ts:147` does.
- `ResolvedCompilerOptions.spec.ts`, `describe("profile")` (`:662-690`): the unknown profile is reported as an
  `ErrorMessage` and `testObj.profile` still holds the name; an inline `config.profiles` with a missing `depends`
  target is reported (fails before); no report for a configured profile.
- `resolve-compiler-config.spec.ts`: the four cases at `:147`, `:176`, `:447`, `:584` assert that the file reader no
  longer reports `depends`; their coverage moves to the two specs above.
- `ModuleCompiler.spec.ts`, a new `describe("ModuleCompiler unconfigured profile")` (the project helper of
  `describe("ModuleCompiler options")`, `:226-237`, is the model): `build` with `profile: "missing"` returns no files
  and no diagnostics and does not throw (fails before: throws `No profile with name`); `getConfigErrors()` holds the
  one profile error; `isProfileConfigured()` is false, and true again after `updateLoaderConfig` with a config that
  defines the profile, with `getConfigErrors()` then empty; `takeUnreportedConfigErrors` gives it to the first module
  only.

**Unit, webpack.**

- `TsCompiler.spec.ts`, `describe("TsCompiler config errors")` (`:528`): an unknown profile yields the config error
  and no `warn` call (the `getFragmentProfile` warning is gone); the order fix at `:533-536`.
- `loader.spec.ts` (`describe("loader")`, `:395`): with `isProfileConfigured: () => false` the loader calls
  `callback(null, "")`, emits no error on the module with compilation hooks, still adds the options files as
  dependencies, and without hooks emits the carrier's config errors.
- `packages/compiler/src/command.spec.ts:558-576` and `:614-638`: the `WarnMessage` expectations become the new
  `ErrorMessage`s (`:636` is a profile without config file).

**E2E, `packages/webpack-test/tests`.** A new file, e.g. `webpack-loader-unknown-profile.test.ts`. Copy `runWebpack`
and `countOf` from `webpack-profile-config.test.ts:85-131`, and let `configFile`, `entry` and `config` be optional.
Use two entries (`hello.ts`, `other.ts`), so "once" is visible. Each case is red on `develop`; run it there first.

- `profile: "missing"` with `{ profiles: { a, b } }`: exit 1, `countOf(output, "Profile 'missing' is not configured
  in")` is **1** (today: 0, and two `No profile with name`), output contains `Available profiles: a, b.`, and no
  `Module build failed`;
- `profile: "missing"` without `configFile`: exit 1, `Profile 'missing' is passed but no websmith.config.json was
  found.` once (the plan's second e2e);
- `thread-loader` with `workers: 1`, `profile: "missing"`: **1**;
- inline `config: { profiles: { a: { depends: ["nope"] } } }`, `profile: "a"`, no `configFile`: exit 1 and
  `Unknown profile 'nope' in 'depends' of the loader options` once (today: exit 0).

Plus the two fixed cases in `websmith-loader.test.ts` (see above).

**E2E, CLI behaviour, `packages/compiler-test/tests`.** A new file, e.g. `profile-errors.test.ts`. Resolve the options
as the command does and compile, as `tsc-lib.test.ts:65-70` does (`createOptions(args, new NoReporter(), ts.sys)`, then
`new Compiler({ ...options, reporter }, {}, ts.sys).compile()`), with a `jest.fn()` reporter: `profile: "missing"`
with a config file reports `Profile 'missing' is not configured in …` exactly once as an error, and writes nothing.
Do not add to `packages/compiler/src/bin.test.ts`: two parallel branches edit it (see Scope guard).

### Release notes and docs

- `Release-Notes.md`, `## [Unreleased]` (`:13`) → `### Fixed` (`:106`), one bullet, e.g.: "An unconfigured `profile`
  fails a webpack loader build with one configuration error that names the available profiles, e.g. `Profile 'x' is
  not configured in '<configFile>'. Available profiles: a, b.`, instead of a `Module build failed` stack trace per
  module; without a configuration file the error is `Profile 'x' is passed but no websmith.config.json was found.`. A
  `depends` target missing from the loader's `config.profiles` is a configuration error too, and the `depends` error
  names the available profiles. The CLI reports the same errors and exits 1; before, `websmith --profile <unknown>`
  warned `Missing profile: …`, wrote nothing and exited 0."
- `packages/webpack/README.md:78` (`profile` option): "A name that is not configured is a configuration error." Add
  "an unconfigured `profile`" to the examples at `:99-101`.
- `packages/compiler/README.md:80` (`--profile`): "An unknown name is a configuration error: websmith reports it and
  exits 1."

### Done when

The plan's slice line is the specification. These are the assertions a naive implementation would pass without:

- **Two entries, one error**, with compiler hooks and with `thread-loader`. A one-entry test cannot tell "once" from
  "per module", because webpack stops at the failed entry.
- **No `Module build failed` and no `No processed output found`.** Turning the throw into an empty fragment without
  step 6 trades one per-module error for another.
- **The inline `depends` case fails the build.** It exits 0 today.
- **No `[WARN] Missing profile` on the console.** The old warning went to the `DefaultReporter`, outside webpack.
- **A configured profile builds as before**, and `webpack-profile-config.test.ts` stays green unchanged (its
  `countOf` substrings still match).
- **Fixing the config under watch clears the error:** covered by the `updateLoaderConfig` unit case. The options files
  stay module dependencies on the skip path (step 6).
- **Gates, all green:** `pnpm lint`, `pnpm build`, `pnpm test --skip-nx-cache`, `pnpm test:e2e --skip-nx-cache`. Say
  in the PR whether the advisory TS 6.0.3 cell is green.
- **Tests follow `docs/rules/testing.md`:** assemble / act / assert with no part comments, `testObj` and `actual`,
  no shared `testObj`. New files carry the MIT header (`pnpm license:add`). Do not add them to the `license:check`
  list.
- The PR states the decisions above: error severity, the CLI exit code, the moved `depends` report and its order, the
  inline-profile wording, and the removed `checkProfile`.

### Repo mechanics

- **pnpm 10** from `$HOME/.nvm/versions/node/v22.17.0/bin`: put it first on `PATH`. The Homebrew pnpm 11 fails with
  E401. Set `NX_DAEMON=false`.
- **Installs:** `pnpm install --frozen-lockfile --offline`. Never edit `~/.npmrc`. This branch needs no new package.
- **webpack-test e2e runs against the built packages:** run `pnpm build` before `pnpm test:e2e`.
- **Commits:** Arlo's notation without a colon (`commit-notation` skill), e.g.
  `B Reports an unconfigured profile as a configuration error`,
  `B Skips the emit of a module with an unconfigured profile`,
  `r Removes the profile check hook from ModuleCompiler`.
- **Deleting files:** use `trash`, never `rm`.

### Bookkeeping

- Push the first green commit as soon as it exists.
- Open the PR with `plot-open-pr.sh`, never `gh pr create`, then give it a descriptive title.
- Append `→ #<number>` to the `bug/loader-unknown-profile-error` line
  (`docs/plans/2026-10-02-loader-options-once.md:251`), before its `<!-- builds: -->` comment, and commit that on
  this branch.

### Scope guard

This branch owns:

- `packages/core/src/compiler/config/resolve-profile.ts`, a new `resolve-profile.spec.ts`, and the export line in
  `config/index.ts` (`:10`);
- `resolve-compiler-config.ts` `:159-165` (the `depends` report, removed) and the four cases of its spec named above;
- `ResolvedCompilerOptions.ts` `:28` and `:183-198`, and its spec's `describe("profile")`;
- `ModuleCompiler.ts`: `isProfileConfigured`, the early return at the top of `build` (above `:352`), `checkProfile`
  (`:434-437`), `:174`, `:242`, the class comment; `ModuleCompiler.spec.ts` (new describe, text updates at `:246`,
  `:258`);
- `packages/webpack/src/TsCompiler.ts` (`:58-61`, `:103-105`, `:143-150`), `loader.ts` (the skip after `:44`),
  `options.ts` (`:8`, `:89`), and their specs;
- `packages/compiler/src/command.spec.ts` (`:558-576`, `:614-638`, expectations only);
- the new webpack-test and compiler-test files, `websmith-loader.test.ts:166-208`;
- `Release-Notes.md`, `packages/webpack/README.md`, `packages/compiler/README.md`, and the `→ #<PR>` line in the plan.

Do not touch:

- `Compiler.ts`, the throw at `:576` included. It stays as a guard for callers that pass an unknown profile directly;
  after this slice no host reaches it;
- the dependent-profile loop in `build` (`ModuleCompiler.ts:352-370`) and `takeFileLessErrors`
  (`bug/loader-dependent-profile-diagnostics`);
- `loader.ts:40-44`, `webpack-hooks.ts`, and the carrier bookkeeping `takeUnreportedConfigErrors`
  (`bug/loader-cached-config-errors`);
- `ModuleBuildResult.dependencies` and the `package.json` handling (`bug/loader-package-type-deps`);
- `ResolvedCompilerOptions.ts` outside `:183-198` and the import, in particular `cliArgs` and `errors: []` (`:241-257`);
- `packages/vite`, `packages/vite-test`, `packages/node`, `packages/compiler/src/bin.test.ts`;
- `package.json` files, `pnpm-lock.yaml`, tsconfigs, `.github/`, webpack-test snapshots.

**Branches running at the same time**, checked against their plans and briefs on `develop`:

- **`bug/report-config-option-errors`** (`docs/plans/2026-10-02-cli-error-exit-gaps.md:193`; no brief on `develop`
  yet). It adds `configErrors` to `ResolvedCompilerOptions` from the tsconfig parse, replaces `errors: []` (`:250`),
  reports in `Compiler.compile()`/`watch()`, and adds `ResolvedCompilerOptions.spec.ts`, `Compiler.spec.ts` and
  `bin.test.ts` cases. **Shared file: `ResolvedCompilerOptions.ts` and its spec.** Your hunk (`:183-198`) and theirs
  (the field and `:219-257`) do not overlap. Add your spec cases inside `describe("profile")` only. The same rule
  applies to both slices: a configuration error makes the CLI exit 1. Their "every fixture before and after" run will
  see your CLI change only for an unknown `--profile`.
- **`bug/watch-generator-added-files`** (same plan, `:205`): `Compiler.ts` `registerWatch`, `CompilationContext.ts`,
  `bin.test.ts`. No shared file, because you stay out of `Compiler.ts` and `bin.test.ts`.
- **`bug/typescript-6-own-compilations`** (`docs/plans/2026-10-02-typescript-6-support.md:322`): `AddonRegistry.ts`,
  `WebpackAddonService.ts`, `environment.ts`, `check-esm.ts`, `Compiler.ts:802`, and compiler-test/webpack-test e2e
  for addon projects. No shared source file. If it adds cases to `websmith-loader.test.ts`, keep your edit to
  `:166-208`.
- **`bug/node-tsc-ignore-config`** (#184, `.plot/briefs/node-tsc-ignore-config.md`): `packages/node` only. No overlap.

All of them may append to `Release-Notes.md` `### Fixed`. The section is append-only: whoever merges second rebases
and keeps both bullets.

**Later slices of this plan**, which start after you or rebase on you:

- **`bug/loader-dependent-profile-diagnostics`** edits `build`'s dependent loop (`:352-370`). Your early return sits
  right above it: adjacent hunks, a textual rebase only.
- **`bug/loader-cached-config-errors`** edits `loader.ts:40-44` and the `setUpLoader` stub. Your skip comes after
  `:44`, and your stub adds one line. Adjacent, a textual rebase only.
- **`bug/loader-package-type-deps`** touches `build`'s dependencies and `webpack-hooks.ts`. The skip path returns no
  dependencies, which is correct: the module has no output whose format a `package.json` could change.

If you find something the plan did not anticipate beyond the items above, report it rather than improvising outside
scope.
