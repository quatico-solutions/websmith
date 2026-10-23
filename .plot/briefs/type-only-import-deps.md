<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — addon-rebuild-gaps (slice: Type-only imports)

- **Plan (canonical):** `docs/plans/2026-10-16-addon-rebuild-gaps.md` on `develop`
- **Approved:** 2026-10-20, Jan Wloka, plan-PR #213 merged
- **Branch:** `bug/type-only-import-deps` (base: `develop`, at `a1083322` when this brief was written)
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh` (on PATH). Do not merge it yourself.
- **Review of the code:** an independent review, plus uncached gates run by the maintainer's session before merge

**Ordering.** This is the plan's third slice. `## Slices` runs one branch per `###` heading, in heading order, one
slice per wave: "Stale output" (`bug/file-cache-update-source`), then "noEmit in bundler hosts"
(`bug/bundler-no-emit`), then this one, then "Build watch" (`bug/vite-build-watch-reload`). **Start only after the
first two merged**, from the `develop` that holds them. "Build watch" carries `<!-- waits: bug/type-only-import-deps
-->`: it adds its watch files beside yours in `transformHandler`, so keep the forwarding where it is (below).

Line numbers below are from `develop` at `a1083322`. Neither earlier slice existed when this brief was written; find
the code by name if it moved.

### What the earlier slices leave for you

Read both merged PRs before you start.

- **Stale output (`bug/file-cache-update-source`)** changes `FileCache.updateSource` (`cache/FileCache.ts:37-49`) to
  compare content. It does **not** touch the cache entries of files that were never built, which is what item 6 of
  "Plan vs. `develop`" is about. Its brief also asks it to add an opt-in to the `ModuleCompiler.spec.ts` helpers
  (`createAddons`/`createModuleCompiler`, `:17-40`), e.g. `{ typeInfo: true }`, that gives the addons
  `needsTypeInfo: true` and the loader options `transpileOnly: false`. **Reuse it if it merged; add it if not.** It
  also edits `packages/vite/README.md` "Dev server" (`:195-197`, keeping the type-only sentences for you), deletes
  the `addAssetDependency` bullet in "Known limits" (`:246-247`) and adds a bullet at the end of `Release-Notes.md`
  `### Fixed`.
- **noEmit in bundler hosts (`bug/bundler-no-emit`)** changes option resolution in `packages/webpack` and
  `packages/vite`, the README "Configuration" sections, and may add a tsconfig helper to
  `packages/vite-test/tests/vite-project.ts` and fixtures to `packages/webpack-test`. No overlap with your logic.
  Check one thing: if it routes the target's emit around `noEmit`/`emitDeclarationOnly` through a new branch of
  `Compiler.transpileInternal`, your Program capture (item 1 of "What to build") must cover that branch too.
- **Conflicts** are likely only in `Release-Notes.md` and `packages/vite/README.md`. Keep every entry.

### Current behaviour

Reproduced on `a1083322` in a scratch worktree, Node 22.17.0, TypeScript 6.0.3 (the pinned dev version) and, for the
API check, 5.7.3. Each item says whether it was **run** or **read**.

- **Core returns no type dependency (read).** `ModuleCompiler.build` (`ModuleCompiler.ts:388-494`) fills
  `dependencies` (`:411`) only through `onDependency`: the package-type lookup (`:424-426`) and the ESM check
  (`checkLoaderOutput`, `:445`, `:480`). Nothing reads the Program.
- **Both hosts already forward `dependencies.files` (read).** The loader: `loader.ts:35`
  (`this.addDependency`), covered by `loader.spec.ts:482`. The Vite plugin: `hooks.ts:517-518`, through the
  `addWatchFile` helper (`:254-259`), which records each file in `watchFiles` (`:247`) in serve mode; covered by
  `hooks.spec.ts:315`. **So this slice needs no forwarding code in either host.** It needs one guard fix in the Vite
  plugin (item 4 of "Plan vs. `develop`").
- **When a Program exists (read).** `Compiler.transpileInternal` (`Compiler.ts:1305-1403`):
  - `transpileOnly`, or `shouldUseTranspileModuleFastPath` (`:764-773`: no addon needs type info, and no
    `declaration` or `transpileOnly`), takes `ts.transpileModule` (`:1315`). No Program.
  - An addon that needs type info, with `declaration`: the language service (`:1335-1386`, "Case 4").
  - No addon that needs type info, with `declaration`: `transpileSourceCode` (`:1388-1392`, `:1439-1552`), which builds
    **a new per-file Program** with `ts.createCompilerHost` for each emit (`:1452-1483`, "Case 3"). It reads every
    imported file from the real disk, not from the injected `ts.System`.
  - An addon that needs type info, without `declaration`: the language service (`:1394-1402`).
  - `anyAddonNeedsTypeInfo` (`:743-753`) is false without an `AddonRegistry`. **The loader passes none**
    (`TsCompiler.ts:50-53`), so in the loader a Program exists only with `declaration: true` and without
    `transpileOnly` (Case 3). The Vite plugin passes one (`hooks.ts:130-138`); its addons need type info unless they
    set `needsTypeInfo: false`.
- **The loader reports no type errors at all (run).** The diagnostics of the Program paths are syntactic plus, on
  Case 3, the emit's (declaration) diagnostics (`:1483-1491`, `:1395-1401`). Nothing calls `getSemanticDiagnostics`
  in core except `editing/edit-check.ts`. A webpack build of `export const v: string = make();` with `make: () =>
  { a: number }` passes without an error, with and without `declaration: true`. The Vite README says the same
  (`packages/vite/README.md:117-118`).
- **A type-only edit can still change a loader diagnostic (run).** With `declaration: true`, `transpileOnly: false`:

  ```ts
  // src/main.ts
  import type { Make } from "./types";
  import { b } from "./b";
  declare const make: Make;
  export const v = make();
  export const w = b;
  // src/types.ts, GOOD
  export interface Hidden { a: number }
  export type Make = () => Hidden;
  // src/types.ts, BAD: `interface Hidden` without export
  ```

  With BAD the loader reports on `main.ts`: "Exported variable 'v' has or is using name 'Hidden' from external
  module ".../src/types" but cannot be named." (TS4023, a declaration emit error); with GOOD nothing. `tsc` gives the
  same.
- **A type-only edit rebuilds nothing in webpack watch mode (run).** Same fixture, `compiler.watch`:

  | # | Start | Edit | Result on `a1083322` |
  |---|---|---|---|
  | 1 | GOOD | `types.ts` → BAD | **no compilation** within 8 s; `main.ts`'s snapshot holds only `src/main.ts`, `tsconfig.json`, `websmith.config.json` |
  | 2 | BAD (TS4023 reported) | `types.ts` → GOOD | **no compilation**; the error would stay until `main.ts` changes |
  | 3 | GOOD | `b.ts` (a value import) | a compilation that builds `b.ts` only (**guard**) |

  So the plan's open point holds: the loader e2e stays (see "Settled decisions").
- **A type-only edit reloads nothing in the Vite dev server (run).** Profile `app` with a legacy processor addon,
  `main.ts` = `import type { Greeting } from "./barrel"`, `barrel.ts` = `export * from "./types"`. After `GET
  /src/main.ts`, an edit of `src/types.ts` sends no payload within 10 s, on Vite 7.3.7 and 6.4.4. The same as
  dev-server brief row 17 and dev-invalidation brief row 14 (`.plot/briefs/vite-plugin-dev-server.md`,
  `.plot/briefs/vite-plugin-dev-invalidation.md`), now with `hotUpdate` in place.
- **A prototype fixes the Vite case (run).** Patching the built `ModuleCompiler.build` to add, after the target emit,
  the transitive project imports of the module from `getLanguageService().getProgram()` (checker-based walk, see
  item 2 of "What to build") gave a `full-reload` with `triggeredBy` `src/types.ts`, through the barrel, on both
  majors. `vite-dev-server.test.ts` and `vite-dev-invalidation.test.ts` passed with the patch (58/58). The patch
  was reverted.
- **The language service keeps the old types (run).** Built core, real disk, profile with one legacy addon and
  `declaration: true` (Case 4). Build `main.ts` (`export const v = make()` with `Make = () => { a: number }`), edit
  `types.ts` to `a: string` with a newer mtime, build `main.ts` again: the `.d.ts` still says `a: number`. Without the
  addon (Case 3, per-file Program) the second build says `a: string`. Cause (read):
  `CompilationContext.createLanguageServiceHost` (`compilation/CompilationContext.ts:448-492`) versions a file by its
  `FileCache` version (`:459-463`). A file that was never built gets an empty entry (`createCacheEntry`, `:486`) whose
  version stays 0, so the language service never re-reads it. See item 6 of "Plan vs. `develop`".
- **The benchmark measures nothing for this slice (read, then run).** `packages/webpack-test/perf/esm-watch-bench.cjs`
  (`pnpm perf:esm` in `packages/webpack-test`) runs the loader with `transpileOnly: true` (`:219`) and no
  `declaration` (`:157-160`). No Program, so the new code never runs. A copy with `transpileOnly: false` and
  `declaration: true` ran on `a1083322`: see item 3 of "Plan vs. `develop`" for the numbers.

### Plan vs. `develop`

The plan is frozen; these narrow how, not what.

1. **"A Program exists: no `transpileOnly`, or an addon with `needsTypeInfo`."** The rule on `develop` is: a Program
   exists when `transpileOnly` is off **and** (an addon of the registry needs type info **or** `declaration` is
   true). `transpileOnly` with a type-info addon has no Program. In the loader only `declaration: true` gives one.
   Resolution: implement "a Program was used for this emit", whatever path chose it (item 1 of "What to build"), and
   say the precise rule in the README and the Release-Notes.
2. **"Its e2e asserts that a type error caused by an edit of `types.ts` appears in the watch rebuild."** The loader
   reports no type errors (TS2322 and the like), only syntax and declaration emit errors. Resolution: the e2e's
   "type error" is the declaration emit error TS4023 above, with `declaration: true` and `transpileOnly: false`. That
   is a diagnostic, which the plan's Notes require ("asserts a diagnostic, not a type-aware addon's output").
3. **"The bench … 1000-module initial build at most 5% slower."** As shipped the bench has no Program (above).
   Resolution: add an option `--declaration` to `esm-watch-bench.cjs` that writes `declaration: true` into the
   fixture's `tsconfig.json` and passes `transpileOnly: false`, and gate on variant A's initial build with it. Run
   the **same** script against `develop`'s build (copy it into a `develop` worktree), since `develop`'s copy has no
   such option. Measured on `a1083322`, one process, 1000 modules, a busy machine (indicative only): variant A initial build
   15.2 s as shipped, **244 s** with `declaration: true` and no `transpileOnly` (edit median 410 ms). Case 3 builds a
   per-file Program per module, so the type-information build is already slow; the 5% budget is about 12 s of it.
   Expect a full gate run to take well over an hour (3 variants × 5 processes × 3 runs per side); variant A alone
   decides the gate, so you may run it with `--processes 3` or add a variant filter to the script; say which in the PR.
4. **"Records them as its own watch files, so the dev-invalidation write guard keeps working."** That holds, but
   recording more files has a side effect (read, not run). `hotUpdate` answers an own write with `input.modules`
   minus every node whose file is in `watchFiles` (`hooks.ts:646-648`). A generated module that the page imports,
   e.g. `src/gen/index.ts`, is now in the importer's closure, so it lands in `watchFiles`, and an own write of it
   drops **its own module node**. Vite then sends no update for it: the regression of dev-invalidation row 18 ("a
   module a generator writes and the page imports reloads as usual"). No e2e covers row 18; only
   `hooks.spec.ts:1891-1897` does, with a stub that never lists the generated module as a dependency, so the
   prototype run above stayed green. Resolution: keep a node whose file is a module the plugin compiles
   (`isCompiledId(cur.file, filter)`), see item 4 of "What to build".
5. **"The Program's source files that are not modules … are added to every typed module."** A file such as
   `types/global.ts` = `export {}; declare global { interface Window { … } }` is a module (`ts.isExternalModule` is
   true; run), so the literal rule misses it, although the plan's Design lists `declare global` and `declare module`
   augmentations as sources. Resolution, recommended: also add a project module whose top-level statements contain
   a `declare global` or a `declare module "…"` (string name). One statement scan per file. **Confirmed by the
   maintainer on 2026-10-21: build it.**
6. **Stale language-service view (item "The language service keeps the old types" above).** With this slice, a
   type-only edit makes the Vite plugin rebuild the importer, but on the
   language-service path the rebuild still sees the old `types.ts`: a stale `.d.ts`, a stale declaration error. The
   loader is not affected (Case 3 reads from disk). This is not in the slice line. **Decided by the maintainer on 2026-10-21: build (b) here**, with a red `FileCache` unit test for the new
   method and a Vite dev-server e2e asserting that the reloaded module's type-aware output (e.g. the `.d.ts`) holds
   the new type. Rejected: (a) reporting it only.
   - (a) not built: report it under "Found, not built"; **rejected**;
   - (b) built here: before the target emit, bump the `FileCache` version of each file of the module's previous
     dependency set that has no snapshot (was never built) and whose mtime is newer than when it was last seen
     (a new `FileCache` method, e.g. `refreshUnbuilt(fileName)`), so the language service re-reads it. Cost: one
     `getModifiedTime` per closure file per build. Not per `getScriptVersion` call, which runs for every root file
     on every emit.

### What to build

Core does the work. Each host keeps forwarding as it does today.

**1. Capture the Program of each emit** (`Compiler.ts`, `ModuleCompiler.ts`).

- Add a no-op protected hook to `Compiler`, e.g. `protected onTypeCheckProgram(fileName: string, getProgram: () =>
  ts.Program | undefined): void {}`. Pass a thunk, so the CLI's `Compiler` (which keeps the no-op) never pays for
  `getProgram()`.
- Call it where a Program was used for the emit:
  - both language-service branches of `transpileInternal` (`:1335-1386` and `:1394-1402`), with `() =>
    langService.getProgram()`;
  - Case 3's declaration branch of `transpileSourceCode` (`:1439-1552`), with the Program of the emit whose output is
    returned (`emitWithTransformers(ctx.getTransformers())`; the transformer-less baseline Program reads the same
    files). Return the Program from `emitWithTransformers` for that.
  - **Not** on the fast path, and not for `transpileNodeModule`'s or the syntax check's single-file Programs
    (`:1639`, `:1668`): those set `noResolve` and carry no type information.
- `ModuleCompiler` overrides the hook while `build` runs and collects, for every emit of the build (the dependent
  profiles at `:436` and the target at `:467`), the dependencies of `filePath` in that Program (item 2). Union them
  into `dependencies.files` before the return (`:489-493`). A dependent profile with `declaration: true` writes a
  `.d.ts` that depends on the types too, so its Program counts even when the target takes the fast path.
- Without any Program in the build, nothing is added.

**2. Compute the type dependencies of one module from a Program.** A new module, e.g.
`packages/core/src/compiler/type-dependencies.ts`, with its own spec. Public TypeScript API only, which the repo
keeps to (`Compiler.ts:1316`): `program.getResolvedModule` and `SourceFile.imports` exist at runtime in 5.7.3 and
6.0.3 but in neither `.d.ts` (checked).

- **Project file:** a source file of the Program for which `program.isSourceFileDefaultLibrary(file)` is false and
  whose path has no `node_modules` segment. A `paths` alias target and a referenced project's `.d.ts` outside
  `node_modules` count (plan).
- **Edges of one file:** the files its module specifiers resolve to, through the Program's own resolution:
  `program.getTypeChecker().getSymbolAtLocation(specifier)?.declarations?.[0]?.getSourceFile()`. Specifiers:
  - `ImportDeclaration` and `ExportDeclaration` with a `moduleSpecifier` (covers `import type`, `export * from`,
    `export type { … } from`);
  - `ImportEqualsDeclaration` with an `ExternalModuleReference`;
  - `ImportTypeNode` (`import("./x").T`) and `import("./x")` calls, which need a walk into the file. Walk only when
    `file.text` contains `import(` (cheap prefilter);
  - `file.referencedFiles` (`/// <reference path>`), resolved against the file's directory and looked up with
    `program.getSourceFile`.

  The checker exists on both Program paths already (the emit created it), and `getSymbolAtLocation` on a specifier
  resolves the module without checking the file.
- **Closure:** breadth-first from `program.getSourceFile(filePath)` over edges into project files. Do not list the
  module's own file.
- **Global files:** every project file that is not a module (`!ts.isExternalModule(file)`: ambient `.d.ts`, global
  scripts from `include`, `types`, `typeRoots`), plus, if confirmed, modules with a top-level augmentation (item 5
  of "Plan vs. `develop`"). Compute once per Program (`WeakMap<ts.Program, string[]>`).
- **Memo:** edges per `ts.SourceFile` in a `WeakMap`. The language service reuses unchanged `SourceFile` objects
  across emits, so the Vite path walks each file once per version. Case 3 parses every file anew per module, so the
  memo does not hit there. Measure first (item 6). If the gate fails, cache edges per compilation, keyed by file name
  and checked against `file.text`, in `ModuleCompiler.compilationCaches` (cleared per webpack compilation and per
  build without compilation hooks, `:404-408`). That is the plan's "import graph cached per compilation".
- Verified with a script against TypeScript 5.7.3 and 6.0.3: for `main.ts` importing `import type` from `./types`,
  `./barrel` (`export * from "./inner"`), `@lib/alias` (`paths`), `import("./itype").I` and the package `dep` in
  `node_modules`, the closure was `types.ts`, `barrel.ts`, `lib/alias.ts`, `itype.ts`, `inner.ts`; the global files
  were `types/ambient.d.ts`; `node_modules/dep` and `lib.*.d.ts` were left out; `src/unrelated.ts` was not listed.

**3. Document the result type** (`ModuleCompiler.ts:28-38`). Extend the JSDoc of `ModuleBuildResult.dependencies`:
with a Program, `files` also holds the project files the module's type check read (its transitive imports and the
global files), never `lib*.d.ts` or files under `node_modules`.

**4. The Vite write guard** (`packages/vite/src/hooks.ts:646-648`). On an own write, keep a node whose `file` is a
module the plugin compiles:

```ts
return input.modules.filter(cur => cur.file === null || !watchFiles.has(toFileKey(cur.file)) || isCompiledId(cur.file, filter));
```

Do not move or split the forwarding at `:517-518`: "Build watch" adds its files there. `watchFiles` stays serve-only.

**5. The benchmark** (`packages/webpack-test/perf/esm-watch-bench.cjs`). Add `--declaration` (default off, so
existing runs keep their meaning). It sets `declaration: true` in the fixture's `tsconfig.json` (`:156-161`) and
`transpileOnly: false` in the loader options (`:219`). Document it in the header comment, with the gate of this
slice. No other change to the script.

**6. Measure.** Baseline and branch, as the header says (`:35-43`), but with `--declaration`:
`pnpm perf:esm --modules 1000 --processes 5 --declaration`, three runs on each side, median of the three variant-A
"Initial build" medians. Gate: branch ≤ 1.05 × `develop`. If over, add the per-compilation cache (item 2) and measure
again. Also put the edit scenario's "modules built" in the PR: with a Program, an edit of a leaf now rebuilds its
importers up the tree (about 10 modules in the 1000-module binary tree), which is the plan's accepted result
("An edit of a shared types file still rebuilds all its importers").

**7. Docs.**

- `packages/vite/README.md`, "Dev server", the bullet at `:195-197` (after "Stale output" edited its last sentence):
  replace the type-only sentences with what holds: an edit of a file that a module imports only for its types, also
  through re-exports, reloads the module when it is compiled with type information (an addon that needs it, or
  `declaration: true`; not under `transpileOnly`). An edit of an ambient `.d.ts` or global script of the project
  reloads every such module.
- `packages/vite/README.md`, "Known limits": delete `:245` ("**An edit to a type-only import** does not reload its
  importer"). If item 6 of "Plan vs. `develop`" stays unbuilt, add instead: with an addon that needs type information,
  the reloaded module can keep declaration output of the old types.
- `packages/vite/README.md:248` ("The watched files … only grow during a long dev server session") still holds; the
  set grows faster now. Leave the line.
- `packages/webpack/README.md`, "Option resolution and addon lifetime" (`:126-140`) or a new short paragraph next to
  it: with `declaration: true` and without `transpileOnly`, a module also depends on the project files its type check
  reads, so in watch mode an edit of a type-only import rebuilds it and updates its declaration errors.
- `docs/rules/architecture.md:155-157` ("Dependency tracking and caching"): one clause that, with a Program, the
  loader also adds the module's type dependencies.
- `Release-Notes.md`, `## [Unreleased]` → `### Fixed`: one bullet at the end (after "Stale output"'s), e.g.: "In
  watch mode, the webpack loader rebuilds a module when a file it imports only for types changes (`import type`, also
  through re-exports and `paths` aliases), and the Vite plugin's dev server reloads it, when the module is compiled
  with type information: with `declaration: true`, or in the Vite plugin with an addon that needs type information,
  and never under `transpileOnly`. Before, such an edit rebuilt nothing, so a declaration error such as TS4023 did
  not appear or did not clear. An edit of a project's ambient `.d.ts` rebuilds every such module." The Vite package
  is unreleased; do not edit its `### Added` bullet.

### Done when

The slice line is the specification. It asks for:

- "Core returns, for a module compiled with type information, the project source files its type check depends on
  (transitive imports, `lib*.d.ts` and `node_modules` excluded) in `dependencies.files`";
- "the loader and the Vite plugin forward them";
- "unit tests in `ModuleCompiler.spec.ts` (type-only import listed with a Program, a type re-exported through a
  barrel listed, nothing listed under `transpileOnly`)";
- "e2e: in webpack watch mode an edit of a type-only import makes a type error appear on the importer and reverting
  it clears the error (reproduce first), and a Vite dev-server edit of `src/types.ts` reloads `main.ts`";
- "README known-limit lines removed; Release-Notes entry; bench numbers in the PR".

Write each test red first and run it against the unfixed code. Cases marked **guard** pass on `develop`; keep them
and say so in the PR.

**Unit, `packages/core/src/compiler/ModuleCompiler.spec.ts`**, new `describe("ModuleCompiler type dependencies")`.
Virtual system and the type-info opt-in (language-service path) unless noted. Assert with `expect.arrayContaining`
or on a sorted, filtered list, since the ESM check may add `package.json` files.

- **red:** "yields type-only import as dependency w/ type info". `/src/a.ts` = `import type { T } from "./types";
  export const a: T = 1;`, `/src/types.ts` = `export type T = number;`. `files` contains `/src/types.ts`.
- **red:** "yields barrel and re-exported file as dependencies w/ type info". `a.ts` imports a type from `./barrel`,
  `barrel.ts` = `export * from "./types";`. `files` contains `/src/barrel.ts` and `/src/types.ts`.
- **red:** "yields ambient declaration file as dependency w/ type info". `/src/globals.d.ts` = `declare const G:
  number;`, not imported. `files` contains it.
- **red** (if item 5 is confirmed): "yields module with global augmentation as dependency w/ type info".
- **red:** "yields path alias target as dependency w/ type info" (`paths: { "@lib/*": ["/src/lib/*"] }`).
- **guard:** "yields no type dependencies w/ transpileOnly". The existing helper defaults; `files` is `[]`. This is
  the slice line's "nothing listed under `transpileOnly`".
- **guards:** "yields no unrelated project file w/ type info" (`/src/unrelated.ts` not listed),
  "yields no own file w/ type info", "yields no node_modules or lib file w/ type info" (`/node_modules/dep/index.d.ts`
  imported by `a.ts` is not listed; no entry matches `/lib\.[^/]*\.d\.ts$/`).
- **red, real disk:** "yields type-only import as dependency w/ declaration w/o type-info addon". Case 3 reads the
  real disk (`ts.createCompilerHost`), so a virtual system cannot test it. Use a temp directory
  (`fs.mkdtempSync(path.join(os.tmpdir(), "websmith-type-deps-"))`) and `ts.sys`, removed in `afterEach`.
- **red, real disk:** "yields type dependency of dependent profile w/ declaration and fast-path target".

**Unit, the new `type-dependencies.spec.ts`**: the closure and the global files on a hand-built `ts.createProgram`
over a virtual host (barrel, `import("./x")` type, `/// <reference path>`, `node_modules` file, script file). Keep
it small; `ModuleCompiler.spec.ts` carries the contract.

**Unit, `packages/vite/src/hooks.spec.ts`**, in `describe("own writes")` (`:1857`):

- **red:** "should keep compiled module that is a watch file of plugin w/ own write". Like `createWriting`, but the
  build returns `dependencies.files` `[GEN, GENERATED]`; `hotUpdate` of `GENERATED` with its own text returns
  `[{ file: GENERATED }]`. Today it returns `[]`.
- The existing "should return modules without watch files of plugin w/ own write" stays green (**guard**).
- No new forwarding test: `loader.spec.ts:482` and `hooks.spec.ts:315` already cover it. Name them in the PR.

**E2E, webpack** — a new `packages/webpack-test/tests/webpack-loader-type-only-import.test.ts`. Model the watch
harness on `webpack-loader-package-type.test.ts:170-280` (separate Node process, one JSON line per compilation,
watchdog), extended to a sequence of edits. Loader options `transpileOnly: false`; `tsconfig.json` with
`declaration: true`, `strict`, `rootDir: src`, `outDir: tsout`; `websmith.config.json` `{ "profiles": { "target":
{} } }`; the fixture of "Current behaviour". Report per compilation the built modules and the module errors.

- **red:** "should report declaration error on importer w/ edit of type-only import under watch". Start GOOD, edit
  `types.ts` to BAD. The second compilation builds `main.ts`, and its errors contain "has or is using name 'Hidden'".
- **red:** "should clear declaration error w/ revert of type-only import under watch". GOOD → BAD → GOOD: the third
  compilation has no error. (Plan: "reverting it clears the error".)
- **red:** "should rebuild importer w/ edit of type re-exported through barrel under watch". `main.ts` imports
  `Make` from `./barrel`, `barrel.ts` = `export * from "./types"`.
- **guard:** "should register no type dependency w/ transpileOnly". One `compiler.run`; `main.ts`'s
  `buildInfo.snapshot.getFileIterable()` holds no `src/types.ts`. Deterministic, no watchdog.
- **red:** "should register no node_modules or lib file as dependency". One run with `declaration: true`; the
  snapshot holds `src/types.ts` and no path containing `node_modules`.
- 90 s timeout per test, as in the model.

**E2E, Vite** — in `packages/vite-test/tests/vite-dev-server.test.ts`, next to "should reload the importer w/ edit
of an imported file" (`:104-123`), `it.each(VITES)`, 60 s:

- **red:** "should reload the importer w/ edit of a type-only import w/ %s". Add `src/types.ts` = `export type Greeting
  = string;` and `src/barrel.ts` = `export * from "./types";` to the fixture, and let `main.ts` import `type {
  Greeting } from "./barrel"`. Steps: `GET /src/main.ts`; `edit("src/types.ts", "export type Greeting = string |
  number;\n", <full-reload or update whose triggeredBy ends in src/types.ts>)` (copy `reloadOf` from
  `vite-dev-invalidation.test.ts:76-77`); `GET /src/main.ts`. Assert no timeouts, one such payload, and 200. The
  run above is this test's red result on `a1083322` (timeout on the edit, both majors).
- **guard:** the existing value-import test stays as is.
- Run `vite-dev-server.test.ts` and `vite-dev-invalidation.test.ts` 5 times in a row each and report "5/5 green, N
  tests each" in the PR.

**Also:**

- New files carry the MIT header (`pnpm license:add`). Do not add them to the `license:check` list.
- No `console` in production code.
- Gates, all green: `pnpm lint`, `pnpm build --skip-nx-cache`, `pnpm test --skip-nx-cache`, `pnpm test:e2e
  --skip-nx-cache` on Node 22 (`$HOME/.nvm/versions/node/v22.17.0/bin`). Run `packages/vite-test` and the new
  webpack e2e file once more on Node 24.21.0 (`$HOME/.nvm/versions/node/v24.21.0/bin`). On Node 24, run webpack-test
  files one at a time: a full in-band run segfaults locally.
- CI has a `dist (24, typescript 5.7.3)` cell. The closure uses only public API present in 5.7.3; the unit tests must
  not depend on a TypeScript 6-only option.

### Settled decisions — do not re-derive them

- **This branch runs third.** Plan `## Slices` order; "Stale output" and "noEmit in bundler hosts" merged first.
- **Transitive project imports, not direct imports and not every Program file.** Direct imports miss barrels; every
  Program file rebuilds every typed module on any edit (plan Notes, round 3).
- **Global files are added to every typed module:** ambient `.d.ts`, `declare global`/`declare module`
  augmentations, global scripts from `include`, `types`, `typeRoots` (plan Design).
- **"Project file" = a Program source file outside `node_modules`, whatever resolved it.** `paths` aliases and a
  referenced project's `.d.ts` outside `node_modules` count (plan Design).
- **Without a Program, nothing is added.** The output cannot depend on types then (plan Design).
- **An edit of a shared types file rebuilds all its importers.** Correct, and gated by the 5% initial-build budget,
  else the import graph is cached per compilation (plan Design).
- **The loader e2e asserts a diagnostic, not a type-aware addon's output** (plan Notes). Here: TS4023.
- **The loader e2e stays.** The open point "reproduce first" is answered: a type-only edit rebuilds nothing in
  webpack watch mode today (rows 1-2 above). Tick the open point in the PR, not in the plan.
- **Maintainer decisions of 2026-10-21:** build the unbuilt-file version bump (item 6 (b)); count module files with
  `declare global` or `declare module "…"` as global files (item 5); fix the own-write guard in `hooks.ts` in this
  slice (item 4) and add a dev-invalidation e2e for row 18 as a guard: a generated module the page imports still
  gets Vite's update after an own write.
- **The hosts' forwarding stays where it is.** `loader.ts:35` and `hooks.ts:517-518`; "Build watch" builds on the
  latter.

### Repo mechanics

- **Worktree setup.** pnpm 10.34 refuses frozen installs in this repo, so use the corepack-cached 10.8.0 through a
  shim:

  ```sh
  mkdir -p /tmp/pnpm-shim && printf '#!/bin/sh\nexec corepack pnpm@10.8.0 "$@"\n' > /tmp/pnpm-shim/pnpm && chmod +x /tmp/pnpm-shim/pnpm
  export PATH=/tmp/pnpm-shim:$HOME/.nvm/versions/node/v22.17.0/bin:$PATH COREPACK_ENABLE_NETWORK=0 COREPACK_ENABLE_STRICT=0 NX_DAEMON=false
  pnpm install --frozen-lockfile --offline && pnpm build --skip-nx-cache
  ```

  No dependency is added. Never edit `pnpm-lock.yaml`, `~/.npmrc` or the root `package.json`.
- **Fixtures by hand:** under `packages/webpack-test/test-output-<name>` or `packages/vite-test/test-output-<name>`
  (git-ignored; `webpack`, `websmith-loader`, `vite`, `vite6` resolve from there). `pnpm-workspace.yaml` globs
  `packages/**`, so a leftover `package.json` there joins the workspace and the next install writes it into
  `pnpm-lock.yaml`. If that happens, `git checkout -- pnpm-lock.yaml`. Remove fixtures with `trash`.
- **Merges:** `git -c rerere.enabled=false merge …` if you need `develop` in your branch.
- **Known flaky, not yours:** `webpack-loader-resolve-once.test.ts` "emits output of edited tsconfig.json" and
  `webpack-esm-check.test.ts` "rebuilds exactly the edited leaf module". Re-run; if one fails twice, report it in the
  PR. Do not change them. Both run with `transpileOnly: true`, so this slice should not move them; if one starts
  failing reliably, that is a finding.
- **Commits:** Arlo's notation without a colon (`commit-notation` skill). A suggested split:
  - `t Adds a declaration option to the ESM watch benchmark`;
  - `F Lists the files a module's type check reads as its dependencies`;
  - `B Keeps the update of a compiled module the Vite plugin wrote`;
  - `t Covers type-only import edits in webpack watch mode and the Vite dev server`;
  - `d Documents rebuilds after type-only import edits`.
- **Deleting files:** `trash`, never `rm`.

### Bookkeeping

- Push the first real commit as soon as it exists.
- Open the PR with `plot-open-pr.sh`, never `gh pr create`. Its title comes from the wave heading, "Type-only
  imports".
- Append ` → #<number>` to the end of the line `### Type-only imports (Branch: bug/type-only-import-deps) <!--
  builds: type-check dependencies in ModuleBuildResult -->` in `docs/plans/2026-10-16-addon-rebuild-gaps.md`, and
  commit that on this branch. Change nothing else in the plan.
- PR body sections:
  - what changed;
  - "Plan vs. develop": items 1-6 above and the answers to 5 and 6;
  - "How it was verified": the red runs on the unfixed code, the bench commands and both sides' numbers (variant A
    initial medians, and the edit scenario's modules built), the 5× Vite runs, the Node 24 runs;
  - "Found, not built": item 6 if not built, and what "Not in this slice" you tripped over.

### Scope guard

This branch owns:

- `packages/core/src/compiler/**` (`Compiler.ts`, `ModuleCompiler.ts`, the new type-dependency module and specs);
- `packages/vite/src/hooks.ts` (the guard filter only) and `hooks.spec.ts`;
- `packages/webpack-test/tests/webpack-loader-type-only-import.test.ts`, `packages/webpack-test/perf/esm-watch-bench.cjs`;
- `packages/vite-test/tests/vite-dev-server.test.ts`, and `vite-dev-invalidation.test.ts` (the row 18 guard only);
- `packages/vite/README.md`, `packages/webpack/README.md`, `docs/rules/architecture.md`, one Release-Notes bullet, and
  the ` → #<PR>` on the plan heading.

Do not touch:

- `packages/api/**`: no API change; `AddonContext` gains nothing;
- `packages/webpack/src/**`: the loader already forwards;
- the CLI path (`Compiler.compile`, `packages/compiler/**`): the hook is a no-op there;
- `.github/**`, the root `package.json`, `pnpm-lock.yaml`.

### Not in this slice

Each was checked on `a1083322`. Mention any you trip over in the PR; do not build them.

- **The loader does not type-check.** No semantic diagnostics in the loader or the Vite plugin (documented).
  Owner: none; out of this plan.
- **Case 3 ignores the injected `ts.System`.** `transpileSourceCode` builds its per-file Program with
  `ts.createCompilerHost`, which reads the real disk (`Compiler.ts:1456-1466`). It is why the Case 3 unit tests need a
  temp directory. Report it.
- **`vite build --watch`.** The type dependencies become watch files there too (`addWatchFile` in `transform`), so a
  type-only edit rebuilds the importer under `vite build --watch` as well. Not asserted here; "Build watch" owns that
  mode.
- **Watch-file growth in a long dev-server session** (README `:248`): more files per module now. Unchanged rule.
- **Webpack's persistent cache** snapshots every file dependency, so a cached module now also checks its type
  dependencies. Correct, and a little more snapshot work; no test here.
