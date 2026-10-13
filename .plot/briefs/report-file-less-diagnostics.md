<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — cli-error-exit-gaps (slice: Errors without a file)

- **Plan (canonical):** `docs/plans/2026-10-02-cli-error-exit-gaps.md` on `develop`
- **Approved:** 2026-10-02, Jan Wloka, plan-PR #136 merged
- **Branch:** `bug/report-file-less-diagnostics` (base: `develop`, at `a888e451` when this brief was written)
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh` (on `PATH`). Do not merge it yourself.
- **Review of the code:** an independent review, plus uncached gates run by the maintainer's session before merge

**Ordering.** This is wave 5 of the plan (items 2 and 3). Its line carries `<!-- waits: bug/loader-option-errors-once -->`.
That branch merged as #181, and #135's defaults slice as #161, so both prerequisites the plan's Order paragraph names
are met. Waves 1 to 4 and 6 have merged: #147, #163, #170, #187 (`9dccca77`), #176. `bug/loader-unknown-profile-error`
merged as #188 (`a888e451`); it changed `ModuleCompiler.ts` but not `Compiler.ts`. It runs **in parallel** with:

- `bug/watch-generator-added-files` (same plan, wave 7, brief on `develop`). It rewrites the loops of
  `Compiler.watch()` and `registerWatch`. You do not touch `watch()` at all. See Scope guard.
- `bug/typescript-6-own-compilations` (brief on `develop`). It does not touch your files.
- `bug/typescript-6-root-dir-once` (waits on own-compilations). It owns TS5011. See trap 4.

All line numbers are from `develop` at `a888e451`. If they move, find the code by name.

### What changed on `develop` since the plan

| Plan says | Now on `develop` |
|---|---|
| `report()` filters `!cur.file` at `Compiler.ts:670-673` | `packages/core/src/compiler/Compiler.ts`: `report()` `:672-695`, the filter `:679` (`.filter(cur => program.getProjectReferences?.()?.length \|\| cur.file)`); #130's key `:685`, `getDiagnosticKey` `:697-699` |
| per-file Programs collect syntactic and emit diagnostics only (`:1320-1328`) | `transpileSourceCode` `:1299`; the per-file Program `emitWithTransformers` `:1325-1364` (`ts.createProgram` `:1330`, the `emitted` set `:1355`, its return `:1356-1362`) |
| `reportedWatchDiagnostics` (`:138`) | field `:120`, used in `emitWatchedFile` `:845-858`, cleared in `setOptions` `:306` and `resetCompilationCaches` `:337` |
| the 6046 filter (`:1405`) | `:1438` (`transpileSourceCode`'s fast path) and `:1551` |
| `watch()` | `:220-254`; #187 put `configErrors` at its first line `:221` and in `compile()` `:146` |
| — | #181 added `ModuleCompiler.takeFileLessErrors` (`packages/core/src/compiler/ModuleCompiler.ts:510-518`), called in `build` at `:401`, store `fileLessErrors` `:160`, cleared in `setOptions` `:200-207`, read by `getConfigErrors` `:215` |

### The failure, measured

Built `develop` (`9dccca77`; #188 since did not touch `Compiler.ts`) and ran `node packages/compiler/bin/bin.js` next
to the workspace `tsc` 5.7.3 and `tsc` 6.0.3. Fixture: `tsconfig.json` with `outDir: "out"`, `include: ["src"]`,
`src/a.ts`, `src/b.ts`, plus the options in the row. "type-info" means `--addonsDir addons --addons type-info-addon`
with `exports.activate = () => {};` (no `needsTypeInfo`, so the Program path). With `declaration: true` and no
type-info addon websmith takes the per-file declaration path.

| Options | `tsc` 5.7.3 | `tsc` 6.0.3 | websmith | websmith type-info |
|---|---|---|---|---|
| `rootDir: "src"`, `types: ["does-not-exist"]` | TS2688 ×1, exit 2 | TS2688 ×1, exit 2 | nothing, exit 0 (fast path, see Settled) | **nothing, exit 0** |
| same + `declaration: true` | TS2688 ×1, exit 2 | TS2688 ×1, exit 2 | **nothing, exit 0** | **nothing, exit 0** |
| `rootDir: "src"`, `types: []`, `module: "commonjs"`, `moduleResolution: "bundler"` | TS5095 ×1, exit 2 | nothing, exit 0 | TS5095 ×1, exit 1 | **nothing, exit 0** |
| same + `declaration: true` | TS5095 ×1, exit 2 | nothing, exit 0 | **nothing, exit 0** | **nothing, exit 0** |
| `rootDir: "src/lib"`, `types: []`, `src/lib/a.ts`, `src/b.ts`, `src/c.ts` | TS6059 ×2, exit 2 | TS6059 ×2, exit 2 | TS6059 ×2, exit 1 | **nothing, exit 0** |
| same + `declaration: true` | TS6059 ×2, exit 2 | TS6059 ×2, exit 2 | **nothing, exit 0** | **nothing, exit 0** |

`tsc` prints TS2688 and TS6059 without a location and locates TS5095 in `tsconfig.json`; websmith prints them without
a location, as it does today for TS5095 on the fast path. Without `rootDir`, 6.0.3 adds TS5011, which is not yours
(trap 4): use `rootDir` in every fixture.

**CLI watch** (`--watch`, two edits of a source file): TS2688 with type-info, TS2688 / TS5095 / TS6059 with
`declaration: true`, and TS5095 / TS6059 with type-info all print **nothing**. The fast-path TS5095 prints once.

**Webpack loader, watch** (`webpack.watch`, `tsConfigFile` + `configFile`, no `transpileOnly`, one rule, entry
`src/lib/index.ts` importing `../b` and `./c`; build 1 removes the `../b` import, build 2 edits `c.ts`):

| Options | build 0 | build 1 | build 2 |
|---|---|---|---|
| `rootDir: "src/lib"`, fast path | TS6059 ×1 | **TS6059 ×1 (stale)** | **TS6059 ×1 (stale)** |
| `rootDir: "src/lib"`, `declaration: true` | nothing | nothing | nothing |
| `moduleResolution: "bundler"`, `declaration: true` | nothing | nothing | nothing |
| `types: ["does-not-exist"]`, `declaration: true` | nothing | nothing | nothing |

The stale fast-path row is on `develop` today: `transpileModule` returns TS6059 for `b.ts`, #181's
`takeFileLessErrors` stores it until the options are resolved again, and `afterCompile` re-pushes it on every rebuild
after `b.ts` left the bundle. This is the #181 review concern; your change would extend it to the declaration path.
Fix it here (step 4).

### Four traps found while writing this brief — read before coding

All four were hit by a throwaway prototype of the design below (not committed).

1. **TS6059 is file-dependent, and a per-file Program has the importer's imports.** The per-file Program for
   `src/lib/index.ts` also contains `src/b.ts` when `index.ts` imports it, so its `getOptionsDiagnostics()` names
   `b.ts` too. Without a filter every module that transitively imports an out-of-`rootDir` file reports it, and in the
   loader each copy lands in the sticky store. Step 2's filter keeps only what concerns the Program's own root file.
2. **#181's sticky store is wrong for file-dependent errors.** It lives until option resolution
   (`ModuleCompiler.setOptions`), on purpose: an option error must still fail a rebuild that rebuilds no websmith
   module. A TS6059 for a module's own file must instead live as long as the module, which webpack already does for
   module errors (dropped with a deleted module, replaced on rebuild, kept on a cached module). Step 4.
3. **The big Program reads the real disk.** `createProgram` (`Compiler.ts:1036-1067`) uses `createCompileHost`
   (`packages/core/src/environment/compile-service.ts:23-25`, `ts.createCompilerHost`), not `this.system`. Removing
   the filter at `:679` makes four virtual-system cases of `describe("compile w/ syntax error and addon needing type
   information")` (`Compiler.spec.ts:5095-5155`) also print `Error: 6053: File '/src/target.ts' not found.`. That is a
   test artefact (CLI root files exist on disk; generator-added virtual files are not root files when the Program is
   created). **Do not change their assertions and do not filter 6053 in the product.** Give that describe's compiler
   a Program over the virtual files: override `createProgram` in a local subclass of `CompilerTestClass` (public there,
   `:48-50`) with a host that reads `fileSystem`, like `createNodeNextProgram` (`:4945-4964`).
4. **TS5011 on TypeScript 6 is `bug/typescript-6-root-dir-once`'s.** On 6.0.3 a one-file Program without `rootDir`
   reports TS5011 with that file's directory, so per-file `getOptionsDiagnostics()` would print one distinct TS5011
   per source directory (that brief, "The triple TS5011"). Drop code **5011** from every source you add (the per-file
   Program, the Program path in `report()`, the watch language-service Program) with a named constant and a comment
   naming that slice. Its slice drops 5011 from fragments and appends one per context; together that gives one.

### The work

The plan's Design → "Errors without a file (items 2, 3)" is the spec. Write the failing tests first (below), then:

1. **`report()`** (`Compiler.ts:672-695`): drop the filter at `:679`, so `ts.getPreEmitDiagnostics(program)` reaches
   the existing key at `:685`, minus code 5011 (trap 4). Update the comment at `:676` ("Global diagnostics of the
   Program are filtered out"); the project-references condition goes with the filter. #130's key prints each
   file-less diagnostic once per profile; the Program path's fragments carry only syntactic diagnostics, so nothing
   doubles.
2. **Per-file declaration Programs** (`emitWithTransformers`, `:1325-1364`): add `program.getOptionsDiagnostics()` to
   the returned diagnostics, before the syntactic ones, through the same `emitted` filter (`:1355`): under
   `noEmitOnError` the emit returns the pre-emit diagnostics, options diagnostics included. Drop:
   - code 5011 (trap 4);
   - every diagnostic whose flattened message contains the `fileName` of another non-declaration source file of that
     Program (`program.getSourceFiles()` other than `sourceFile`). That file's own per-file Program reports it
     (trap 1); the plan's "TS6059 once per offending file" follows.
   Put it in one private method (about 6 lines). It costs nothing when there are no options diagnostics, the normal case.
3. **Watch, in `emitWatchedFile`** (`:845-858`), not in `watch()`: when the file goes through the language service —
   `!this.transpileOnly && !this.shouldUseTranspileModuleFastPath(profile) && this.anyAddonNeedsTypeInfo(profile)`,
   `profile` being the second argument — prepend
   `this.getContext(profile)?.getLanguageService().getProgram()?.getOptionsDiagnostics()` (minus 5011) to the fragment
   diagnostics before the existing loop. Its `reportedWatchDiagnostics` key prints each once per session, across
   rebuilds. The per-file declaration path needs nothing here: step 2's diagnostics come in the fragment. This covers
   the first build and every rebuild without editing `watch()`, which `bug/watch-generator-added-files` rewrites; the
   plan's "after the first emit" holds because each call runs after that file's emit. Do not add the language-service
   options diagnostics in `transpileInternal`: that would reach the loader's language-service path, which the plan
   does not cover (see Found).
4. **`ModuleCompiler.takeFileLessErrors`** (`ModuleCompiler.ts:510-518`, called at `:401`): pass `filePath` (`:353`).
   A file-less error whose flattened message contains the module's own path (normalise `\` to `/` on both sides)
   **stays on the module**, like an error with a file; every other file-less error goes to the sticky store as today.
   With step 2 a per-file Program reports TS6059 only for its own root, and `transpileModule`'s Program has only the
   file, so file-naming option errors get the module's lifetime on both paths. Update the doc comment (`:504-508`).
   Do not change `setOptions`, `getConfigErrors` or `takeUnreportedConfigErrors`.
5. **Docs and release notes**, see below.

### Settled decisions — do not re-derive them

- **Exit 1, not 2** (plan Open Point "Exit code"). `packages/compiler/README.md:88` (#187) already says so.
- **No double reporting with #187.** `configErrors` (tsconfig parse and command-line errors, reported at the start of
  `compile()` `:146` and `watch()` `:221`) and the Programs' options diagnostics are disjoint: the options given to
  `createProgram` and the per-file Programs carry no `configFile`, so `getOptionsDiagnostics()` holds no
  TS5023/TS1005/TS6046 of the tsconfig. Prototype: #187's `bogusOption` e2e cases (fast path and type-info) stay green.
  Keep a guard test with `declaration`.
- **The fast path is unchanged.** `transpileModule` does not resolve `types`, so TS2688 stays unreported there; that
  is the plan's follow-up "type errors on the default CLI path". Name it in the PR.
- **TS2318 under `noLib`** is reported on the Program path only (plan Changelog). Step 1 brings it there; the per-file
  path does not call `getGlobalDiagnostics` (plan Open Point 2, closed).
- **The 6046 filters stay** (`:1438`, `:1551`).
- **TS2688 in the loader stays sticky until the options are resolved again**, as #181 recorded ("known limit"). It
  names no source file, so step 4 keeps it in the store. Restate it in the PR.
- **Rejected: clearing the store per compilation.** A rebuild that rebuilds no websmith module would then pass while
  the options stay invalid, which #181 ruled out. **Rejected: classifying by an empty-root Program.** Measured on 5.7.3
  and 6.0.3: `ts.createProgram({ rootNames: [] })` returns TS5095 but not TS2688 (`types` are processed only with root
  files), so TS2688 would land on every module. **Rejected: a code list.** TS6059, TS6307, TS5055, TS5056 all name a
  file; a list needs upkeep per TypeScript version.

### Found while writing this brief — report, do not fix

- **Loader + language-service path.** With an addon needing type information the loader reports no TS2688 / TS5095 /
  TS6059 (the language-service fragment carries syntactic diagnostics only). The plan covers the CLI's Program path,
  per-file path and watch only. Name it as a follow-up in the PR.
- **`thread-loader` + `declaration: true`** fails with `context.emitFile is not a function`
  (`packages/webpack/lib/result-handling.js:438`, `emitAdditionalFile`) in the prototype, which does not touch that
  code. Not checked on `develop`. Keep `declaration` out of thread-loader e2e cases; name it in the PR.
- **`compile-websmith.test.ts:83`** ("should not build js and d.ts with defaults", `packages/compiler-test`) turns red
  in the prototype: the compile now reports TS6059 because the effective `rootDir` (`packages/compiler-test/src`) does
  not contain the test's source in `test-output-…/src`. It is printed twice because `@quatico/websmith-node`'s
  `compile` reports `results.diagnostics` again (`packages/node/src/websmith/compile.ts:54-58`, known from #187).
  Confirm with `tsc` on the same options that TS6059 is correct, then make the assertion expect it (assert
  `is not under 'rootDir'`, not a count). Name the case in the PR. Do not fix the websmith-node double report here.
- **TypeScript 6.** TS5095 is not reported on 6.0.3. Removing the filter at `:679` may surface file-less deprecation
  errors (TS5101/TS5107) on the Program path on 6.0.3, as the fast path already does. If an advisory-cell fixture turns
  red for that, fix the fixture and list it in the PR.

### Prototype evidence (scratch only, not committed)

Steps 1 to 4 were prototyped on `9dccca77` (about 30 lines; without the 5011 drop) and built with `pnpm build`.

- **CLI, 5.7.3:** every row of the table matches `tsc`'s count with exit 1 and the same output files: TS2688 ×1 with
  type-info and with `declaration`; TS5095 ×1 on all three paths; TS6059 ×2 on all three paths.
- **CLI watch:** TS2688, TS5095 and TS6059 each print once with type-info and with `declaration`, across two edits.
- **Loader watch:** `rootDir` on the fast path and with `declaration`: TS6059 ×1 in build 0, **0** in builds 1 and 2.
  TS5095 and TS2688 with `declaration`: ×1 in every build (sticky, as #181 intends).
- **Unit:** `@quatico/websmith-core` 1312/1316 (the four trap-3 cases only), `websmith-loader` 235/235,
  `@quatico/websmith-compiler` 209/209.
- **E2E (`pnpm test:e2e --skip-nx-cache`):** core 8, `websmith-loader` 38, examples 11, `bin.test.ts` 101,
  `websmith-vite-test` 8, `websmith-loader-test` 105 (+1 skipped) green; `@quatico/websmith-compiler-test` 63/64, the
  one case named under Found.

### Tests

Follow `docs/rules/testing.md`: assemble / act / assert, no part comments, `testObj` and `actual`, no shared `testObj`.
Assert codes and stable message prefixes only. TS5095 cases run on TypeScript 5 only:
`const describeOnTs5 = Number(ts.versionMajorMinor.split(".")[0]) < 6 ? describe : describe.skip;`, as
`packages/webpack-test/tests/webpack-tsc.test.ts:35` (an `it`-level skip trips `jest/no-standalone-expect`).

**Unit, `packages/core/src/compiler/Compiler.spec.ts`:**

- `describe("report")` (`:2048`): the existing mocks set `file` everywhere (`:2080-2081`). Add a Program mock whose
  `getOptionsDiagnostics` returns a file-less `code: 2688` diagnostic: reported once, also when `result.diagnostics`
  holds the same one. A file-less `code: 5011` one is not reported.
- `describe("compile")` (`:1031`), virtual system:
  - `declaration: true`, `types: ["does-not-exist"]`, two files: `Cannot find type definition file for
    'does-not-exist'` exactly once (red today);
  - `declaration: true`, `rootDir: "/src/lib"`, `/src/lib/a.ts` importing `../b`, `/src/b.ts`, `/src/c.ts`:
    `is not under 'rootDir'` exactly twice, naming `/src/b.ts` and `/src/c.ts` (red today). Also assert, through
    `emitSourceFile("/src/lib/a.ts")`, that `a.ts`'s fragment holds no TS6059 (the report key alone would hide a naive
    step 2);
  - with the type-info addon (legacy addon, as at `:5104-5106`) and `types: ["does-not-exist"]`: once (red today);
    needs the trap-3 Program override, shared with the four fixed cases in a local helper;
  - guard: a tsconfig `bogusOption` via `cliArgs.errors` (as #187's cases) with `declaration` prints once.
- `describeOnTs5`: `declaration: true`, `module: CommonJS`, `moduleResolution: Bundler`: TS5095 once.
- `describe("watch")` (`:2116`), pattern of `:2219-2242`: with `declaration: true` and `types: ["does-not-exist"]`,
  and separately with the type-info addon, the message prints once after `watch()` and a rewrite of `/src/a.ts`.
- Fix the four trap-3 cases (`:5119-5155`) by their setup only.

**Unit, `packages/core/src/compiler/ModuleCompiler.spec.ts`** (`describe("ModuleCompiler option errors")` `:417`):

- `rootDir` violation on the fast path: `build` of the offending file returns the TS6059 in `diagnostics`, and
  `getConfigErrors()` does not hold it (red today);
- the same with `declaration: true` (red today: not reported at all);
- TS2688 with `declaration: true` over two files: in neither result's `diagnostics`, once in `getConfigErrors()`;
- after building a file that no longer imports the offending one, `getConfigErrors()` holds no TS6059.

**e2e, `packages/compiler/src/bin.test.ts`**, next to the option-error cases (`:564-660`). Use `rootDir` in each
`createTsConfig` so TypeScript 6 adds no TS5011:

- `types: ["does-not-exist"]` with the type-info addon: status 1, `Cannot find type definition file for
  'does-not-exist'` exactly once, output written. Red today;
- the same with `declaration: true` and no addon: once. Red today;
- `describeOnTs5`: `declaration: true`, `module: "commonjs"`, `moduleResolution: "bundler"`: status 1, `Option
  'bundler' can only be used` exactly once. Red today;
- `declaration: true`, `rootDir` a subdirectory of `src`, two sources outside it: status 1, `is not under 'rootDir'`
  exactly twice. Red today.

**e2e, `packages/webpack-test/tests`:** one new file modelled on `webpack-loader-option-errors-once.test.ts`
(`runWebpack` `:79-118`, `countOf` `:121`). Do not edit #181's or #188's files.

- `declaration: true` (no `transpileOnly`), `types: ["does-not-exist"]`, three modules: exit 1, the message exactly
  once. Red today (0).
- the stale case, with `compiler.watch` in the spawned script: `rootDir: "src/lib"`, `src/lib/index.ts` importing
  `../b`; after the first build rewrite `index.ts` without the import. First build: `is not under 'rootDir'` once;
  second build: zero. Once with and once without `declaration: true`. Red today without `declaration` (the second
  build still has it), absent with it. Close the watcher and give the script a timeout, as `runWebpack` does.

**Fixture runs before and after** (plan slice line): run every `compiler-test` / `webpack-test` fixture and example
project on `develop` and on the branch; list the differences with `tsc` in the PR.

**Gates**, all green locally: `pnpm lint`, `pnpm build`, `pnpm test --skip-nx-cache`,
`pnpm test:e2e --skip-nx-cache` (`pnpm build` first). State whether the advisory TS 6.0.3 cell is green (recipe:
`.plot/briefs/typescript-6-root-dir-once.md`, "How to run 6.0.3 locally").

### Release notes and docs

- **`Release-Notes.md`**, `## [Unreleased]` / `### Changed`, after the option-errors entry (`:105`). Do not repeat
  the lead sentence (`:21`). Following the plan's Changelog:
  "Errors without a file, such as "Cannot find type definition file" (TS2688), a `rootDir` that does not contain every
  source file (TS6059), and option errors with `declaration: true`, such as TS5095, are reported once and fail the
  build with an addon that needs type information, with `declaration: true`, and in watch mode. Before, websmith
  printed nothing and exited 0. Errors that need the type checker of the whole program, such as a missing global type
  under `noLib` (TS2318), are reported only with an addon that needs type information. The webpack loader reports them
  with `declaration: true` too; an error that names a source file, such as TS6059, is reported on that module."
- **`packages/webpack/README.md`** (`:96-98`): after "every module would report the same one", add that an error
  without a file that names a source file, such as TS6059, belongs to that file's module and is reported there, and
  that option errors with `declaration: true` are reported the same way.
- `packages/compiler/README.md`: no change (`:88` covers the exit code).

### Done when

- Every bold cell of the table's 5.7.3 rows matches `tsc`'s count with exit 1 and unchanged output files; on 6.0.3 no
  TS5095 and no new TS5011.
- CLI watch reports each once per session; the loader stale case clears on the next build; TS2688 / TS5095 stay once
  per compilation in the loader.
- #187's `bogusOption` cases still print once.
- The four trap-3 unit cases pass with unchanged assertions; the only other changed expectation is
  `compile-websmith.test.ts:83`, justified in the PR.
- The PR body lists: the four traps, the step-4 rule and its rejected alternatives, the loader language-service and
  thread-loader findings, the fast-path TS2688 difference, the TS2688 sticky limit, and the before/after fixture run.

### Bookkeeping

- Push the first real commit as soon as it exists.
- Open the PR with `plot-open-pr.sh`, never `gh pr create`, then give it a descriptive title.
- Append `→ #<number>` to the `bug/report-file-less-diagnostics` line in the plan's `## Slices` (under "### Errors
  without a file"), before its `<!-- builds: -->` comment, and commit that on this branch.
- Commits use Arlo's notation without a colon (`commit-notation` skill), e.g.
  `B Reports file-less diagnostics of the Program and the per-file declaration Programs`,
  `B Keeps option errors that name the module's file on the module`,
  `t Compiles the type-info syntax error cases over the virtual files`.

### Repo facts

- Use pnpm 10 from `$HOME/.nvm/versions/node/v22.17.0/bin` (first on `PATH`). The Homebrew pnpm 11 fails with E401.
  Set `NX_DAEMON=false` in agent shells.
- Install with `pnpm install --frozen-lockfile --offline`. Never edit `~/.npmrc`. No new package.
- `bin.test.ts` and webpack-test run the built packages: `pnpm build` first.
- New files carry the MIT header (`pnpm license:add`). Do not add them to the `license:check` list.
- Use `trash`, never `rm`.

### Scope guard

This branch owns:

- `packages/core/src/compiler/Compiler.ts`: `report()` (`:672-695`), `emitWatchedFile` (`:845-858`), the per-file
  Program in `transpileSourceCode` (`emitWithTransformers`, `:1325-1364`), one new private method for step 2's
  filter and one constant for 5011;
- `packages/core/src/compiler/ModuleCompiler.ts`: `takeFileLessErrors` and its doc comment (`:504-518`) and its call
  in `build` (`:401`) only;
- the specs and e2e files named above, `compile-websmith.test.ts:83`, `Release-Notes.md`,
  `packages/webpack/README.md` (`:96-98`), and the `→ #<PR>` on this slice's plan line.

Do not touch:

- **`watch()` (`:220-254`), `registerWatch` (`:918-956`), `closeAllWatchers` (`:257-260`), `CompilationContext.ts`.**
  They belong to `bug/watch-generator-added-files`; step 3 lives in `emitWatchedFile` for that reason;
- the start of `compile()` (`:142-157`) and `configErrors` (#187);
- `transpileInternal`'s language-service branches (`:1221-1290`), the 6046 filters (`:1438`, `:1551`),
  `createProgram` (`:1036-1067`); TS5011 beyond dropping it (`bug/typescript-6-root-dir-once`);
- `ModuleCompiler.ts` outside step 4 (`setOptions`, `getConfigErrors`, `takeUnreportedConfigErrors`, `checkProfile`,
  the class comment); `packages/webpack/src`, `packages/vite/src`, `packages/api`;
- `defaults.ts`, `options.ts`, `AddonRegistry.ts`, `check-esm.ts`, `environment/**` (`bug/typescript-6-own-compilations`);
- `packages/node/**`, `package.json` files, `pnpm-lock.yaml`, tsconfigs, `.github/`, snapshots.

**Real overlaps, all textual:**

- `Compiler.ts` with `bug/watch-generator-added-files` (theirs `watch()`, `registerWatch`, a field near `:101`; yours
  `report()`, `emitWatchedFile`, `transpileSourceCode`); both add cases to `Compiler.spec.ts` `describe("watch")` and
  `bin.test.ts`. Both only add; whoever merges second rebases and keeps both.
- `Compiler.ts` fragment diagnostics with `bug/typescript-6-root-dir-once`, which drops 5011 from fragments in
  `emitSourceFile`; your 5011 drop is in other methods. If it merges first, reuse its constant.
- `Release-Notes.md` with every branch in flight: append-only, keep all entries.

If you find something the plan did not anticipate beyond the items above, report it rather than improvising outside
scope.
