<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — loader-options-once (slice: Option errors once)

- **Plan (canonical):** `docs/plans/2026-10-02-loader-options-once.md` on `develop`
- **Approved:** 2026-10-02, Jan Wloka, plan-PR #134 merged
- **Branch:** `bug/loader-option-errors-once` (base: `develop`, at `ef29dce6` when this brief was written)
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh` (on PATH). Do not merge it yourself.
- **Review of the code:** an independent review, plus uncached gates run by the maintainer's session before merge

**Ordering.** The slice line carries `<!-- waits: bug/loader-resolve-options-once -->`
(`docs/plans/2026-10-02-loader-options-once.md:247`). That branch merged as #165, so this slice can start now. Three
branches wait on this one:

- `bug/loader-dependent-profile-diagnostics` (this plan, `:255`). It adds the dependent profiles' diagnostics to
  `build`, and their file-less ones must go through your dedup;
- `bug/report-config-option-errors` (`docs/plans/2026-10-02-cli-error-exit-gaps.md:193`);
- `bug/report-file-less-diagnostics` (`docs/plans/2026-10-02-cli-error-exit-gaps.md:197`). It stops dropping
  file-less diagnostics in the CLI `report()` and adds `getOptionsDiagnostics()` to the per-file declaration
  Programs, so the loader's declaration path starts returning file-less option errors too. That plan holds both of
  its reporting slices behind this one, "otherwise the webpack loader prints one option diagnostic per module".

Their other prerequisite, #135's "tsc defaults" slice, merged as #161. Once this slice merges, those two are
unblocked. `bug/profile-lib-names` (#135) may run in parallel with you; see Scope guard.

Line numbers are from `develop` at `ef29dce6`. If they move, find the code by name.

### What changed on `develop` since the plan

Since the plan was written, #165 (resolve once), #172 (`getProfileClosure`, `config/profile-closure.ts`), #177 (enum
conversion in `ResolvedCompilerOptions`) and #174 (neutral `ModuleCompiler`) have merged. #174 matters most here: the
per-module build left the webpack `TsCompiler` for core.

| Plan says | Now on `develop` |
|---|---|
| `build` returns `result.diagnostics` per module (`TsCompiler.ts:283`) | `ModuleCompiler.build`, `packages/core/src/compiler/ModuleCompiler.ts:286-354`; the target's diagnostics are pushed at `:345` and returned at `:353`. `TsCompiler.build` (`packages/webpack/src/TsCompiler.ts:70-80`) only maps the module type and calls `super.build` |
| the loader emits each on its module (`loader.ts:34`) | `packages/webpack/src/loader.ts:40` (`reportDiagnostics`, `:57-72`) |
| without hooks every config error on every module (`loader.ts:36-38`) | `loader.ts:41-44` |
| dedup in `afterCompile` (`webpack-hooks.ts:126-135`), `reportedConfigErrors` (`:19`) | `packages/webpack/src/webpack-hooks.ts:49-69`, dedup set `:58-68`, `reportedConfigErrors` `:16` |
| `useCompilationHooks` (`TsCompiler.ts:189`) | `ModuleCompiler.ts:247-253` (`useCompilationHooks` / `hasCompilationHooks`), called in `webpack-hooks.ts:48` |
| #130's file-less dedup in core `report` (`Compiler.ts:827`) | `Compiler.ts:664-685` (`report`), key `getDiagnosticKey` `:689-691`; the watch variant is `emitWatchedFile` `:838-852` with `reportedWatchDiagnostics` (`:120`, cleared `:304`, `:335`) |
| config errors collected by `ConfigErrorReporter` (`TsCompiler.ts:91-129`) | `ModuleCompiler.ts:95-133`; collected in `setOptions` (`:178-183`), read by `getConfigErrors` (`:186-189`) |

**The failure, by reading on `develop`.** On the fast path, every module goes through `ts.transpileModule(…,
{ reportDiagnostics: true })` or `transpileNodeModule` (`Compiler.ts:1418-1422`). The only filter is 6046 (`:1430`).
`transpileModule` adds `program.getOptionsDiagnostics()`, and those diagnostics have no `file`. Checked with
TypeScript 5.7.3: `{ module: CommonJS, moduleResolution: Bundler }` gives one file-less TS5095, and
`{ jsxFactory: "h", reactNamespace: "R" }` one file-less TS5053, for every file. `ModuleCompiler.build` returns them
in `diagnostics` (`:345`), and `loader.ts:40` emits each on its module. N modules give N copies of the same error.
Under thread-loader (no compiler hooks), `loader.ts:42-44` also emits every config error on every module. The e2e
`webpack-profile-config.test.ts:71-76` pins that today ("per module", count **2**).

### The work

The plan's Design → "Errors once (item 6)" is the spec: file-less TypeScript diagnostics from `build` join the config
errors and are reported once per compilation through the existing dedup in `afterCompile`. Without hooks, the loader
remembers what it reported until the options change. The key is the formatted message.

1. **Split them out in core, in `ModuleCompiler.build`.** Before the push at `:345`, take every diagnostic of
   `result.diagnostics` with `!cur.file && cur.code > 0 && cur.category === ts.DiagnosticCategory.Error` out of the
   module's diagnostics. Store it on the instance, keyed by code plus flattened message (the same predicate as
   `emitWatchedFile`, `Compiler.ts:843`). Two notes on the predicate:
   - `code > 0` keeps websmith's own file-less diagnostics, such as `Addon processing failed` (`:338`), on their
     module, as `Compiler.ts:674` does;
   - errors only, because `ConfigErrorReporter` collects errors only (`:115`) and `afterCompile` pushes into
     `compilation.errors` without looking at the category (`webpack-hooks.ts:64-66`). File-less warnings stay on the
     module, as today. Say so in the PR.

   Put the split in one private method, so that `bug/loader-dependent-profile-diagnostics` can run the dependent
   profiles' fragment diagnostics (`:319-321`) through it later. Do not add those diagnostics here.
2. **They live as long as the config errors:** until the next option resolution. Clear the store in the
   `ModuleCompiler.setOptions` override (`:178-183`), and only there. **Not** per compilation and not in
   `resetCompilationCaches`. A watch rebuild that rebuilds no websmith module must still fail while the options stay
   invalid. That is how config errors behave today: `afterCompile` re-pushes them on every compilation. On the fast
   path a file-less diagnostic depends on the options only. **Pitfall:** `Compiler`'s constructor calls
   `this.setOptions` (`Compiler.ts:136`) before `ModuleCompiler`'s field initializers run. Guard the clear (e.g.
   `this.store?.clear()`) or let the field initializer create the empty store.
3. **`getConfigErrors()` (`:186-189`) returns both:** the collected config errors, then the stored file-less
   diagnostics. Update its doc comment and the class comment (`:135-141`), which states the host contract ("reports
   `getConfigErrors` once per compilation"). With hooks, nothing else changes: `afterCompile`
   (`webpack-hooks.ts:58-68`) already reports each formatted message once per compilation across all loader rules
   that share the compilation. That covers the plan's "also with two rules".
4. **Without hooks: once per options resolution, on a carrier module.** Replace the unconditional
   `reportDiagnostics(this, instance.getConfigErrors(), …)` at `loader.ts:42-44` with errors that this instance has
   not yet put on another module since its options were last resolved. Keep a carrier per formatted message, i.e.
   the `resourcePath` that first emitted it, and emit again whenever **that** module builds. Without the carrier
   rule, a watch rebuild of the carrier with unchanged options would drop the error, because webpack replaces a
   rebuilt module's errors. Clear the carriers with the store (step 2). Place this bookkeeping in `ModuleCompiler`
   (e.g. `takeUnreportedConfigErrors(resourcePath)`). It is bundler-neutral, and the next host (the Vite plugin, plan
   `2026-10-01-vite-plugin.md`) needs the same thing. `loader.ts` only calls it.

   Each thread-loader worker holds its own instance (`compiler-instances.ts:57-59`), so "once" means once per worker.
   This applies to config errors too, because they now share the path: the e2e at `webpack-profile-config.test.ts:71`
   changes from "per module" / **2** to once. Rename it accordingly.
5. **Docs and release notes**, see below.

### Settled decisions — do not re-derive them

- **Through the existing `afterCompile` dedup, keyed by the formatted message** (plan Design, item 6). Keying by
  message, not by file or code alone, is what lets the option diagnostics that #136's `bug/report-file-less-diagnostics`
  adds to per-file declaration fragments fall under the same dedup.
- **Without hooks, remember until the options change**, as #130 does for CLI watch. The carrier refinement in step 4
  only keeps a rebuilt carrier from losing its error. It does not change "once".
- **Per compilation and per loader instance.** Two rules in one compiler share `reportedConfigErrors` for their
  compilation, so the result is one error. A `MultiCompiler` has one compilation per child compiler, so each child
  reports once (plan Design, "Scope of 'once'").
- **The persistent-cache case is not yours.** "A build restored entirely from the cache reports config errors" is
  `bug/loader-cached-config-errors` (`:263`).

### Found while writing this brief — the plan did not settle these

- **Category.** The plan says "file-less TypeScript diagnostics". The path it chose (`afterCompile` →
  `compilation.errors`) can only carry errors. Recommended: errors only (step 1). File-less warnings are rare on
  these paths and stay per module. Name this in the PR. If the reviewer wants warnings too, route them by category in
  `afterCompile` (`compilation.warnings` plus `options.warn`), as `loader.ts:57-72` does per module.
- **Lifetime.** The plan does not say when collected diagnostics expire. Step 2 ties them to option resolution, for
  the reason given there. Known limit: on the loader's Program / language-service path, a file-less error that
  depends on files rather than options (e.g. TS2688 until `@types/x` is installed) stays until the options are
  resolved again. Today it would also stay on every cached module. Record it in the PR; do not engineer around it.
- **thread-loader determinism.** With several workers, a two-module e2e may land on one worker or two. In every new
  thread-loader case, pass `{ loader: <thread-loader>, options: { workers: 1 } }`. Change `runWebpack`
  (`webpack-profile-config.test.ts:85-129`, `:101`) the same way, so that the renamed case can assert exactly **1**.
- **`websmith --target foo` exiting 0 is not this slice's.** It is the CLI path, which never runs `ModuleCompiler`.
  `ts.parseCommandLine(["--target", "foo"])` returns `{}` and one 6046 (checked on 5.7.3). In the `tsconfig.json`
  branch, `parsedCommandLine` passes only the parsed options on to `getParsedCommandLineOfConfigFile` and drops
  `tscArgs.errors` (`packages/core/src/compiler/config/parsed-command-line.ts:73`, `:75-134`). Without a
  `tsconfig.json` it returns them (`:142`). `ResolvedCompilerOptions` then sets `errors: []` (`:250`), and the fast
  path filters 6046 anyway (`Compiler.ts:1430`). It belongs to **`bug/report-config-option-errors`**: same field
  (`configErrors` on `ResolvedCompilerOptions`), same discard at `:250`, same report point. But that plan's text names
  only the tsconfig parse errors ("from the one parse of the CLI's tsconfig"), not command-line errors, so its brief
  must add `tscArgs.errors` explicitly. Do not fix it here.

### Tests

**Unit, `packages/core/src/compiler/ModuleCompiler.spec.ts`** (`describe("ModuleCompiler build")` `:69`,
`describe("ModuleCompiler options")` `:214`). Use a project whose options give a file-less error on the fast path,
e.g. `module: commonjs` + `moduleResolution: bundler` (TS5095):

- `build` of two files returns no TS5095 in either result's `diagnostics`, and `getConfigErrors()` holds it **once**
  (fails before: it is in both results);
- a file-less **warning** and a websmith diagnostic with code 0 stay in `build`'s `diagnostics`;
- after `updateLoaderConfig` with valid options, `getConfigErrors()` no longer holds it; after `resetCompilationCaches`
  it still does;
- the no-hooks method: the first module gets the error, a second module does not, the first module building again
  gets it again, and after an options change the next module gets it.

**Unit, `packages/webpack/src/loader.spec.ts`** (`setUpLoader` `:359-378`; the no-hooks cases `:508-528`). Rewrite
`:518` ("emits config errors on every module w/o compilation hooks"). It becomes: a second module gets none, and the
carrier module gets them again. Keep `:529` (with hooks, none on the module).

**Unit, `packages/webpack/src/webpack-hooks.spec.ts`** (`:54`, stub `getConfigErrors` `:269`). Add one case: a
file-less TS diagnostic returned by `getConfigErrors` is pushed once per compilation, also by two instances sharing
the compilation. The existing dedup should make it green without code changes. Assert it anyway, since the plan
names "with and without hooks".

**E2E, `packages/webpack-test/tests`.** Add a new file, e.g. `webpack-loader-option-errors-once.test.ts`, or extend
`webpack-profile-config.test.ts`. Use `countOf` (`webpack-profile-config.test.ts:131`) and `tsconfig.json`
`{ module: "commonjs", moduleResolution: "bundler" }` over at least two modules (the plan's "invalid `tsconfig.json`
option"):

- one loader rule: exit 1, and `countOf(output, "TS5095")` (or the message prefix) is **1**. It is 2 on `develop`;
  run it first to show red;
- two loader rules over disjoint `test`s in one compiler: **1**. Copy the two-rule setup from
  `webpack-loader-resolve-once.test.ts:169-203`;
- thread-loader with `workers: 1`: **1**;
- the existing `webpack-profile-config.test.ts:71-76`, renamed: config error once with thread-loader.

Do not assert TypeScript's message text beyond the code and the websmith-independent prefix. It may change in 6.x.

### Release notes and docs

- **`Release-Notes.md`**, `## [Unreleased]` → `### Fixed`, appended: "The webpack loader reports a TypeScript option
  error, e.g. TS5095 or TS5053, once per compilation instead of once per module, also when several loader rules
  share the options. Under `thread-loader`, configuration errors and option errors appear once per worker instead
  of once per module." (Plan Changelog, `:47`.)
- **`packages/webpack/README.md`:**
  - `:85-86` ("TypeScript diagnostics … are emitted on the module that produced them"): add that errors without a
    file, i.e. option errors such as TS5095, are reported once per compilation like configuration errors;
  - `:98-103`: replace "Without compiler hooks, e.g. under `thread-loader`, the loader emits the configuration errors
    on every module it builds instead, so they appear once per module" with the new behaviour (once per worker, on
    the first module that worker builds, and again when that module is rebuilt).

### Done when

- On `develop` the e2e counts are 2 or more; on the branch they are 1.
- The unit cases above are green, including the carrier rebuild and the reset on an options change.
- No TypeScript diagnostic with a `file` moved: per-module syntax errors, ESM-check findings and declaration emit
  errors are still emitted on their modules (existing `webpack-test` suites unchanged except the renamed thread-loader
  case).
- **Gates, all green:** `pnpm lint`, `pnpm build`, `pnpm test --skip-nx-cache`, `pnpm test:e2e --skip-nx-cache`. Say
  in the PR whether the advisory TS 6.0.3 cell is green.
- **Tests follow `docs/rules/testing.md`:** assemble / act / assert with no part comments, `testObj` and `actual`,
  no shared `testObj`. New files carry the MIT header (`pnpm license:add`). Do not add them to the `license:check`
  list.
- The PR names the method that `bug/loader-dependent-profile-diagnostics` should call for dependent fragments, and
  states the category and lifetime decisions above.

### Repo mechanics

- **pnpm 10** from `$HOME/.nvm/versions/node/v22.17.0/bin`: put it first on `PATH`. The Homebrew pnpm 11 fails with
  E401.
- **Installs:** `pnpm install --offline`. Never edit `~/.npmrc`. This branch needs no new package (`thread-loader` is
  already a webpack-test dependency).
- **webpack-test e2e runs against the built packages:** run `pnpm build` before `pnpm test:e2e`.
- **Commits:** Arlo's notation without a colon (`commit-notation` skill), e.g.
  `B Reports file-less TypeScript errors of the loader once per compilation` and
  `B Emits config errors once per worker without compilation hooks`.
- **Deleting files:** use `trash`, never `rm`.

### Bookkeeping

- Push the first green commit as soon as it exists.
- Open the PR with `plot-open-pr.sh`, never `gh pr create`, then give it a descriptive title.
- Append `→ #<number>` to the `bug/loader-option-errors-once` line
  (`docs/plans/2026-10-02-loader-options-once.md:247`), before its `<!-- builds: -->` comment, and commit that on
  this branch.

### Scope guard

This branch owns:

- `packages/core/src/compiler/ModuleCompiler.ts`: `build` (`:286-354`, the split only), `setOptions` (`:178-183`),
  `getConfigErrors` (`:186-189`), the class comment, and the new no-hooks method. Also `ModuleCompiler.spec.ts`;
- `packages/webpack/src/loader.ts` (`:41-44`) and `loader.spec.ts`; `webpack-hooks.spec.ts` (tests only;
  `webpack-hooks.ts` changes only if the reviewer asks for warning routing);
- `packages/webpack-test/tests` (new file, `webpack-profile-config.test.ts` thread-loader case and `runWebpack`);
- `packages/webpack/README.md` (`:85-86`, `:98-103`), `Release-Notes.md`, and the `→ #<PR>` line in the plan.

Do not touch:

- **`packages/core/src/compiler/options/ResolvedCompilerOptions.ts`, `config/convert-enum-options.ts`,
  `config/resolve-compiler-config.ts`.** This slice changes no option resolution. They belong to
  `bug/profile-lib-names` (now), `bug/loader-unknown-profile-error` and #136's `bug/report-config-option-errors`;
- `packages/core/src/compiler/Compiler.ts`: `report()` and its filter (`:664-685`), `emitWatchedFile`, the 6046
  filter (`:1430`) and the per-file declaration path belong to `bug/report-file-less-diagnostics`;
- the dependent-profile loop in `build` (`:311-329`), which belongs to `bug/loader-dependent-profile-diagnostics`;
- `checkProfile` (`ModuleCompiler.ts:390-393`, `TsCompiler.ts:103-105`) and `getFragmentProfile`
  (`TsCompiler.ts:143-150`), which belong to `bug/loader-unknown-profile-error`;
- `compiler-instances.ts`, `loader-options.ts`, `options.ts`, `TsCompiler.ts`;
- `package.json` files, `pnpm-lock.yaml`, tsconfigs, `.github/`, webpack-test snapshots.

**Parallel with `bug/profile-lib-names` (#135).** The two slices share no source file. That slice changes
`convert-enum-options.ts`, the `convertCliEnumOptions` filter in `ResolvedCompilerOptions.ts` (`:411-417`) and adds
a compiler-test file. This one stays in `ModuleCompiler.ts`, `packages/webpack` and webpack-test. Both append to
`## [Unreleased]` / `### Fixed` in `Release-Notes.md`. Whoever merges second rebases and keeps both bullets.

Other branches of this plan that may start now, since their waits are met:

- **`bug/loader-cached-config-errors`** (`:263`) attaches config errors to a carrier module for the persistent cache.
  It collides with your `loader.ts:41-44` and with the carrier bookkeeping. It should start after this slice merges
  and build on your carrier method. If it is already running, coordinate through the maintainer rather than both
  editing `loader.ts`.
- **`bug/loader-unknown-profile-error`** edits `ModuleCompiler.ts` `checkProfile` and `TsCompiler.ts`, not the
  methods you own. Rebase if it lands first.
- **`bug/loader-package-type-deps`** adds a `needBuild` tap and `buildInfo` records (`webpack-hooks.ts`,
  `ModuleCompiler.build` dependencies). It may touch the same `build` method. Keep your diff in `build` to the
  diagnostics split.

If you find something the plan did not anticipate beyond the items above, report it rather than improvising outside
scope.
