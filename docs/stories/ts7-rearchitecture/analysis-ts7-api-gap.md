<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# TypeScript 7 API Gap Analysis

Phase 1 research for `STORY-ts7-rearchitecture.md`. Collected on 2026-09-24.

## Sources and Method

- **websmith:** `packages/*/src` on `develop` (commit `e4b5437`). Non-test files are those not matching
  `*.spec.ts` / `*.test.ts`.
- **Packages:** tarballs downloaded from `https://registry.npmjs.org` and extracted outside the repo:
  `typescript@5.7.3`, `typescript@6.0.3`, `typescript@7.0.2` (`latest`), `typescript@7.1.0-dev.20260924.1`
  (`next`), plus the native binaries `@typescript/typescript-darwin-arm64@7.0.2` and `@7.1.0-dev.20260924.1`.
  Paths below such as `7.0.2:dist/api/sync/api.d.ts:334` are relative to each extracted `package/` directory.
  `7.1-dev` means the `7.1.0-dev.20260924.1` nightly.
- **Official sources:** fetched with curl on 2026-09-24. All URLs below were reachable.

## 1. websmith's Use of the `typescript` API

62 non-test files import `typescript` (api 12, core 23, example-addons 10, webpack 6, node 4, testing 4,
compiler 3). 28 test files import it too (core 10, webpack 6, webpack-test 4, compiler 3, compiler-test 2,
node 2, testing 1). The non-test files reference 125 distinct `ts.*` symbols. The most frequent: `ts.System`
54, `ts.CompilerOptions` 52, `ts.SourceFile` 31, `ts.Diagnostic` 30, `ts.sys` 20, `ts.CustomTransformers`
18, `ts.ParsedCommandLine` 14, `ts.OutputFile` 13, `ts.createSourceFile` 10, `ts.createPrinter` 10,
`ts.transform` 9, `ts.visitEachChild` 8, `ts.createCompilerHost` 7, `ts.createProgram` 6, `ts.transpileModule` 5.

Every package pins `typescript` at `5.7.3` (devDependency or dependency). api, core, node, testing and
example-addons declare the peer range `5.x` (`packages/*/package.json`).

### 1.1 Public addon API surface (`packages/api`)

| Member | Evidence | TypeScript coupling |
|--------|----------|---------------------|
| `AddonContext.getSystem(): ts.System` | `packages/api/src/addons/AddonContext.ts:22` | type |
| `AddonContext.getCliArgs(): ts.ParsedCommandLine` | `AddonContext.ts:28` | type |
| `AddonContext.getCompilerOptions(): ts.CompilerOptions` | `AddonContext.ts:35` | type |
| `AddonContext.registerTransformer(ts.CustomTransformers)` | `AddonContext.ts:115` | type, and addons need the TS 5 AST runtime (`ts.factory`, `ts.visitEachChild`) to write one |
| `Reporter.reportDiagnostic(ts.Diagnostic)`, `reportWatchStatus(..., ts.CompilerOptions)` | `packages/api/src/addons/Reporter.ts:15-16` | type |
| `ErrorMessage` / `WarnMessage` / `InfoMessage`, `DiagnosticMessage implements ts.Diagnostic` | `packages/api/src/diagnostic/DiagnosticMessage.ts:15`, `ErrorMessage.ts:17` | **runtime** value import (`import ts from "typescript"`, `DiagnosticMessage.ts:7`; `ts.isSourceFile` at `:42`; `ts.DiagnosticCategory.*`) |
| `WebpackLoaderOptions` / `BaseOptions.tsConfig: ts.CompilerOptions` | `packages/api/src/options/BaseOptions.ts:30` | type |
| `CompilerOptions.cliArgs: ts.ParsedCommandLine` | `packages/api/src/options/CompilerOptions.ts:16` | type |
| `CompilationProfile.tsConfig: ts.CompilerOptions` | `packages/api/src/config/CompilationProfile.ts:25` | type |
| `Processor = (filePath, fileContent) => string` | `packages/api/src/addons/Processor.ts:24` | none (string-based) |
| `Generator = (filePath, fileContent) => void` | `packages/api/src/addons/Generator.ts:20` | none |
| `ResultProcessor = (emittedFiles: string[], ctx) => void` | `packages/api/src/addons/ResultProcessor.ts:32` | none |
| `CompilerAddon.needsTypeInfo` (selects the `transpileModule` fast path) | `packages/api/src/addons/CompilerAddon.ts:61` | semantic only |

Processors, generators and result processors are string- or path-based and do not depend on TypeScript. Only
transformers, `getSystem`, the option and diagnostic types, and the runtime diagnostic classes do.

### 1.2 Internal use, by capability

| Capability | Key call sites (non-test) |
|------------|---------------------------|
| Host / system | `ts.sys` and `ts.System` throughout; custom in-memory `ts.System` for browser and tests (`packages/core/src/environment/browser-system.ts:16`); `ts.createCompilerHost` (`core/src/compiler/Compiler.ts:938,1014`, `core/src/environment/compile-service.ts:24`, `core/src/environment/language-service.ts:81`) |
| Program / type checking | `ts.createProgram` with `oldProgram` reuse (`Compiler.ts:764`); per-file programs (`Compiler.ts:949,1010`); `ts.getPreEmitDiagnostics` (`Compiler.ts:599`, `webpack/src/WebpackAddonService.ts:311`) |
| Language service | `ts.createLanguageService` + `ts.createDocumentRegistry` over a custom `LanguageServiceHost` (`core/src/compiler/compilation/CompilationContext.ts:82-89`, `CompilationHost.ts:10`); `getEmitOutput` (`Compiler.ts:931,980`); `getCustomTransformers` on the host (`CompilationContext.ts:369`) |
| Emit / transpile | `ts.transpileModule` with `transformers` (`Compiler.ts:817,829,1105`); `program.emit(sf, writeFile, _, _, transformers)` (`Compiler.ts:951`); `ts.getOutputFileNames` (`Compiler.ts:1111`) |
| Custom transformers | merged `ts.CustomTransformers` passed to `transpileModule`, `program.emit` and the language service; `addonEmitOnly` compares output with and without transformers (`Compiler.ts:812-842`) |
| AST factory / printer / visitor | used by example addons, which are the reference for third-party authors: `ts.createSourceFile` + `ts.transform` + `ts.createPrinter` inside processors (`example-addons/src/reformatting-processor/addon.ts:12-60`, `foobar-export-processor/addon.ts:20-48`); `ts.visitEachChild` / `ts.factory.*` in transformers (`foobar-replace-transformer/replace-identifier-transformer.ts:22-33`, `selective-transformer/addon.ts:58-93`) |
| Diagnostics | `ts.formatDiagnostic(s)`, `ts.flattenDiagnosticMessageText` (`core/src/compiler/DefaultReporter.ts:51,70`, `AddonRegistry.ts:720-756`) |
| Config parsing | `ts.getParsedCommandLineOfConfigFile` (`core/src/compiler/config/parsed-command-line.ts:72-108`); `ts.findConfigFile` (`compiler/src/find-config.ts:10`); `ts.parseCommandLine`; `ts.getDefaultCompilerOptions` (`core/src/compiler/defaults.ts:10`) |
| Watch | `ts.createWatchCompilerHost` + `ts.createSemanticDiagnosticsBuilderProgram` (`core/src/environment/compile-service.ts:34,85`); `System.watchFile` with `ts.WatchFileKind` (`Compiler.ts:670-685`) |
| Addon compilation | addons are compiled from TS with `ts.createProgram` (`core/src/compiler/addons/AddonRegistry.ts:674-694`) and `ts.transpileModule` (`AddonRegistry.ts:780`) |

## 2. What TypeScript 7.x Ships

### 2.1 Package shape (7.0.2 and 7.1-dev)

- No `main` or `types`. The root export is `./lib/version.cjs` (`7.0.2:package.json` `exports`), which only
  exports `version` and `versionMajorMinor` (`7.0.2:lib/version.cjs:1-3`). `"type": "module"`.
- The compiler is a native Go binary shipped in `@typescript/typescript-<os>-<arch>` optional dependencies
  (`7.0.2:package.json` `optionalDependencies`); `bin/tsc` execs it (`7.0.2:lib/tsc.js`).
- API entry points: `./unstable/{sync,async,fs,proto,ast,ast/is,ast/factory,ast/utils,ast/scanner,ast/visitor,ast/clone}`.
  They are identical in 7.0.2 and 7.1-dev (`package.json` `exports`). The `unstable/` prefix and the blog
  statement "TypeScript 7.0 ... does not ship with an API" (https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/,
  section "Running Side-by-Side with TypeScript 6.0") mark the API as not stable.

### 2.2 Transport: always out of process

- `unstable/sync` spawns the native binary with `--api` and talks MessagePack over stdin/stdout, using blocking
  `fs.readSync` / `fs.writeSync` (`7.0.2:dist/api/syncChannel.js:1-12`, `dist/api/sync/client.js:14-36`).
- `unstable/async` uses JSON-RPC (`vscode-jsonrpc`) over stdio or a Unix socket / named pipe
  (`7.0.2:dist/api/async/client.js:1-8,33-56`). It can also attach to a running LSP server
  (`API.fromLSPConnection`, `7.0.2:dist/api/sync/api.d.ts:36`).
- Host file system hooks are limited to callbacks: `readFile`, `fileExists`, `directoryExists`,
  `getAccessibleEntries`, `realpath` (`7.0.2:dist/api/fs.d.ts:21`); 7.1-dev adds `writeFile`
  (`7.1-dev:dist/api/fs.d.ts:23`). There is no `ts.System` equivalent: no `getModifiedTime`, `watchFile`,
  `createHash` or `exit`.
- Official rationale: "In the Go implementation, we can't dynamically link third-party code into the server
  process. Instead, we provide an IPC-based API" (https://github.com/microsoft/TypeScript/issues/63800).
- Consequence (inferred): no in-process compilation and no browser execution. websmith's
  `createBrowserSystem` path has no 7.x counterpart.

### 2.3 7.0.2 `unstable/sync` surface

- `API`: `parseConfigFile`, `updateSnapshot`, `close` (`7.0.2:dist/api/sync/api.d.ts:23-56`). Projects
  come from tsconfig files via snapshots only; there is no `createProgram(rootFiles, options)`.
- `Program`: `getSourceFile`, `getSourceFileNames`, and syntactic, bind, semantic, suggestion, declaration,
  program, global and config diagnostics (`api.d.ts:131-206`). **No emit.**
- `Checker`: about 60 read-only queries (`getTypeAtLocation`, `getSymbolAtLocation`, `typeToString`,
  `isTypeAssignableTo`, ...) (`api.d.ts:207-328`).
- `Emitter.printNode(node)` only (`api.d.ts:334-338`). The client encodes the node and sends it to the server
  for printing (`7.0.2:dist/api/sync/api.js:1226-1232`).
- No `transpileModule`, no `createSourceFile` (parser), no transformers, no language service object, no watch.
  A grep for `transform|transpile|emit(|watch` in `7.0.2:dist` finds only the `transformFlags` node field.

### 2.4 7.1-dev additions (nightly, not released)

From `7.1-dev:dist/api/sync/api.d.ts`:

- `createProgram(rootFiles, compilerOptions, options?)` (`:206`), `createSourceFile(fileName, text)` (`:127`),
  `transpileModule` / `transpileDeclaration` (`:135`, `:143`), `parseConfigFile` / `parseCommandLine` /
  `parseJsonConfigFileContent` (`:99-111`), `createModuleResolver` with a client-side `resolveModuleName`
  callback (`:31-40`, `:176`), `formatDiagnostics` (`:28`).
- `Program.emit(emitOnly?)`, `emitToString`, `getJavaScriptEmit(files)`, `getDeclarationEmit(files)`
  (`:667-690`). These landed in https://github.com/microsoft/typescript-go/pull/4699, merged 2026-07-24.
- `Printer.printNode` / `printFile` (`:1163-1174`); `Project.languageService` exposes only import edits,
  references, signature usage and completions (`:462-488`). There is no `getEmitOutput`.
- **No transformer parameter anywhere.** `TranspileOptions` is `{ compilerOptions, fileName, reportDiagnostics }`
  (`:60-64`); `emit` takes only `EmitOnly` (`dist/enums/emitOnly.enum.d.ts`). A grep for `transformer` in
  `7.1-dev:dist/**/*.d.ts` finds nothing.
- **Content mappers**: tsconfig `contentMappers` entries run external processes that map foreign file types
  into TypeScript. They require `--runExternalCode` (`7.1-dev:dist/api/options.d.ts:18`); the strings
  `contentMappers` and `contentMapper.package` occur in the 7.1-dev binary but not in 7.0.2 (checked with
  `strings`). Design: https://github.com/microsoft/typescript-go/pull/4712 (merged 2026-08-19): "allow
  TypeScript to include otherwise unsupported file types". Whether a mapper can claim `.ts` itself is
  **unverified**.

### 2.5 Stated plans (https://github.com/microsoft/TypeScript/issues/63875, "API feature roadmap", open)

- Lists the items needed "for 7.1": `createProgram`, `createSourceFile`, `transpileModule` (2A-2C), and
  `parseCommandLine` (3A). All four are already in the 7.1-dev nightly (section 2.4).
- **3C Custom transformers:** "fetching the JS emit as a SourceFile (AST), running custom transformations
  client-side, and sending the transformed AST back to the server for final emit (basically `printNode`)";
  needed by "Angular, Google, ts-loader"; estimated at 2 dev-weeks. Not present in 7.1-dev. The plan
  describes a transform after JS emit, which differs from TS 5's `before` phase (see section 3).
- **Watch:** "I'm treating `--watch` functionality as out of scope for now". 3B (solution builder,
  `createIncrementalProgram`) is planned.
- 7.0 blog: "We expect TypeScript 7.1 to ship with a new (and different) API". Until then, use the
  `@typescript/typescript6` compatibility package for tools that need the API
  (https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/). The npm registry lists it at 6.0.2,
  with `main: ./lib/typescript.js`, bin `tsc6`, and a dependency on `npm:typescript@^6`.
- The `microsoft/typescript-go` README lists "API: not ready"; the repo is closed and moved into
  `microsoft/TypeScript` (https://raw.githubusercontent.com/microsoft/typescript-go/main/README.md).
- Precedent: ts-loader, a webpack loader like websmith's, is migrating to the new API in
  https://github.com/TypeStrong/ts-loader/pull/1704 (referenced in issue 63875, comment 2026-09-02). Its outcome
  is **unverified**.

## 3. TypeScript 6.0.3 as a Stepping Stone

- **Same JS API shape:** `main: ./lib/typescript.js`, `typings: ./lib/typescript.d.ts` (`6.0.3:package.json`).
  The set of exported `function` names in `lib/typescript.d.ts` is identical to 5.7.3 (533 names, empty diff).
  `CompilerOptions` gains `libReplacement` and `erasableSyntaxOnly` and marks `baseUrl`, `charset` and
  `downlevelIteration` `@deprecated`. `ScriptTarget.ES3/ES5`, `ModuleKind.None/AMD/UMD/System` and
  `ModuleResolutionKind.Classic/Node10` are marked `@deprecated` but not removed.
- **Deprecations are hard errors:** `checkDeprecations("6.0", "7.0", ...)` (`6.0.3:lib/typescript.js:130044-130120`)
  reports errors for `alwaysStrict: false`, `target: ES5`, `moduleResolution: node10|classic`, `baseUrl`,
  `esModuleInterop: false`, `allowSyntheticDefaultImports: false`, `outFile`, `module: none|amd|umd|system`,
  and any `downlevelIteration`. `ignoreDeprecations: "6.0"` silences them in 6.x only; 7.0 "will not support any
  of these" (https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/).
- **New defaults** (same blog): `strict: true`, `module: esnext`, floating `target`, `types: []`,
  `rootDir: .`, `noUncheckedSideEffectImports: true`.
- **websmith hits:**
  - `defaults.ts:16` sets `esModuleInterop: false` and `:20` sets `strict: false`.
  - Addon compilation uses `moduleResolution: ts.ModuleResolutionKind.Classic` (`AddonRegistry.ts:559`).
  - Target and module lookup tables include ES3, ES5, AMD, UMD and System (`Compiler.ts:37-58`).
  - The test environment uses `ScriptTarget.ES5` (`packages/testing/src/compilation/environment.ts:394`).
  - `ts.ImportsNotUsedAsValues` (`packages/node/src/compiler-options.ts:22`) still exists in the 6.0.3
    typings.
  - Repo tsconfigs use `moduleResolution: "node"` (`tsconfig.json:48`, `packages/core/tsconfig.json:8`,
    `packages/api/tsconfig.json:6`, `packages/testing/tsconfig.json:6`) and `downlevelIteration`
    (`tsconfig.json:19`).
  - The CLI exposes `--outFile` (`packages/compiler/src/command.ts:57`).
- Whether TS 6 raises the deprecation errors through `transpileModule` as well as `createProgram`:
  **unverified**.

## 4. Capability Map

Status: available / partial / missing / unknown. 7.x lists 7.0.2 first, then 7.1-dev (nightly).

| websmith capability | 6.x | 7.0.2 | 7.1-dev | Evidence |
|---------------------|-----|-------|---------|----------|
| `ts.System` host (read, write, watch, mtime) | available | partial: 5 read callbacks | partial: plus `writeFile` | `7.0.2:dist/api/fs.d.ts:21`, `7.1-dev:dist/api/fs.d.ts:23` |
| In-memory / browser system | available | missing: native process, Node only | missing | `syncChannel.js:12`, section 2.2 |
| `createCompilerHost` / custom `getSourceFile` | available | missing | partial: VFS layers plus module-resolver callback | `7.1-dev:dist/api/fs.d.ts`, `api.d.ts:31-40` |
| `createProgram(rootNames, options)` | available | missing: snapshot from tsconfig only | available | `7.0.2:api.d.ts:38-39`; `7.1-dev:api.d.ts:206` |
| Incremental `oldProgram` reuse | available | partial: snapshots | partial: snapshots; `createIncrementalProgram` planned | issue 63875 section 3B |
| Pre-emit and semantic diagnostics | available | available | available | `7.0.2:api.d.ts:170-205` |
| Type checker queries | available | available: read-only subset | available: larger subset | `7.0.2:api.d.ts:207-328` |
| Language service (`getEmitOutput`, custom host) | available | missing | partial: no emit output, no custom host | `7.1-dev:api.d.ts:462-488` |
| Program emit to disk / string | available | missing | available | `7.1-dev:api.d.ts:667-690`, PR 4699 |
| Per-file emit (`program.emit(sf, ...)`) | available | missing | available: `getJavaScriptEmit(files)` | `7.1-dev:api.d.ts:681` |
| `transpileModule` | available | missing | available: no `transformers` option | `7.1-dev:api.d.ts:60-64,135` |
| `getOutputFileNames` | available | missing | unknown | not found in `7.1-dev` `.d.ts` |
| Custom transformers `before` / `after` / `afterDeclarations` | available | missing | missing: planned as post-emit AST round trip | issue 63875 section 3C |
| Parse to AST (`createSourceFile`) | available | missing: factory builds nodes only | available: server-side parse | `7.0.2:dist/ast/factory.generated.d.ts:518`; `7.1-dev:api.d.ts:127` |
| AST factory | available: `ts.factory.*` | available: free functions, different node model | same | `7.0.2:dist/ast/factory.generated.d.ts:154` |
| Visitor | available: `visitEachChild(node, v, ctx)` | available: `visitEachChild(node, v)`, no `TransformationContext` | same | `7.0.2:dist/ast/visitor.generated.d.ts:48` |
| `ts.transform` (standalone transform run) | available | missing | missing | grep `TransformationContext` in `dist`: none |
| Printer | available | partial: `printNode` via IPC | available: `printNode`, `printFile` | `7.0.2:api.d.ts:337`; `7.1-dev:api.d.ts:1163-1174` |
| Diagnostic formatting | available | missing | available | `7.1-dev:api.d.ts:28` |
| Config parsing (`getParsedCommandLineOfConfigFile`, `parseCommandLine`) | available | partial: `parseConfigFile` | available | `7.1-dev:api.d.ts:99-111` |
| `findConfigFile`, `getDefaultCompilerOptions` | available | missing | unknown | not found in `7.1-dev` `.d.ts` |
| Watch (`createWatchCompilerHost`, builder programs) | available | missing in API; `tsc --watch` CLI only | missing: "out of scope for now" | `tsc --help` of the 7.0.2 binary; issue 63875 section 3 |
| Source-text preprocessing (processors) | websmith-owned | websmith-owned, by feeding text | websmith-owned; content mappers for foreign extensions | PR 4712 |
| Runtime `ts.Diagnostic` / `ts.isSourceFile` in api | available | missing: no root JS module | missing | `7.0.2:lib/version.cjs` |

Processors and generators remain feasible on every version because they are string-in/string-out and
websmith drives them. The API can accept overridden file contents: `fs.readFile` callbacks
(`7.0.2:dist/api/fs.d.ts`) and, in 7.1-dev, VFS layers and `transpileModule(input)`.

## 5. Strategy Options

No recommendation. For each option: consequences for addon authors, and which Open Points
(`STORY-ts7-rearchitecture.md`) it answers.

### A. Stay on 6.x; clear the 6.0 deprecations; wait for a stable 7.x API

- Change the peer range to `5.x || 6.x`, or depend on `@typescript/typescript6`. Consumers run `tsc` from 7.x
  side by side. Fix the section 3 hits (`esModuleInterop: false`, `Classic`, ES5 / AMD tables, repo tsconfigs).
- **Pros:** smallest change; the addon API is unchanged; in-process compilation, `transpileModule`
  transformers and watch keep working; this is the path Microsoft itself names for tools that need the API.
- **Cons:** websmith's type checking and emit stay on the 6.x compiler, not 7.x (the Go compiler is only
  reached through its API); consumers carry two TypeScript versions; 6.x has no announced end date
  (**unverified**).
- **Addon authors:** no change.
- **Answers:** 7.1 timing (wait); in-process loader (kept); `transpileOnly` (kept). **Leaves open:** long-term
  addon types.

### B. Dual backend behind a websmith-internal compiler adapter

- Put a `CompilerBackend` interface in core (program, emit, transpile, diagnostics, config) with a TS 5/6
  implementation and a 7.1 `unstable/sync` implementation. Transformers run only on the 5/6 backend until 7.x
  supports them (roadmap 3C).
- **Pros:** consumers pick their TypeScript major; websmith moves to 7.x incrementally; the webpack loader can
  keep the 5/6 in-process path.
- **Cons:** two code paths to test and keep in sync; the public API still exposes `ts.*` types, which must
  come from one version; a feature gap on 7.x (no transformers, no watch API, no browser system); the 7.x
  API is `unstable` and changed between 7.0.2 and 7.1-dev (sections 2.3 and 2.4).
- **Addon authors:** processors and generators work on both backends; transformer addons are limited to 5/6.
- **Answers:** which majors (both); loader model (in-process on 5/6, out-of-process on 7). **Leaves open:**
  addon type ownership.

### C. websmith-owned AST / transform abstraction in `packages/api`

- Replace `ts.CustomTransformers`, `ts.System`, `ts.CompilerOptions` and `ts.Diagnostic` in `AddonContext`
  with websmith types: a file-system interface, a plain options record, and a diagnostic class without
  `import ts`. Transformers become either (a) an AST pass over a websmith node model adapted to each backend,
  or (b) source-level passes (parse, visit, print) built on 7.1's `createSourceFile` + `printFile`, and on 5/6's
  `createSourceFile` + `createPrinter`.
- **Pros:** decouples addons from TypeScript majors for good; `packages/api` sheds its runtime
  dependency on `typescript`.
- **Cons:** a breaking change for every transformer addon and for `getSystem()` users; a websmith-owned node
  model is large (the 7.x AST typings alone are 1,160 lines, `7.0.2:dist/ast/ast.generated.d.ts`); a
  source-level pass loses `before`-phase semantics such as access to type info during emit and synthesized-node
  emit helpers (**unverified** for the 7.1 printer's fidelity; roadmap 3C notes missing emit-node metadata).
- **Addon authors:** must port transformers; processors, generators and result processors are unaffected.
- **Answers:** keeping `ts.*` types in the addon API (no). Combines with A or B.

### D. Go 7.x-only, out of process, on the `unstable` API

- Rebuild core on 7.1 `unstable/sync`: `createProgram` or snapshots, `getJavaScriptEmit`, `transpileModule`,
  VFS layers for processor output, and `resolveModuleName` callbacks. Adopt the roadmap 3C transformer model
  when it ships.
- **Pros:** native speed; one backend; aligned with where ts-loader is heading (PR 1704).
- **Cons:** 7.1 is unreleased and the API is explicitly unstable; no transformers today; no watch API
  (websmith would own watching); the browser system and in-process webpack model are dropped; every
  `ts.*`-typed public member breaks; each loader instance pays for a spawned process and IPC
  (performance **unverified**; see the ts-loader timing discussion in issue 63875).
- **Addon authors:** transformer addons stop working until 3C lands, then need porting to the new node
  model; the public types change.
- **Answers:** which majors (7.x only); loader model (out-of-process); `transpileOnly` (7.1 `transpileModule`,
  without transformers); 7.1 timing (must wait for 7.1 GA).

## 6. Open Questions This Analysis Does Not Settle

- Will 7.1 GA ship custom transformers (roadmap 3C), and at which phase (before or after JS emit)?
- Can a content mapper claim `.ts` / `.tsx`, so that processors could run inside `tsc` itself?
- Performance of per-file `transpileModule` / `getJavaScriptEmit` over IPC compared with in-process 5.x, for
  webpack workloads.
- How long `@typescript/typescript6` and 6.x receive fixes.
- Whether TS 6 emits the deprecation errors in `transpileModule` (the `transpileOnly` path) or only in programs.
