<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# Architecture Rules

Package layout, the compilation pipeline, the webpack loader integration, design patterns and performance
constraints of the websmith monorepo.

## CRITICAL: Respect Package Boundaries

**The Rule:** Public types live in `packages/api`. `packages/core` is internal and never used directly by
consumers or addons. The CLI (`packages/compiler`) and the loader (`packages/webpack`) build on core.

**Why?** Addon authors depend on `@quatico/websmith-api` only. Leaking core types into the public surface couples
every addon to compiler internals and turns internal refactorings into breaking changes.

### Wrong

```typescript
// ❌ Addon reaching into internals
import { CompilationContext } from "@quatico/websmith-core";
```

### Correct

```typescript
// ✅ Addon uses the public API
import { type AddonContext } from "@quatico/websmith-api";
```

To add a new capability, extend `CompilationContext` (core) **and** the `AddonContext` interface (api).

## Packages

pnpm workspace; every package lives under `packages/`.

| Package | Purpose | Key files |
|---------|---------|-----------|
| `api` | Public API interfaces and types for addon developers | `src/addons/`, `src/config/`, `src/options/` |
| `core` | Shared compiler implementation and utilities (internal) | `src/compiler/`, `src/environment/` |
| `compiler` | `websmith` CLI, drop-in replacement for `tsc` | `src/bin.ts`, `src/command.ts` |
| `webpack` | `websmith-loader` webpack integration | `src/loader.ts`, `src/TsCompiler.ts` |
| `testing` | Test helpers, mock systems, fixtures | `src/` |
| `node` | Node.js specific `ts.System` implementation | `src/` |
| `example-addons` | Reference addons for addon developers | `src/*/addon.ts` |
| `compiler-test`, `webpack-test` | End-to-end suites for CLI and loader | — |

### api exports

- `AddonContext` (what `activate` receives), `AddonActivator` (the `activate` signature)
- Callback types `Generator`, `Processor`, `Transformer`, `ResultProcessor`
- Configuration types `CompilationConfig`, `CompilationProfile`
- Option types `CompilerOptions`, `WebpackLoaderOptions`
- Diagnostics `ErrorMessage`, `WarnMessage`, `InfoMessage`

### core components

`Compiler` (engine), `AddonRegistry` (loading, caching, discovery), `CompilationContext` (the `AddonContext`
implementation), `CompilationHost` (TypeScript language-service host), `FileCache` (source + output cache for
incremental builds), plus configuration resolution, environment setup and reporters.

### compiler (CLI) features

`--profile`, `--addons`, `--addonsDir`, `--configFile`, `--debug`, watch mode, and a webpack-bundled version for
CI/CD environments.

## Compilation Pipeline

**Entry points:**

1. CLI: `packages/compiler/src/bin.ts` → `addCompileCommand()` → `command.ts`
2. webpack loader: `packages/webpack/src/loader.ts`
3. Direct API: `Compiler` from `@quatico/websmith-core`

**`Compiler.compile()`:**

```text
1. Profile resolution
   ├─ single profile, or multiple profiles (when --profile is given)
   └─ load profile dependencies
2. For each profile:
   a. Create CompilationContext
      ├─ initialize the TypeScript LanguageService
      ├─ create the CompilationHost
      └─ activate the profile's addons
   b. Create the TypeScript program (root files from tsconfig.json or CLI args)
   c. For each source file (emitSourceFile):
      i.   run generators (unmodified input)
      ii.  run processors (transform source code)
      iii. update the file cache with processed source
      iv.  transpile (transformers + TypeScript compilation)
      v.   process output (write files)
   d. Run result processors (emitResult, after all files)
3. Aggregate results: combine diagnostics from all profiles
```

**Why the order matters:** generators see the untouched source; processors chain; transformers run inside the
TypeScript emit; result processors see only what was actually emitted. Adding a step in the wrong place breaks
`addonEmitOnly` detection (see `configuration.md`).

Details of each step, from the addon author's point of view, are in `addons.md`.

## webpack Loader

The loader is thin and delegates to `TsCompiler`:

```typescript
// ✅ packages/webpack/src/loader.ts (abridged)
export function loader(this: LoaderContext<WebsmithLoaderConfig>): void {
    this.cacheable?.();
    const options = getLoaderOptions(this);
    const instance = getCompilerInstance(options, this, (path: string) => this.addDependency(path));
    const fragment = instance.build(this.resourcePath);
    this.version = fragment.version;
    processResultAndFinish(this, fragment, instance.getProfile());
}
```

- **`TsCompiler`** extends the base `Compiler`: hooks webpack's dependency callback for change detection,
  manages profile-specific compilation and the webpack compilation context, provides version-based cache
  invalidation.
- **`compiler-instances.ts`** pools `TsCompiler` instances per webpack config, reuses them across files and
  invalidates them when the config changes.
- **`CompilationQueue`** queues concurrent compilation requests, prevents race conditions, handles errors.
- **`result-handling.ts`** converts output to webpack format, handles source maps, reports errors/warnings.
- **`WebpackAddonService`** (lazy) and **`WebpackAddonContext`** provide webpack-aware addon management.

### Loader options

```typescript
// WebsmithLoaderConfig = WebpackLoaderOptions (api) & webpack-only callbacks
type WebsmithLoaderConfig = {
    configFile?: string;                     // websmith.config.json path
    config?: CompilationConfig;              // inline config (overrides websmith.config.json)
    tsConfigFile?: string;                   // tsconfig.json path
    tsConfig?: ts.CompilerOptions;
    profile?: string;                        // profile name
    debug?: boolean;
    transpileOnly?: boolean;                 // skip type checking
    addonEmitOnly?: boolean;                 // only emit addon-processed files
    profiles?: Record<string, CompilationProfile>;
    instanceName?: string;
    warn?: (err: WebpackError) => void;
    error?: (err: WebpackError) => void;
};
```

### Dependency tracking and caching

The loader calls `this.addDependency(path)` for all source files, dependencies added via
`addAssetDependency()`, and configuration file changes. `this.version` is set to `CompileFragment.version`; the
version increments when a source changes, which drives webpack's incremental rebuilds.

### Wrong

```typescript
// ❌ Reading a file the output depends on without telling webpack
const tpl = system.readFile(templatePath);
```

### Correct

```typescript
// ✅ Register it so webpack rebuilds when it changes
ctx.addAssetDependency(templatePath, fileName);
```

## Design Patterns

- **Registry** — `AddonRegistry` holds available addons, compilation cache, mtime cache, lookup cache and a
  reused compiler host.
- **Context** — `CompilationContext` implements `AddonContext`: TypeScript access, file system, configuration,
  reporter, lifecycle hooks.
- **Plugin** — addons register callbacks in `activate` (see `addons.md`).
- **Lazy initialization** — `WebpackAddonService` is created only when needed; the compiler host is reused when
  options are unchanged; files compile incrementally with caching.
- **Error handling** — categorized diagnostics (dependency, syntax, filesystem, ...), resolution suggestions,
  non-fatal errors let compilation continue, diagnostics carry context.

## Incremental Compilation and Watch Mode

`FileCache` stores source content, modification time, compiled output and a version number (for webpack).
Invalidation: per-file mtime tracking; configuration changes clear caches; webpack uses `version`.

`Compiler.watch()` registers watchers via `ts.System.watchFile()`, debounces for 50 ms, resolves dependencies,
recompiles affected files and supports profile-based watching.

## Performance Considerations

1. **Addon caching** — compiled addons are recompiled only when their source changed.
2. **Selective loading** — only requested addons load, not the whole directory.
3. **File caching** — source and output cached per file.
4. **Compiler host reuse** — reused while options are unchanged.
5. **webpack instance pooling** — compiler instances reused across files.
6. **Incremental builds** — only changed files recompile in watch mode.

**Rule:** Changes to hot paths (`emitSourceFile`, `transpile`, `AddonRegistry` lookups) MUST keep these caches
valid. Invalidate precisely (per file) rather than clearing everything.

## Key Files

| File | Notes |
|------|-------|
| `packages/core/src/compiler/Compiler.ts` | Main engine (~1200 lines): `compile`, `watch`, `emitSourceFile`, `emitResult`, `transpile` |
| `packages/core/src/compiler/addons/AddonRegistry.ts` | Addon discovery, compilation, loading (~1300 lines) |
| `packages/core/src/compiler/compilation/CompilationContext.ts` | `AddonContext` implementation |
| `packages/compiler/src/command.ts` | CLI options and command |
| `packages/webpack/src/loader.ts` | Loader entry, delegates to `TsCompiler` |
| `packages/webpack/src/TsCompiler.ts` | webpack-aware compiler |
| `packages/api/src/addons/AddonContext.ts` | Public addon contract |

Reference methods by name, not line number; line numbers in this file set go stale quickly.

**Related:** `addons.md` (addon lifecycle), `configuration.md` (config and compilation modes),
`docs/language-glossar.md` (terminology).
