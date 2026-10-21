<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

## Implementation brief — addon-rebuild-gaps (slice: noEmit in bundler hosts)

- **Plan (canonical):** `docs/plans/2026-10-16-addon-rebuild-gaps.md` on `develop`
- **Approved:** 2026-10-20, Jan Wloka, plan-PR #213 merged
- **Branch:** `bug/bundler-no-emit` (base: `develop`, at `a1083322` when this brief was written)
- **Ends as:** one PR to `develop`, opened with `plot-open-pr.sh` (on PATH). Do not merge it yourself.
- **Review of the code:** an independent review, plus uncached gates run by the maintainer's session before merge

**Ordering.** This is the plan's second slice. `## Slices` runs one slice per wave, in heading order: "Stale output"
(`bug/file-cache-update-source`), then this one, then "Type-only imports" (`bug/type-only-import-deps`), then
"Build watch" (`bug/vite-build-watch-reload`). Create this branch from `develop` **after "Stale output" has merged**.
That slice changes `packages/core/src/compiler/cache/FileCache.ts`, adds e2e cases to `vite-test`, `webpack-test`
and `compiler-test`, removes the `addAssetDependency` known-limit lines from `packages/vite/README.md` (next to the
lines this slice edits) and adds a `Release-Notes.md` bullet. Keep its bullet and yours; take its README text and
edit yours around it. "Type-only imports" comes after you and will meet your `ModuleCompiler.ts` changes and your
Release-Notes bullet.

Line numbers below are from `develop` at `a1083322`. If they moved, find the code by name.

### Current behaviour

Every row below was **run** on `a1083322` (built with the shim below, Node 22.17.0, TypeScript 6.0.3). Each fixture
had addon `replacer` (`MARK_IN` → `MARK_OUT`), `src/main.ts` importing `src/dep.ts`, and a profile `app`. The webpack
fixtures ran webpack in-process with **the project as working directory**. The Vite fixtures ran `vite.build`
(`write: false`) or a dev server's `transformRequest`. "Vite template tsconfig" is the `compilerOptions` of
`create-vite`'s `tsconfig.app.json`: `noEmit`, `allowImportingTsExtensions`, `moduleResolution: "bundler"`,
`verbatimModuleSyntax`, `types: ["vite/client"]`, no `outDir`, no `rootDir`, `.ts` import specifiers.

| # | Host, path | Config | Result on `a1083322` |
|---|---|---|---|
| 1 | Vite 7 build, type info (addon without `needsTypeInfo: false`) | Vite template | Bundle has `MARK_IN` for both modules. No error, no warning. Nothing written. |
| 2 | Vite 6 build, same | Vite template | Same as 1. |
| 3 | Vite 7 dev `transformRequest`, same | Vite template | Same as 1. |
| 4 | Vite build, `transpileOnly: true` | Vite template | Bundle has `MARK_OUT`, but `src/main.js`, `src/main.js.map`, `src/dep.js(.map)` are **written beside the sources**, despite `noEmit`. |
| 5 | Vite build, fast path (`needsTypeInfo: false`) | Vite template | Same as 4. |
| 6 | Vite build, type info | `tsconfig.base.json` has `noEmit`; `tsconfig.json` `extends` it | Same as 1 (`MARK_IN`). |
| 7 | Vite build, type info | `emitDeclarationOnly` + `declaration`, no `outDir` | Bundle `MARK_IN`; `src/main.d.ts`, `src/dep.d.ts` written. |
| 8 | Vite build, `transpileOnly` | `emitDeclarationOnly` + `declaration` | Bundle `MARK_IN`; nothing written. |
| 9 | Vite build | template + profile `tsConfig: { noEmit: false, outDir: "./websmith-out", rootDir: "." }` (README workaround) | `MARK_OUT`; writes `websmith-out/src/*.js(.map)`. **Guard.** |
| 10 | Vite build | template; `app: { depends: ["lib"], tsConfig: { noEmit: true } }`, `lib: { addons: ["depmark"], tsConfig: { noEmit: false, allowImportingTsExtensions: false, outDir: "./lib-out", rootDir: "./src" } }` | Bundle `MARK_IN`; `lib-out/*.js` written with `lib`'s own output (`MARK_DEP`). |
| 11 | Loader, fast path (the loader has no `AddonRegistry`, so it never takes the language-service path) | Vite-like: `noEmit`, `allowImportingTsExtensions`, `.ts` imports, no `outDir` | **Works**: bundle `MARK_OUT`, exit 0. But `lib/src/main.js` and `lib/src/dep.js` are **written under the working directory**: the loader's default `outDir` `./lib` (`packages/webpack/src/options.ts:55`). |
| 12 | Loader, `transpileOnly: true` | same | Same as 11. |
| 13 | Loader, per-file Program (`declaration: true`) | same + `declaration` | **Fails**: `No processed output found for ".../src/main.ts" with profile "app"`. |
| 14 | Loader | `emitDeclarationOnly` + `declaration` + `rootDir` | Fails as 13; writes `lib/main.d.ts`. With `transpileOnly` it fails and writes nothing. |
| 15 | Loader | like 10 (host `noEmit: true`, dependent writes `lib-out`) | Bundle `MARK_OUT`; `lib-out/main.js` holds the **host's** output (`MARK_OUT`): the host inherits `lib`'s `outDir` through `depends` and overwrites the dependent's files. |
| 16 | Loader | `allowImportingTsExtensions` + `declaration`, **no** `noEmit` | TS5096 ("can only be used when one of 'noEmit', 'emitDeclarationOnly', or 'rewriteRelativeImportExtensions' is set"). This is the trap a plain `noEmit: false` falls into. |

Open Points of the plan, resolved by reproduction:

- **(1) Loader with `noEmit: true` today:** it neither drops nor fails on the default path. It bundles the addon
  output and **writes the JavaScript to `outDir`, or to `<cwd>/lib` without one**, ignoring `noEmit` (rows 11-12).
  It fails with "No processed output found" when `declaration: true` or `emitDeclarationOnly` (rows 13-14). The slice
  line holds: the loader also needs the in-memory rule, to stop the writes and the failures.
- **(2) `noEmitOnError: true`:**
  - Not about `noEmit` (`noEmit: false`, `outDir`, a type error in `main.ts`): Vite's type-information path
    **silently bundles the unprocessed source** of `main.ts` (`MARK_IN main`; `isLanguageServiceEmitSkipped`,
    `Compiler.ts:1409-1411`; `pickOutput` returns `null`, `packages/vite/src/output.ts:21-25`). `transpileOnly` and
    the fast path ignore type errors and emit (`Compiler.ts:1574-1578`). The loader's per-file Program path reports
    the type error and fails with "No processed output found"; its fast path emits. Pre-existing: a follow-up in the
    PR, not this slice.
  - **With the in-memory rule it gets worse, unless handled** (run against a prototype of this slice):
    - Removing `allowImportingTsExtensions` makes every `./dep.ts` import a semantic TS5097. Under `noEmitOnError`
      that skips the emit: Vite bundles `main.ts` unprocessed with no diagnostic, and the loader reports TS5097 and
      fails.
    - In the loader, `ts.transpileModule` reports TS5011 for a project without `rootDir` (the loader always has an
      `outDir`). Under `noEmitOnError` that skips the emit, and the loader fails with a bare "No processed output
      found". This already happens on `develop` with `noEmit` + `noEmitOnError`.
    - Dropping `noEmitOnError` for profiles whose resolved `noEmit` is true fixed all three. See "Plan vs. develop".
- **(3) `composite`, `incremental`, `tsBuildInfoFile`:** no interaction. With the prototype, the Vite template plus
  `tsBuildInfoFile: "./node_modules/.tmp/app.tsbuildinfo"`, plus `incremental`, plus `composite`, and `incremental`
  alone, bundled `MARK_OUT` in Vite and the loader, with no diagnostic and no `.tsbuildinfo` file anywhere.
  `emitDeclarationOnly` + `composite` + `declarationMap` wrote only `src/*.d.ts` and `src/*.d.ts.map`.

The code behind it (read):

- `ModuleCompiler.build` (`packages/core/src/compiler/ModuleCompiler.ts:385-492`) emits each dependent profile with
  `writeFile` true (`:436`), then the host's profile with `writeFile` true as well (`:467`). Its comment says
  "do not write the file", but the target's JavaScript **is** written. That is why Vite writes beside the sources
  and the loader writes to `./lib`.
- `ModuleCompiler.emitSourceFile` (`:557-559`) passes `skipCache` true to `Compiler.emitSourceFile`
  (`Compiler.ts:491-504`), which runs processors and `processOutput` (`Compiler.ts:1178-1206`). `processOutput`
  writes `output.outputFiles` when `writeFile` is set, and returns no files when `emitSkipped`.
- Context options: `Compiler.createCompilationContext` (`Compiler.ts:437-484`) merges
  `getContextCompilerOptions(profile)` (`:433-435`) over the profile's options, into both `cliArgs.options` (what
  `ctx.getCompilerOptions()` returns) and `tsConfig` (the language service's settings). `ModuleCompiler` overrides
  it (`ModuleCompiler.ts:213-215`) to return `targetCompilerOptions` for the host's profile only; Vite passes
  `{ jsx: Preserve, sourceMap: true, inlineSourceMap: false }` (`packages/vite/src/hooks.ts:115-116`), the loader
  passes none (`packages/webpack/src/TsCompiler.ts:47-50`).
- Paths: no `AddonRegistry` in the loader → `anyAddonNeedsTypeInfo` false (`Compiler.ts:743-753`) → fast path
  (`transpileSourceCode`, `Compiler.ts:1426`), or per-file Programs under `declaration: true` (`:1388-1392`). Vite
  passes an `AddonRegistry`, so an addon without `needsTypeInfo: false` takes the language service
  (`:1394-1402`), which honours `noEmit` and returns nothing.
- The fast path's `ts.transpileModule` drops `noEmit` itself; `ts.getOutputFileNames` (`:1561`) ignores `noEmit`
  and returns no `.js` name under `emitDeclarationOnly` (rows 4, 8).
- `TRANSPILE_REMOVED_OPTIONS` is `Compiler.ts:68-82` (the plan says `:67`, its comment line).
- TS5011: `getRootDirInferenceErrors` (`Compiler.ts:630-661`) is appended to every fragment in `emitSourceFile`
  (`:494-503`); `ROOT_DIR_INFERENCE_ERROR` is a module constant (`:97`). `tsc` reports no TS5011 under `noEmit`
  (run: `tsc -p .` with `outDir` + `noEmit`, no `rootDir`: nothing; without `noEmit` or with `emitDeclarationOnly`:
  TS5011).
- Loader output: `processResultAndFinish` (`packages/webpack/src/result-handling.ts:392-411`) fails without a `.js`
  file (`:396-398`) and emits every other file of the fragment, e.g. `.d.ts`, as a webpack asset (`:403-407`).
- Vite output: `pickOutput` (`packages/vite/src/output.ts:21-32`) returns `null` without a `.js` file, and Vite then
  bundles the source with its own transform: the silent drop.

### Plan vs. develop

1. **"Without an `outDir` the emit would write `.js` next to the user's sources"** holds for Vite. In the loader,
   "no `outDir`" means `<process.cwd()>/lib` (`options.ts:55`). The in-memory rule covers both. Consequence for the
   e2e: run webpack with the project as working directory, or a "no file written" assertion misses `lib/`.
2. **The override needs two more adjustments than the plan lists**, both found with a prototype:
   - **TS5011.** Removing `noEmit` in the loader, which always has an `outDir`, made every Vite-template project
     without `rootDir` fail with TS5011, a build that passes today (row 11). `tsc` does not report TS5011 under
     `noEmit`, so a profile whose resolved `noEmit` is true drops TS5011 from its fragment's diagnostics. Under
     `emitDeclarationOnly` TS5011 stays, as with `tsc`.
   - **`noEmitOnError`.** See Open Point (2). Recommended resolution, within the slice line ("emits its JavaScript
     in memory"): a profile whose resolved `noEmit` is true is also compiled without `noEmitOnError`. Under `noEmit`
     `tsc` emits nothing, so the option has no effect there; keeping it lets errors the override itself causes
     (TS5097, TS5011) skip the in-memory emit. Under `emitDeclarationOnly`, `noEmitOnError` stays. **Decided by
     the maintainer on 2026-10-21: build it.**
3. **Under `noEmit` + `declaration: true`, the in-memory emit also yields `.d.ts` files**, and the loader emits them
   as webpack assets (`result-handling.ts:403-407`; prototype: `bundle/src/main.d.ts`). `tsc` writes no
   declarations under `noEmit`, so the fragment of such a profile keeps only the JavaScript and its map.
4. **"A dependent profile with its own `noEmit: false` and `outDir`"**: `depends` merges the dependency's `tsConfig`
   into the dependent's (`getTsConfig`, `ResolvedCompilerOptions.ts:377-409`, "dependencies-first"). A host that
   depends on such a profile inherits `noEmit: false` and the `outDir`, and writes there too, today and after the
   change. The case the plan means needs the host to set `noEmit: true` itself (rows 10, 15). Today the loader host
   then overwrites the dependent's files (row 15).

### Where the override lives: core `ModuleCompiler`, not each host

Recommended, and assumed below: implement it once in `packages/core/src/compiler/ModuleCompiler.ts`, for every
`ModuleCompiler`, with no host option. Reasons:

- `ModuleCompiler` is the bundler-host class: its only users are `TsCompiler` (loader) and `createModuleCompiler`
  (Vite). The `websmith` CLI and the programmatic `compile` use `Compiler` and never construct a `ModuleCompiler`, so
  the CLI keeps `tsc`'s meaning with no code path to guard.
- Both seams already exist there: `getContextCompilerOptions` (`:213`) and `emitSourceFile` (`:557`).
- The decision needs the resolved per-profile options (tsconfig `extends` chain, profile closure, loader `tsConfig`),
  which only core has; each host would have to re-implement it, plus the TS5011 and declaration filters.
- Both hosts need identical behaviour. A host opt-in (`ModuleCompilerHost.emitInMemory`) was considered and is not
  recommended: no third host exists and both would pass `true`. Adding it later is one line.

No code change in `packages/webpack/src` or `packages/vite/src` is needed; their specs prove they get the behaviour.

### What to build

**1. Decide per profile, once per option resolution** (`ModuleCompiler.ts`).

- From `this.getOptions().getOptions(profile).tsConfig` (tsconfig with `extends`, profile closure, loader `tsConfig`,
  as `ResolvedCompilerOptions.getOptions`, `:302-346`, merges it), compute per profile:
  - `"memory"` when `noEmit` is true;
  - `"memory-declarations"` when `emitDeclarationOnly` is true and `noEmit` is not;
  - `"disk"` otherwise.
- Cache it in a `Map` keyed by profile (`undefined` for the default context). `getOptions(profile)` parses the
  tsconfig file on every call, so do not compute it per module. Clear it in `setOptions`, which `updateLoaderConfig`
  and `refreshOptions` go through; it runs inside `Compiler`'s constructor before the field exists, so guard it
  as `fileLessErrors?.clear()` does (`:238`).

**2. Compile in-memory profiles without the options** (`getContextCompilerOptions`, `:213-215`).

- Return `targetCompilerOptions` for the host's profile as today, then, for a profile in memory, spread over it
  `{ noEmit: false, emitDeclarationOnly: false, allowImportingTsExtensions: false }`, and, for `"memory"` only,
  `noEmitOnError: false` (decision above).
- Values, not deletes: `createCompilationContext` spreads the result over the profile options. `false` is the
  default of all four.
- It applies to every profile the host compiles: the host's profile and each dependent profile, each by its own
  resolved options.

**3. Emit in-memory profiles without writing their JavaScript** (`emitSourceFile`, `:557-559`).

- For a profile in memory, call `super.emitSourceFile(fileName, profile, false, true)`.
- `"memory"`: keep in `files` only the JavaScript and its map (no `.d.ts`, `.d.mts`, `.d.cts`, no declaration maps);
  drop diagnostics with code `ROOT_DIR_INFERENCE_ERROR` (export it from `Compiler.ts`, or reuse the code with a
  comment); `writtenFiles` is empty.
- `"memory-declarations"`: write the declaration files (and their maps) of the fragment where `tsc` would, i.e. at
  the names TypeScript gave them, under the same `addonEmitOnly` rule `processOutput` applies (`Compiler.ts:1191-1193`);
  `writtenFiles` holds exactly those. Prefer a narrow protected hook in `Compiler` (e.g. a filter on what
  `processOutput` writes, given the profile) over writing them again from `ModuleCompiler`; either is fine if the
  `addonEmitOnly` unit case passes.
- Without `outDir`, declarations land beside the sources (Vite, prototype: `src/main.d.ts`). In the loader they land
  in its `outDir`, `./lib` by default, and webpack also emits them as assets, as it does today for
  `declaration: true` (prototype: `lib/main.d.ts`, `bundle/main.d.ts`).
- A dependent profile in memory passes no written files to its ESM check (`checkLoaderOutput`, `:445`): nothing
  loads its output. Same as today on the language-service path.
- No warning, no info line, no debug line (settled). `getConfigSummary` (`Compiler.ts:1110-1144`) keeps showing the
  resolved `noEmit`; do not change it.

A prototype of items 2 and 3 (without the cache, the hook and the `addonEmitOnly` rule) made every red case below
green; it is not committed anywhere. Its core:

```ts
protected getContextCompilerOptions(profile?: string): ts.CompilerOptions {
    return {
        ...(profile === this.profile ? this.targetCompilerOptions : {}),
        ...(inMemory(profile) && { noEmit: false, emitDeclarationOnly: false, allowImportingTsExtensions: false }),
        ...(resolvedNoEmit(profile) && { noEmitOnError: false }),
    };
}
```

**4. Docs.**

- `packages/vite/README.md`, "Configuration":
  - The sample (`:59-65`): drop `"noEmit": false` from the profile's `tsConfig`; keep `outDir` and `rootDir`.
  - Replace the `noEmit` bullet (`:68-69`) with the rule: with `"noEmit": true` or `"emitDeclarationOnly": true` in
    `tsconfig.json` or the profile's `tsConfig`, as Vite's templates set it, websmith compiles the modules as if
    neither were set and without `allowImportingTsExtensions`, and passes the JavaScript to Vite in memory; it writes
    no `.js` file. Declarations are still written under `emitDeclarationOnly` (beside the sources without `outDir`).
    Setting `"noEmit": false` in the profile is no longer needed; a profile that sets it with an `outDir` keeps
    writing there.
  - The `outDir` bullet (`:70-73`): the profile Vite bundles writes its output to disk only when its resolved
    options set neither `noEmit` nor `emitDeclarationOnly`.
- "Known limits": qualify `:240` the same way; remove the `noEmit` bullet (`:241-242`).
- `packages/webpack/README.md`: a short subsection after "Option resolution and addon lifetime" (`:126-140`), e.g.
  "#### `noEmit` and `emitDeclarationOnly`": the same rule; before, the loader wrote the JavaScript to `outDir`, or
  to `./lib` in the working directory, despite `noEmit`, and failed with "No processed output found" under
  `declaration: true` or `emitDeclarationOnly`.
- Root `README.md:142`: drop `"noEmit": false` from the Vite sample, as in the Vite README. Nothing else there.
- `Release-Notes.md` `## [Unreleased]` → `### Changed` (`:38`), one bullet, e.g.: "**Behaviour change:** the webpack
  loader compiles a profile whose resolved options set `noEmit: true` or `emitDeclarationOnly: true` as if neither
  were set, and without `allowImportingTsExtensions` (and, under `noEmit`, without `noEmitOnError`), and bundles the
  JavaScript from memory: it writes no `.js` file for it. Before, it wrote the JavaScript to `outDir`, or to `./lib`
  in the working directory, despite `noEmit`, and failed with "No processed output found" under `declaration: true`
  or `emitDeclarationOnly`. Declarations are still written under `emitDeclarationOnly`. The Vite plugin does the
  same, so projects from Vite's templates get their addon output without a profile override. The `websmith` command
  keeps `tsc`'s meaning." Keep yours to that one bullet.

### Done when

The slice line is the specification. It asks for: the override in both hosts; unit tests on option resolution in
both hosts including `extends`; e2e in `webpack-test` and `vite-test` with Vite's template tsconfig (addon output in
the bundle in dev and build, no TS5096, no `.js` beside the sources); `emitDeclarationOnly` giving the same bundle;
a dependent profile with `noEmit: false` and `outDir` still writing there; the CLI e2e unchanged; the README
changes; a Release-Notes behaviour-change entry.

Write each red first and run it on `develop` before the fix. **red** means it fails on `develop` (the row it
reproduces is named); **guard** means it passes on `develop` and must keep passing. Say which is which in the PR.

**Unit, `packages/core/src/compiler/ModuleCompiler.spec.ts`**, new `describe("ModuleCompiler in-memory emit")`,
on the virtual system of `createModuleCompiler` (`:26-40`, `TS_CONFIG` has `outDir: "/dist"`, `rootDir: "/src"`).
Use a variant with an addon without `needsTypeInfo: false` and `transpileOnly: false` for the language-service cases.

- yields JavaScript changed by the processor and writes no file w/ `noEmit` in `tsconfig.json`, fast path (red:
  writes `/dist/a.js`)
- the same on the language-service path (red: no JavaScript)
- the same w/ `noEmit` inherited through `extends` (red)
- the same w/ `noEmit` in the profile's `tsConfig` only (red)
- yields JavaScript and no TS5096 w/ `noEmit`, `allowImportingTsExtensions`, `declaration` and a `.ts` import
  (red: no JavaScript)
- yields no declaration file and writes none w/ `noEmit` and `declaration` (red)
- writes `/dist/a.d.ts` and not `/dist/a.js`, and yields the JavaScript, w/ `emitDeclarationOnly` and
  `declaration` (red)
- writes `/src/a.d.ts` w/ `emitDeclarationOnly`, `declaration` and no `outDir` (red)
- writes no declaration of a file no addon processed w/ `emitDeclarationOnly` and `addonEmitOnly` (red)
- reports no TS5011 w/ `noEmit`, `outDir` and no `rootDir` (guard against the naive override)
- reports TS5011 w/ `emitDeclarationOnly`, `outDir` and no `rootDir`, as `tsc` (guard)
- writes the dependent profile's output to its `outDir`, untouched by the host, w/ `noEmit` in the host profile
  and `noEmit: false` + `outDir` in the dependent (red, row 15)
- yields JavaScript w/ `noEmit`, `noEmitOnError` and a `.ts` import on the language-service path (red; only with the
  `noEmitOnError` decision)
- writes no `.tsbuildinfo` w/ `noEmit`, `incremental` and `tsBuildInfoFile` (guard)
- emits in memory after `updateLoaderConfig` to a tsconfig with `noEmit` (red)
- writes the JavaScript w/o `noEmit` (guard; the existing "writes compiled jsx of dependent profile" case already
  covers it, keep it)

**Unit, host specs** (real compilers, temp directories, cleaned in `afterEach`):

- `packages/webpack/src/TsCompiler.spec.ts`: a `TsCompiler` over a project whose `tsconfig.json` extends a base with
  `noEmit` and `allowImportingTsExtensions`: `build` yields the processed JavaScript and writes nothing (red); and
  the same with `noEmit` in the loader's `tsConfig` (red).
- `packages/vite/src/hooks.spec.ts`: with the real `createModuleCompiler` on `createNodeProject` (`:127-136`), a
  `transformHandler` of a module in a project whose tsconfig `extends` one with `noEmit` returns the processed code
  and writes no `.js` (red).

**E2E, `packages/webpack-test/tests/webpack-loader-no-emit.test.ts`** (new). Run webpack in a separate Node process
as `webpack-loader-dependent-profile-diagnostics.test.ts` does, **with `cwd` set to the project**, and assert on
every file in the project outside webpack's output directory. Fixture: the Vite template options, `.ts` import
specifiers, `resolve.extensionAlias` not needed. Addons as plain CommonJS `addon.js`.

- `it.each` `transpileOnly` false/true: "should bundle addon output and write no file w/ noEmit and
  allowImportingTsExtensions" (red, rows 11-12: writes `lib/src/*.js`). Also asserts exit 0 and no TS5011 (the
  fixture has no `rootDir`).
- "should bundle addon output w/o TS5096 and w/o declaration asset w/ noEmit, allowImportingTsExtensions and
  declaration" (red, row 13). Assert on code `5096` and on "allowImportingTsExtensions", not on TypeScript 6's
  wording; the `dist (24, typescript 5.7.3)` CI cell words it differently.
- "should bundle addon output and write declarations only w/ emitDeclarationOnly and declaration" with
  `outDir: "./types"`, `rootDir: "./src"`: `types/main.d.ts` exists, `types/main.js` does not (red, row 14).
- "should bundle addon output w/ emitDeclarationOnly and transpileOnly" (red, row 14).
- "should keep the dependent profile's output in its outDir w/ noEmit in the webpack profile" (red, row 15): bundle
  has `MARK_OUT`, `lib-out/main.js` does not.
- "should bundle addon output w/ noEmit, noEmitOnError and .ts imports" (red on `develop`: bare "No processed output
  found"; only with the decision).

**E2E, `packages/vite-test/tests/vite-no-emit.test.ts`** (new), with `vite-project.ts`'s helpers. `writeTsConfig`
adds `rootDir: "./src"` and `outDir: "./tsc-out"`; pass both as `undefined` (dropped by `JSON.stringify`) for the
template shape. `it.each(["vite", "vite6"])` where it says so; 60 s timeouts.

- "should bundle module changed by processor addon w/ %s and vite template tsconfig" (red, rows 1-2). Also asserts no
  error, no warning, and no `.js` file under `src`.
- "should serve module changed by processor addon in dev server w/ %s and vite template tsconfig", via `runViteDev`
  and `get("/src/main.ts")` (red, row 3).
- "should write no file beside the sources w/ vite template tsconfig and transpileOnly" (red, row 4), and the same
  with an addon `needsTypeInfo: false` (red, row 5).
- "should bundle module changed by processor addon w/ noEmit inherited through extends" (red, row 6).
- "should bundle module changed by processor addon and write declarations beside the sources w/ emitDeclarationOnly
  and declaration" without `outDir`: `src/main.d.ts` exists, `src/main.js` does not (red, row 7); and with
  `transpileOnly` (red, row 8; no declarations, as `transpileOnly` never writes them).
- "should keep writing the dependent profile's output w/ noEmit in the bundled profile" (red, row 10): bundle
  `MARK_OUT`, `lib-out/src/main.js` has the dependent's marker.
- "should bundle module changed by processor addon w/ profile noEmit false and outDir" (guard, row 9; the README
  workaround keeps working).

**CLI:** add no test and change none in `packages/compiler-test` or `packages/compiler`. Their existing `noEmit`
cases (e.g. `compile-websmith.test.ts:138-213`, `bin.test.ts:418`) are the guard that the CLI is unchanged.

**Flakiness:** run each new e2e file 5 times in a row (`--runInBand`) and report "5/5 green, N tests each".

**Also:** new files get the MIT header (`pnpm license:add`); unit tests follow `docs/rules/testing.md`
(assemble/act/assert separated by one blank line, no comments marking them, `testObj`/`actual`, no shared
`testObj`, no `expect` outside assert); no `console` in production code.

### Settled decisions — do not re-derive them

- **Emit anyway in the bundler hosts.** Rejected: failing with a diagnostic (Vite's templates set `noEmit`), and a
  plain `noEmit: false` (writes `.js` beside the sources without `outDir`; TS5096 under
  `allowImportingTsExtensions`). Rejected too: overriding only with an `outDir` (Vite's templates set none).
- **Per resolved profile**, after `tsconfig.json` (with `extends`) and the profile's `tsConfig` are merged, for the
  host's profile and each dependent profile.
- **Removed:** `noEmit`, `emitDeclarationOnly`, `allowImportingTsExtensions` (and `noEmitOnError` under `noEmit`;
  maintainer decision, 2026-10-21). The JavaScript is emitted with `writeFile` false: in memory, never on disk.
- **Declarations are still written** where the profile asks for them (`emitDeclarationOnly` + `declaration`), where
  `tsc` would put them. Under `noEmit` the profile asks for nothing.
- **Accepted by the maintainer on 2026-10-21:** a `noEmit` profile drops TS5011 from its diagnostics, its fragment
  keeps only the JavaScript and its map, and the override lives once in core `ModuleCompiler` with no host option.
- **Silent:** no warning, no debug line. Documented in the READMEs.
- **The CLI keeps `tsc`'s meaning** (`noEmit` emits nothing).
- **A profile with its own `noEmit: false` and `outDir` writes as today**; the README calls it no longer needed.
- **`noEmitOnError` on the type-information path otherwise, and `composite`/`incremental`:** findings go into the
  PR as follow-ups, not into this slice.

### Repo mechanics

- **Worktree setup.** pnpm 10.34 refuses frozen installs in this repo; use the corepack-cached 10.8.0 through a
  shim:

  ```sh
  mkdir -p /tmp/pnpm-shim && printf '#!/bin/sh\nexec corepack pnpm@10.8.0 "$@"\n' > /tmp/pnpm-shim/pnpm && chmod +x /tmp/pnpm-shim/pnpm
  export PATH=/tmp/pnpm-shim:$HOME/.nvm/versions/node/v22.17.0/bin:$PATH COREPACK_ENABLE_NETWORK=0 COREPACK_ENABLE_STRICT=0 NX_DAEMON=false
  pnpm install --frozen-lockfile --offline && pnpm build --skip-nx-cache
  ```

  No dependency is added. Never edit `pnpm-lock.yaml`, `~/.npmrc` or the root `package.json`.
- **Fixtures by hand** go under `packages/webpack-test/test-output-*` or `packages/vite-test/test-output-*`, where
  `webpack`, `websmith-loader`, `vite`, `vite6` and `@quatico/websmith-vite` resolve. Remove them with `trash`. A
  leftover `package.json` there joins the workspace and pollutes the lockfile on the next install; if it happens,
  `git checkout -- pnpm-lock.yaml`.
- **Run webpack fixtures with the fixture as working directory.** The loader's default `outDir` is `./lib` of the
  process's working directory: run from the repo root and it writes into the checkout's `lib/`.
- **Red-first on `develop`:** check out `packages/core/src` at the base commit, rebuild `packages/core`
  (`pnpm --filter @quatico/websmith-core build`), run, restore, rebuild.
- **Merges:** `git -c rerere.enabled=false merge …`.
- **Commits:** Arlo's notation without a colon (`commit-notation` skill). A suggested split:
  - `B Emits the JavaScript of noEmit and emitDeclarationOnly profiles in memory in the bundler hosts`
  - `t Covers noEmit in the webpack loader and the Vite plugin end to end`
  - `d Documents the in-memory emit of noEmit profiles`
  - the plan line, e.g. `d Links the noEmit slice to its PR`
- **Deleting files:** `trash`, never `rm`.
- **Gates, all green:** `pnpm lint`, `pnpm build --skip-nx-cache`, `pnpm test --skip-nx-cache`,
  `pnpm test:e2e --skip-nx-cache`, on Node 22.17.0. Run `packages/vite-test` and the changed e2e files once more on
  Node 24.21.0 (`$HOME/.nvm/versions/node/v24.21.0/bin`); a full in-band `webpack-test` run segfaults locally on
  Node 24, so run its files one by one there. CI also has a `dist (24, typescript 5.7.3)` cell; `develop` pins
  TypeScript 6.0.3, peers `>=5.7 <7`.
- **Known flaky, not yours:** `webpack-loader-resolve-once` "emits output of edited tsconfig.json" and
  `webpack-esm-check` "rebuilds exactly the edited leaf module". Re-run; if one fails twice, report it in the PR.
  Do not change them.

### Bookkeeping

- Push the first real commit as soon as it exists.
- Open the PR with `plot-open-pr.sh`, never `gh pr create`. Its title comes from the heading, "noEmit in bundler
  hosts".
- Append ` → #<PR>` to the `### noEmit in bundler hosts (Branch: bug/bundler-no-emit)` heading line in
  `docs/plans/2026-10-16-addon-rebuild-gaps.md`, and commit it on this branch. Change nothing else in the plan.
- PR body:
  - what changed, with the core-vs-host decision and the "Plan vs. develop" items;
  - "How it was verified": the red/guard list with the `develop` evidence, the 5× runs, Node 22 and 24;
  - "Found, not built": the items below that you confirmed or tripped over.

### Scope guard

This branch owns:

- `packages/core/src/compiler/ModuleCompiler.ts` and its spec, and at most a narrow protected hook and an exported
  constant in `packages/core/src/compiler/Compiler.ts`;
- specs in `packages/webpack/src` and `packages/vite/src`, no production code there;
- the two new e2e files, and helpers in `packages/vite-test/tests/vite-project.ts` or
  `packages/webpack-test/tests/test-files.ts` if needed, without changing existing callers;
- `packages/vite/README.md`, `packages/webpack/README.md`, the one sample line in `README.md`, one bullet in
  `Release-Notes.md`, the ` → #<PR>` in the plan.

Do not touch:

- `packages/compiler/**`, `packages/compiler-test/**`, `packages/api/**`;
- `Compiler.compile`, `Compiler.watch` and anything else on the CLI's path; `cache/FileCache.ts` (the "Stale
  output" slice);
- `.github/**`, the root `package.json`, `pnpm-lock.yaml`.

Concurrent work, checked against `a1083322`: Dependabot #211, #207 and #195 edit manifests and the lockfile only.
If one merges first, take `develop`'s lockfile.

### Not in this slice

Each was observed on `a1083322`; mention any you trip over in the PR, do not build them.

- **`noEmitOnError` with a type error, without `noEmit`:** Vite's type-information path bundles the module
  unprocessed with no diagnostic; the loader's per-file path fails with the error. Owner: none yet; a follow-up.
- **The loader's default `outDir` is `./lib` of the process's working directory** (`options.ts:55`), not of the
  project: a project without `outDir` gets its JavaScript written wherever webpack was started. Owner: none yet.
- **The loader applies no addons of a dependent profile** (prototype, row 15's fixture: `lib`'s processor did not
  run in the loader; it did in Vite). It has no `AddonRegistry` (`TsCompiler.ts:47-50`), so the dependent contexts
  activate none. To verify before reporting; owner: none yet.
- **Without `noEmit`, the profile a bundler bundles still writes its JavaScript to disk** (Vite: beside the sources
  without `outDir`). The plan keeps that; the README states it.
- **Type-only import dependencies** and **build-watch invalidation**: the next two slices.
