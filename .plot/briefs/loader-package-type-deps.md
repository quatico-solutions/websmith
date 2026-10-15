<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief: loader-options-once (slice: package.json "type")

- **Plan (canonical):** `docs/plans/2026-10-02-loader-options-once.md` on `develop`
- **Approved:** 2026-10-02, Jan Wloka, plan-PR #134 merged
- **Branch:** `bug/loader-package-type-deps` (base: `develop`, at `6f6a581a` when this brief was written)
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh` (on PATH). Do not merge it yourself.
- **Review of the code:** an independent review, plus uncached gates run by the maintainer's session before merge

**Ordering.** The slice line carries `<!-- waits: bug/loader-resolve-options-once -->`
(`docs/plans/2026-10-02-loader-options-once.md:259`). That branch merged as #165. It made the options files module
dependencies (`packages/webpack/src/loader.ts:36-39`) and added the per-compilation cache reset that this slice
relies on (`webpack-hooks.ts:42-45`, `ModuleCompiler.resetCompilationCaches`). So this slice can start now. The
slices after it, #181, #188 and #191, have merged too. No slice waits on this one.

The last slice, `bug/loader-cached-config-errors` (`:263`), has no brief yet. It will most likely edit `loader.ts`
and `webpack-hooks.ts` too, for its carrier module. If it runs at the same time, keep your hunks in those files small
and separate from the `takeUnreportedConfigErrors` and `afterCompile` error code. Whoever merges second rebases.

Line numbers are from `develop` at `6f6a581a`. If they move, find the code by name.

### What changed on `develop` since the plan was approved

The plan's item 3/4 text and its Design bullet "`package.json` by `"type"`" predate #174, which moved the per-module
build from the webpack `TsCompiler` into core `ModuleCompiler`, and #165.

| Plan says | Now on `develop` |
|---|---|
| The ESM check registers `package.json` through `onDependency` (`classify-module.ts:103-108`, forwarded by `loader.ts:32-33`) | `createPackageTypeLookup` (`packages/core/src/compiler/esm/classify-module.ts:77-111`) reports the found `package.json` as `onDependency(path, true)` (`:107`) and the nearer missing candidates as `onDependency(path, false)` (`:105`). `ModuleCompiler.build` collects both into `dependencies` (`packages/core/src/compiler/ModuleCompiler.ts:380-381`) and returns them (`:447`). The loader registers them with `addDependency`/`addMissingDependency` (`packages/webpack/src/loader.ts:34-35`). |
| A node16/nodenext profile without `esm` runs no check (`TsCompiler.ts:307`) | `checkLoaderOutput` (`ModuleCompiler.ts:514-539`) returns early without `esm` (`:523-525`), so nothing registers a `package.json`. The fast path still reads it: `transpileNodeModule` (`packages/core/src/compiler/Compiler.ts:1454-1458`, `:1488`) gets the module format from `getImpliedNodeFormat` (`:1602-1607`, TypeScript's `packageJsonInfoCache`). |
| The `"type"` reading is shared with the CLI's `registerPackageJsonWatches` (`Compiler.ts:929`) | Now `Compiler.ts:972-1008`. It reads no `"type"`: it watches the file and re-emits on **any** change. `Compiler.ts` is edited by the open PR #196 (`bug/watch-generator-added-files`, hunks at `:106`, `:243-265`, `:935`). The shareable `"type"` reader is `readPackageType` (`classify-module.ts:113-120`), module-private today. |
| `needBuild` read in webpack 5.97.1, `lib/NormalModule.js:1474-1525` | The repo installs webpack **5.111.1** (`packages/webpack-test/package.json:54`, `^5.104.1`). `NormalModule.needBuild` is `lib/NormalModule.js:2051-2103`, with the same logic: after a valid snapshot it calls `getCompilationHooks(compilation).needBuild` and rebuilds on `true`. The peer range is `"webpack": "5.x"` (`packages/webpack/package.json:42`). |
| (not in the plan) | The ESM check reads `package.json` files for more than `"type"`, all through the same `onDependency`: bare-import resolution (`import-rules.ts:294`, `cjs-names.ts:93`, `:352`), directory entry fields (`import-rules.ts:382`), and the self-reference check, which reads `name` and `"exports"` from a `createPackageTypeLookup` result (`import-rules.ts:442-452`). Only the classification lookup in `checkEsm` (`packages/core/src/compiler/esm/check-esm.ts:116`) reads `"type"` alone. |
| (not in the plan) | The ESM check registers `package.json` for **every** profile with `esm` and `runtime: "node"`, whatever its `module`. The existing e2e `webpack-esm-check.test.ts:253` (a `"type"` flip in `lib/package.json` of an `esnext` dependent profile rebuilds both modules) and `:274` (a `package.json` created in `lib/sub` rebuilds one module) pin it. |
| (not in the plan) | The Vite plugin, the second `ModuleCompiler` host, ignores `build`'s `dependencies` (`packages/vite/src/hooks.ts:135`). |

### Current behaviour, reproduced

Reproduced on `6f6a581a` in a scratch worktree (Node 22.17.0, TypeScript 5.7.3, webpack 5.111.1, thread-loader
4.0.4). A separate Node process ran webpack with `mode: "development"`, `target: "node"`, entry `src/a.ts`
(`export const a = 1;`) and the loader with `transpileOnly: true`, a `tsConfigFile`, a `configFile` and
`profile: "target"`. The project `package.json` was `{ name, version: "1.0.0", type: "module" }`. The tsconfig had
`module` as listed and `moduleResolution` `nodenext` (or `bundler` for `esnext`). In watch mode the edit was written
1 s after a build. A step's result is the compilation whose `compiler.modifiedFiles` holds the `package.json`.
"Module deps" is the `package.json` entries of `a.ts`'s `buildInfo.snapshot`. "Format" is what `dist/main.js`
holds: `exports.a =` is CommonJS.

| Case | Module deps | `"version"` edit | `"type"` → `commonjs` |
|---|---|---|---|
| D1: `nodenext`, no `esm`, watch | none | compiles, nothing built | compiles, **nothing built, output stays ESM** (item 3) |
| D2: `nodenext`, `esm: { runtime: "node" }`, watch | `package.json` + 1 missing (`src/package.json`) | **`a.ts` rebuilt** (item 4) | `a.ts` rebuilt, CommonJS |
| D3: `esnext`, no `esm`, `run()` | none | – | – |
| D4: `esnext`, `esm: { runtime: "bundler" }`, `run()` | none | – | – |
| D5: `esnext`, `esm: { runtime: "node" }`, `run()` | `package.json` + 1 missing | – | – |
| D6: `node16`, no `esm`, thread-loader `workers: 1`, watch | none | – | compiles, **nothing built, stays ESM** |
| D7: D2 under thread-loader | `package.json` + 1 missing | `a.ts` rebuilt | `a.ts` rebuilt, CommonJS |
| C1: `nodenext`, no `esm`, `cache: { type: "filesystem" }`: `run()`, flip, `run()` in a **new process** | none | – | **nothing built, stays ESM** |
| C2: C1 with `esm: { runtime: "node" }` | `package.json` | – | `a.ts` rebuilt, CommonJS |

In every case `compilation.fileDependencies` already holds the project's `package.json`, because webpack's resolver
reads it as a description file. That is why a `package.json` edit always starts a watch compilation, even in D1.

**Prototype check.** I patched the built loader, gated by an environment variable:

- the loader wrote `{ [nearest package.json]: type }` into `this._module.buildInfo` and dropped that file from
  `addDependency`;
- `addCompilationHooks` tapped `needBuild` in `thisCompilation`, re-reading the recorded file;
- `afterCompile` added the recorded files to `compilation.fileDependencies`.

Results:

- **Watch, `nodenext` without `esm`:** a `"version"` edit compiled and built nothing. A flip to `commonjs` built
  `a.ts` with CommonJS output. A flip back built it again with ESM output. So **the tap works on 5.111.1, and no
  stamp-file fallback is needed.**
- **Persistent cache across processes:** the restored module still carried the recorded type, so **`buildInfo`
  survives the filesystem cache.** But the second process built **nothing**, and the output stayed ESM after the
  flip. With `esm: { runtime: "node" }` it also stayed stale, which is a **regression** against C2.
  - Cause: the loader registers its hooks only when it compiles its first module (`compiler-instances.ts:43-50`).
    A process that restores every module from the cache never runs the loader, so no tap exists.
  - With the same tap registered from the webpack config instead, the second process rebuilt `a.ts` as CommonJS.
  - With two modules, where only `b.ts` was edited before the second run, the tap came too late for `a.ts`. `a.ts`
    stayed ESM next to a CommonJS `b.ts`.
- **thread-loader:** the worker's loader context has no `_module`, and its `_compiler` is a stub without `hooks`
  (`thread-loader/dist/worker.js:355-370`). The loader can record nothing, and no websmith code runs in the main
  process to tap `needBuild`. Only `addDependency`/`addMissingDependency` reach webpack.

A stamp file would not help either case: nothing would rewrite it before webpack checks the module's snapshot.

### What to build

The plan's Design bullet "`package.json` by `"type"` (items 3, 4)" is the spec. The rows above settle three things
it left open.

**Decisions (settled here, do not re-derive):**

1. **Which `package.json` files are "type-only".** Two kinds are tracked by `"type"`:
   - the nearest `package.json` of the source file, with its missing nearer candidates, when the target or any
     dependent profile has `module` `Node16` or `NodeNext`, with or without `esm`;
   - the files the ESM check's **classification** lookup reads (`check-esm.ts:116`), for any profile with `esm`.

   Every other `package.json` the check reads stays a plain file dependency: bare-import resolution, directory entry
   fields, self-reference. Missing candidates always stay missing dependencies. If a file is both type-only and
   read for its content, the host registers it as a plain file dependency too.
2. **Use the same predicate as the emit.** Use `module === ts.ModuleKind.Node16 || module === ts.ModuleKind.NodeNext`
   on `this.getContext(profile)?.getCompilerOptions()`, the predicate of `Compiler.ts:1456` and `:976`. Node18 and
   Node20 do not exist in TypeScript 5.7.3. They are out of scope: say so in the PR.
3. **The host chooses the mechanism.** The webpack loader records the types in `buildInfo` and relies on the
   `needBuild` tap **only** when all three hold:
   - the instance has compilation hooks (`instance.hasCompilationHooks()`);
   - `this._module` exists;
   - `this._compiler.options.cache` is not `{ type: "filesystem" }`.

   Otherwise it registers the type-only files with `addDependency`, as #125 does for the ESM check today. That
   means under thread-loader and with the persistent cache, any edit still rebuilds. Item 3 is fixed everywhere;
   item 4 only in-process with webpack's memory cache, which is the `mode: "development"` watch default. This
   departs from the plan's claim that `buildInfo` "lets it survive the persistent cache". Say so in the PR, with
   the C1/C2 rows and the prototype finding.

**Steps.**

1. **Red e2e first** (the slice line's first step). Write the e2e "rebuilds module w/ type flip under watch w/
   nodenext profile w/o esm" (below) and watch it fail on `develop`, as in D1. Do not push a red commit. Commit it
   with the fix.
2. **Core: `classify-module.ts`.**
   - Export `readPackageType` (`:113-120`).
   - Add `export type PackageTypeCallback = (packageJson: string, type: PackageType | undefined) => void`.
   - Give `createPackageTypeLookup` (`:77`) an optional fourth parameter `onPackageType?: PackageTypeCallback`.
     When it is given, report the found `package.json` with its type to it **instead of**
     `onDependency(result.packageJson, true)` (`:106-108`). Missing candidates still go to `onDependency(…, false)`.
   - Without the parameter, behaviour is unchanged. Update the doc comment (`:73-76`).
3. **Core: `check-esm.ts`.**
   - Add `onPackageType?: PackageTypeCallback` to `EsmCheckContext` (`:29-50`), documented as "receives the
     package.json files whose `"type"` alone the classification read; without it they go to `onDependency`".
   - Pass it at `:116` only. `importContext` (`:120-127`) keeps passing `onDependency` alone, so
     `import-rules.ts:448` (self-reference) and the resolution paths stay plain.
4. **Core: `ModuleCompiler.ts`.**
   - `ModuleBuildResult.dependencies` (`:30`) gains `packageTypes: Record<string, PackageType | null>`: the
     `package.json` files whose `"type"` alone decided the build, with the type read, `null` for none. Document it.
     The early return (`:383`) returns `packageTypes: {}`.
   - In `build`, next to `onDependency` (`:381`), add an `onPackageType` that writes into a local record. Pass it in
     `checkLoaderOutput`'s context (`:529-535`; the method gets one more parameter, or pass both callbacks as one
     object).
   - When any of `[this.profile, ...selected dependents]` is node16/nodenext (decision 2), run
     `createPackageTypeLookup(system, onDependency, this.compilationCaches.packageTypeCache, onPackageType)` once on
     `filePath`. The cache is per compilation, or per build without hooks (`:373-377`), so a flip is seen on the
     next compilation.
   - Export `PackageType`, `PackageTypeCallback` and `readPackageType` from
     `packages/core/src/compiler/index.ts:12-22`. That list is explicit: values go in `:12-21`, types in the
     `export type` line `:22`.
5. **webpack: a new module `packages/webpack/src/package-types.ts`** with the `buildInfo` key (e.g.
   `"websmithPackageTypes"`) and small pure functions:
   - `recordPackageTypes(buildInfo, packageTypes)`;
   - `getRecordedPackageJsons(buildInfo)`;
   - `hasPackageTypeChanged(buildInfo, readType)`, where `readType` is `(packageJson) => PackageType | null`.

   Keep `buildInfo` values plain JSON (object, strings, `null`). webpack serializes them. Write them as plain
   objects too: no `Map`, no `undefined`.
6. **webpack: `loader.ts`.** After `build` (`:33-35`), apply decision 3:
   - with hooks, `this._module` and no filesystem cache: record into `this._module.buildInfo` and skip
     `addDependency` for type-only files that are not also in `dependencies.files`;
   - otherwise: `addDependency` each.

   Read the cache type from `this._compiler?.options?.cache`. The normalized value is `false` or an object with
   `type`. Under thread-loader `_compiler` has no `options`, and `hasCompilationHooks()` is false anyway.
7. **webpack: `webpack-hooks.ts`.**
   - In the existing `thisCompilation` tap (`:42-45`), or a sibling tap, tap
     `NormalModule.getCompilationHooks(compilation).needBuild`. It returns `true` when `hasPackageTypeChanged`,
     else `undefined`. Never return `false`, which would stop other taps.
   - Read each `package.json` at most once per compilation: a `WeakMap<Compilation, Map<…>>` like
     `reportedConfigErrors` (`:16`), reading with `readPackageType(ts.sys, …) ?? null`.
   - Register the tap once per webpack compiler, e.g. a `WeakSet<Compiler>`: two loader rules are two instances on
     one compiler.
   - In `afterCompile`, inside the `compilation.compiler !== compiler` guard (`:51-53`), add
     `getRecordedPackageJsons` of every module in `compilation.modules` to `compilation.fileDependencies`. webpack
     watches the project's `package.json` by itself, but not, e.g., `lib/package.json` of a dependent profile's
     output, which the ESM check classifies by.
   - The tap exists from the second compilation on, since the instance is created during the first. That is
     enough: `needBuild` matters only for modules restored from the cache.
8. **Docs and notes** (below).

No change to `Compiler.ts`, `import-rules.ts`, `cjs-names.ts`, `compiler-instances.ts` or `packages/vite/**`.

### Tests

Unit tests are red on `develop` unless marked *guard*.

**Core.**

- `classify-module.spec.ts`, `describe("createPackageTypeLookup")` (`:84`):
  - with `onPackageType`, the found `package.json` and its type go to it and not to `onDependency`, while missing
    candidates still go to `onDependency`;
  - a `package.json` without `"type"` is reported with `undefined`;
  - without `onPackageType`, it reports as today (*guard*, the existing tests at `:140-210` stay unchanged).
- `check-esm.spec.ts`: with `onPackageType` in the context, the classification's `package.json` goes to it. Next to
  "reports package.json dependencies of checked file" (`:312`), which stays unchanged.
- `ModuleCompiler.spec.ts`, a new `describe("ModuleCompiler package types")` at the end:
  - a `nodenext` target without `esm` → `dependencies.packageTypes` is `{ "/package.json": "module" }`, and the
    missing candidates are in `missing`;
  - a `package.json` without `"type"` → `null`;
  - an `esnext` target with a `nodenext` dependent profile → recorded;
  - an `esnext` target without `esm` → `packageTypes` is `{}` and no `package.json` in `files` or `missing`
    (*guard*);
  - a `nodenext` target with `esm: { runtime: "node" }` → the `package.json` is in `packageTypes` and **not** in
    `files`;
  - a type flip between two builds with `resetCompilationCaches()` between them → the second build records the new
    type.
- `packages/webpack/src/TsCompiler.spec.ts:347-367`: the two tests "reports found and missing package.json of node
  dependent profile as dependencies" and "reports same dependencies for second module in same directory" expect
  `{ files: ["/package.json"], missing: ["/lib/package.json"] }`. They change to `files: []`,
  `missing: ["/lib/package.json"]`, `packageTypes: { "/package.json": "module" }`. That change is the intended
  behaviour: say so in the PR.

**webpack.**

- `package-types.spec.ts` (new): record/read round trip; changed type → `true`; same type → `false`; no record →
  `false`; recorded `null` vs. current `null` → `false`.
- `loader.spec.ts`: `createLoaderContext` (`:386-398`) already takes `_module` and `_compiler`. Add:
  - hooks + `_module` + no cache option → `_module.buildInfo` holds the record, and `addDependency` is not called
    with that `package.json`;
  - without hooks → `addDependency` is called with it;
  - `_compiler.options.cache.type === "filesystem"` → `addDependency`;
  - a path in both `files` and `packageTypes` → `addDependency`.

  Leave "registers found and missing dependencies through loader context" (`:479`) unchanged.
- `webpack-hooks.spec.ts`: `NormalModule.getCompilationHooks` throws for a non-`Compilation`. Use
  `jest.spyOn(NormalModule, "getCompilationHooks").mockReturnValue({ needBuild: { tap } } as …)` and restore it.
  Cover:
  - the tap returns `true` for a changed recorded type and `undefined` for an unchanged one;
  - one read per `package.json` per compilation;
  - `afterCompile` adds recorded files to `fileDependencies`;
  - two `addCompilationHooks` calls on one compiler tap once.

Fresh `testObj` per test. Never a shared `let testObj`.

**E2E: a new `packages/webpack-test/tests/webpack-loader-package-type.test.ts`.** Model the runner on
`webpack-esm-check.test.ts:318-420`:

- spawn a separate Node process;
- print `RESULT` JSON lines;
- report `compilation.builtModules` resources.

Add:

- the `package.json` entries of the `a.ts` module's `buildInfo.fileDependencies` and `buildInfo.missingDependencies`;
- the output format of `dist/main.js` (`/exports\.a = /` → `"commonjs"`, else `"esm"`);
- a `threadLoader` flag;
- a `cache` flag (`{ type: "filesystem", cacheDirectory: <projectDir>/.cache }`);
- a "run twice in two processes" mode with an edit between the runs.

Always use `mode: "development"`. With `cache: false`, e.g. production mode without a cache, every module rebuilds
every time, and "not rebuilt" cannot be observed. Use the fixture of the reproduction: tsconfig `module` as listed,
`moduleResolution` `nodenext`, `profile: "target"`.

| Test | On `develop` | Must yield |
|---|---|---|
| should rebuild module w/ type flip under watch w/ nodenext profile w/o esm (D1) | built `[]`, ESM | built `[a.ts]`, `"commonjs"` |
| should not rebuild module w/ version edit under watch w/ nodenext ESM check (D2) | built `[a.ts]` | built `[]`, and no `package.json` in the module's file dependencies |
| should not rebuild module w/ version edit under watch w/ nodenext profile w/o esm | built `[]` | built `[]` (*guard*) |
| should rebuild module w/ type flip under thread-loader w/ node16 profile (D6) | built `[]`, ESM | built `[a.ts]`, `"commonjs"` |
| should rebuild module w/ type flip between two runs w/ persistent cache w/ nodenext profile (C1) | built `[]`, ESM | second run built `[a.ts]`, `"commonjs"` |
| should rebuild module w/ type flip between two runs w/ persistent cache w/ nodenext ESM check (C2) | rebuilt | rebuilt (*guard*: a `buildInfo`-only implementation fails it) |
| should register no package.json dependency w/o node16/nodenext profile (D3, `esnext`, no `esm`) | none | none in the module's file and missing dependencies, no record in `buildInfo` (*guard*) |

**Keep the watch tests deterministic.** Watch e2e has been flaky here before.

- **Ignore every callback until your edit has been written.** Arm the "awaited" filter only after the write: the
  next result is the first compilation whose `compiler.modifiedFiles` holds the edited path. The runners in
  `webpack-esm-check.test.ts:384-406` and `webpack-loader-resolve-once.test.ts:354-380` arm it **before** the 1 s
  delay. A late second compilation of the previous step would then pass for this step's result. For a
  `package.json` that you edit twice, that is wrong.
- **One `package.json` edit per watch test** where the assertion is "nothing built".
- **Wait 1000 ms after a build before writing**, so the watcher has settled and the mtime differs.
- **Assert "not rebuilt" on the compilation that saw the edit**, never on "no compilation within N s". That
  compilation always happens: webpack watches the project's `package.json` itself (reproduced: `develop`'s
  `compilation.fileDependencies` holds it), and step 7 adds the recorded ones.
- **Assert on `builtModules` and output content, never on timing.**
- **Timeouts and fixtures:**
  - a per-step watchdog of 25 s that prints the modified files and exits with code 2;
  - `spawnSync` timeout = builds × 26 s + 15 s;
  - a Jest timeout of 90 s;
  - a unique `test-output-<name>_<Date.now()>` directory, removed in `afterEach`.
- **For the two-process cache tests,** wait ≥1 s between the runs, so the mtime differs. Call `compiler.close` after
  each `run`, so the cache is stored.
- **Copy, do not import.** Each suite copies its runner. Do not edit the other suites' runners.

The existing suites stay green unchanged. The relevant ones:

- `webpack-esm-check.test.ts`. Its `:253` must still rebuild both modules on a `lib/package.json` flip, which needs
  step 7's `afterCompile` registration. Its `:274` must still rebuild only the module whose missing `package.json`
  appears.
- `webpack-loader-resolve-once.test.ts`.
- `webpack-websmith.test.ts`.

### Release notes and docs

- `Release-Notes.md`, `## [Unreleased]` (`:13`) → `### Changed` (`:19`), one bullet, e.g.:

  > Under `module: node16`/`nodenext`, the webpack loader rebuilds a module in watch mode when the `"type"` of its
  > nearest `package.json` changes, also without the ESM check; before, its output kept the old module format until
  > the module itself changed. The `package.json` files the ESM check reads only for `"type"` no longer rebuild
  > their modules on other edits, e.g. by `npm install`. Under `thread-loader` and with webpack's persistent cache,
  > any edit of such a `package.json` still rebuilds the modules that depend on it.

  Leave Vite out.
- `packages/webpack/README.md`, the ESM check paragraph `:180-186`: the classification's `package.json` files are no
  longer plain dependencies; only a `"type"` change rebuilds. Replace the "**any** edit … `npm install`" sentence:
  that now holds only under `thread-loader` and with `cache: { type: "filesystem" }`, and say why: no loader code
  runs in webpack's process there before the cache is checked.

  Add one short paragraph, e.g. after "Option resolution and addon lifetime" (`:121-135`): under
  `node16`/`nodenext` the loader tracks the nearest `package.json`'s `"type"` of every module, with or without
  `esm`, because it decides the emitted module format.
- No `packages/api`, `packages/compiler` or `packages/core` README change: no flag, config key or addon API changes.

### Done when

The slice line is the specification. These are the assertions a naive implementation would pass without:

- **A `"type"` flip rebuilds the module under watch through the `needBuild` tap**, for a `nodenext` profile without
  `esm` (D1, red on `develop`), and the output changes format.
- **A `"version"` edit rebuilds nothing** with the ESM check under `nodenext` (D2, red on `develop`) and without it
  (guard).
- **A project without node16/nodenext gets no `package.json` dependency** and no `buildInfo` record (D3, guard).
- **The fallbacks:**
  - Under thread-loader a flip rebuilds (D6, red).
  - With the persistent cache, a flip between two processes rebuilds, with and without `esm` (C1 red, C2 guard).
    A `buildInfo`-only implementation fails C2: that is the regression this guard exists for.
- **The ESM check's other `package.json` reads stay plain dependencies:** `webpack-esm-check.test.ts`, its unit
  specs and `check-esm.spec.ts:312` stay green unedited.
- **Gates, all green:** `pnpm lint`, `pnpm build --skip-nx-cache`, `pnpm test --skip-nx-cache`,
  `pnpm test:e2e --skip-nx-cache`. The shared `.nx-cache` replays outputs from other worktrees. Say in the PR
  whether the advisory TS 6.0.3 cell is green.
- **Tests follow `docs/rules/testing.md`:** assemble / act / assert with one blank line between the parts and no
  part comments, `testObj` and `actual` (`target` for observed objects, `whatever` for meaningless values), no shared
  `testObj`. New files carry the MIT header (`pnpm license:add`). Do not add them to the `license:check` list.
- **The PR states:**
  - decision 1, the type-only reads, and why the self-reference and resolution reads stay plain;
  - decision 3, the mechanism per host, with the C1/C2 and thread-loader evidence;
  - that the stamp-file fallback was not needed, and why it would not have helped;
  - the `TsCompiler.spec.ts:347-367` expectation change;
  - Node18/Node20 out of scope;
  - the departure from the plan's "survives the persistent cache".

### Repo mechanics

- **pnpm:** use the corepack-cached pnpm 10.8.0 through a shim. pnpm 10.34's frozen install fails here, and the
  Homebrew pnpm 11 fails with E401.

  ```sh
  mkdir -p "$TMPDIR/pnpm-shim" && printf '#!/bin/sh\nexec corepack pnpm@10.8.0 "$@"\n' > "$TMPDIR/pnpm-shim/pnpm" && chmod +x "$TMPDIR/pnpm-shim/pnpm"
  export PATH="$TMPDIR/pnpm-shim:$HOME/.nvm/versions/node/v22.17.0/bin:$PATH" COREPACK_ENABLE_NETWORK=0 COREPACK_ENABLE_STRICT=0 NX_DAEMON=false
  pnpm install --frozen-lockfile --offline
  ```

  Never edit `pnpm-lock.yaml`, `~/.npmrc` or the root `package.json`. This branch adds no package. If the e2e
  gates leave `test-output-*` importers in `pnpm-lock.yaml`, restore it with `git checkout pnpm-lock.yaml`.
- **webpack-test e2e runs against the built packages:** run `pnpm build --skip-nx-cache` before `pnpm test:e2e`.
  After a core-only edit, `pnpm --filter @quatico/websmith-core build` refreshes what the loader loads.
- **Reproducing by hand:** put fixtures under `packages/webpack-test/test-output-<name>` (git-ignored by
  `test-output*`). Resolve `webpack`, `thread-loader` and `websmith-loader` from `packages/webpack-test`. Remove the
  fixtures afterwards with `trash`.
- **Commits:** Arlo's notation without a colon (`commit-notation` skill), e.g.:
  - `B Rebuilds a module when the "type" of its package.json changes under nodenext`
  - `B Rebuilds no module on package.json edits other than "type"`
  - `t Covers package.json "type" tracking in the webpack loader end to end`
  - `d Documents package.json "type" tracking of the loader`
- **Deleting files:** use `trash`, never `rm`.

### Bookkeeping

- Push the first green commit as soon as it exists.
- Open the PR with `plot-open-pr.sh`, never `gh pr create`, then give it a descriptive title.
- Append `→ #<number>` to the `bug/loader-package-type-deps` line
  (`docs/plans/2026-10-02-loader-options-once.md:259`), before its `<!-- builds: -->` comment, and commit that on
  this branch. Do not edit anything else in the plan.

### Scope guard

This branch owns:

- `packages/core/src/compiler/esm/classify-module.ts`: `createPackageTypeLookup`'s new parameter, the exported
  `readPackageType` and `PackageTypeCallback`;
- `packages/core/src/compiler/esm/check-esm.ts`: `EsmCheckContext.onPackageType` and the lookup at `:116`;
- `packages/core/src/compiler/ModuleCompiler.ts`, limited to:
  - `ModuleBuildResult`;
  - `build`'s dependency collection (`:378-384`, `:447`);
  - the new node16/nodenext lookup;
  - `checkLoaderOutput`'s context (`:514-539`);
- `packages/core/src/compiler/index.ts` (the three exports);
- `packages/webpack/src/loader.ts` (`:33-35` only), `packages/webpack/src/webpack-hooks.ts` (the tap and the
  `afterCompile` registration), the new `packages/webpack/src/package-types.ts`;
- their specs as listed, and the new e2e file;
- `Release-Notes.md` (one bullet), `packages/webpack/README.md` (`:121-135`, `:180-186`), the `→ #<PR>` line in the
  plan.

Do not touch:

- `packages/core/src/compiler/Compiler.ts`: #196 edits it, and the CLI's `registerPackageJsonWatches` keeps
  re-emitting on any change. That is CLI watch behaviour, not this plan.
- `import-rules.ts`, `cjs-names.ts`, `package-type-rules.ts`.
- In `ModuleCompiler.ts`: `takeFileLessErrors`, `labelWithProfile`, `getConfigErrors`,
  `takeUnreportedConfigErrors` and the carrier map (`bug/loader-cached-config-errors`), and the #188 early return
  except its `packageTypes: {}`.
- `loader.ts:40-51` (diagnostics, carrier, unconfigured profile) and `webpack-hooks.ts:58-68` (config-error
  reporting).
- `compiler-instances.ts`, `TsCompiler.ts`, `WebpackAddonService.ts`.
- `packages/vite/**`, `packages/vite-test/**`, `packages/webpack-test/perf/**`.
- Other suites' runners, snapshots, `package.json` files, `pnpm-lock.yaml`, tsconfigs, `.github/`.

### Not in this slice

- **A persistent-cache build that runs no loader registers no websmith hooks.** That is the root of this slice's
  filesystem-cache fallback. It also belongs to `bug/loader-cached-config-errors`. That slice's open review
  follow-ups stay there:
  - a carrier module leaving the graph drops the error (thread-loader);
  - a multi-worker carrier race;
  - the persistent cache may hide dependent file-less errors.

  If that slice ever registers hooks without a loader run, e.g. a loader-registered plugin, the filesystem-cache
  fallback here can switch to `buildInfo`. Do not build that here.
- **The `#177` follow-ups do not touch this slice:**
  - a file profile pulled in only by inline `depends` loses an invalid value silently;
  - the "…in the loader options." wording for non-loader callers;
  - `profiles: undefined` is rejected.

  Leave them.
- **Node18 and Node20 module kinds** (TypeScript 5.8+): `Compiler.ts:1456` does not route them through
  `transpileNodeModule` either.
- **The CLI's `package.json` watch** rebuilds on any edit (`Compiler.ts:972-1008`).
- **Child compilers** of a webpack compiler that run the loader get their own instance. Not covered.

If you find something else the plan did not anticipate, report it in the PR rather than improvising outside scope.
