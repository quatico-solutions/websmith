# Websmith Monorepo Architecture Guide

This document provides a comprehensive overview of the websmith monorepo architecture for Claude instances working on this codebase.

## 1. Packages Structure

The websmith monorepo is organized as a pnpm workspace with the following packages:

### Core Packages

#### `packages/api`

- **Purpose**: Public API interfaces and types for addon developers
- **Key Exports**:
  - `AddonContext`: Main interface addons receive in their activate function
  - `AddonActivator`: Type for the activate function signature
  - `Generator`, `Processor`, `Transformer`, `ResultProcessor`: Addon callback types
  - `CompilationConfig`, `CompilationProfile`: Configuration types
  - `CompilerOptions`, `WebpackLoaderOptions`: CLI and loader option types
  - Diagnostic message types: `ErrorMessage`, `WarnMessage`, `InfoMessage`
- **Key Files**: `/packages/api/src/addons/`, `/packages/api/src/config/`, `/packages/api/src/options/`

#### `packages/core`

- **Purpose**: Shared compiler implementation and utilities (internal, not used directly by consumers)
- **Key Components**:
  - `Compiler`: Main compilation engine
  - `AddonRegistry`: Manages addon loading, caching, and discovery
  - `CompilationContext`: Provides AddonContext implementation
  - `CompilationHost`: TypeScript compilation host for the language service
  - `FileCache`: Caches source and compiled output for incremental builds
  - Configuration resolution, environment setup, reporters
- **Key Files**: `/packages/core/src/compiler/`, `/packages/core/src/environment/`

#### `packages/compiler`

- **Purpose**: CLI tool for standalone TypeScript compilation with websmith addons
- **Entry Point**: `bin.ts` - Command-line interface
- **Key Features**:
  - `websmith` command as drop-in replacement for `tsc`
  - `--profile` support for compilation profiles
  - `--addons` flag for specifying addons
  - `--configFile` for websmith.config.json path
  - Watch mode support
  - Bundled version via webpack for CI/CD environments
- **Key Files**: `/packages/compiler/src/command.ts`, `/packages/compiler/src/bin.ts`

#### `packages/webpack`

- **Purpose**: webpack loader integration (`websmith-loader`)
- **Key Components**:
  - `loader.ts`: Main webpack loader entry point
  - `TsCompiler`: Extends base Compiler for webpack integration
  - `CompilationQueue`: Manages queued compilation requests
  - `compiler-instances`: Instance pooling and caching
  - `WebpackAddonService`: webpack-specific addon management
  - `WebpackAddonContext`: Webpack-aware AddonContext implementation
- **Key Files**: `/packages/webpack/src/loader.ts`, `/packages/webpack/src/TsCompiler.ts`

#### `packages/testing`

- **Purpose**: Testing utilities and helpers
- **Features**: Helpers for addon testing, mock systems, test fixtures

#### `packages/node`

- **Purpose**: Node.js specific utilities
- **Features**: System implementation for Node.js environments

#### `packages/example-addons`

- **Purpose**: Reference examples for addon developers
- **Examples**:
  - `foo-added-generator`: Generator that creates additional source files
  - `foobar-export-processor`: Processor that modifies exports
  - `foobar-replace-transformer`: Transformer that replaces identifiers
  - `export-yaml-generator`: Generator that exports configuration as YAML
  - Profile-based examples: `client-processor`, `server-processor`, `client-transformer`, `server-transformer`

#### `packages/compiler-test` and `packages/webpack-test`

- **Purpose**: End-to-end test suites for compiler and webpack loader

---

## 2. Addon System Architecture

### 2.1 Addon Loading Flow

The addon system operates in the following sequence:

1. **Discovery**: `AddonRegistry.loadAddonsSync()` finds addon directories
   - Looks in `addonsDir` (default: `./addons`)
   - Searches for `addon.ts`/`addon.js` or `index.ts`/`index.js`
   - Supports selective loading: only loads explicitly requested addons for performance

2. **Compilation**: TypeScript addons are compiled to JavaScript
   - Batch compilation with caching for performance
   - Output stored in adjacent `lib` directory
   - Filesystem validation and permission checking
   - Detailed error reporting with dependency analysis

3. **Module Loading**: Compiled addons loaded via `createRequire()`
   - Requires an exported `activate` function
   - Supports both CommonJS and ES module syntax
   - Handles Jest test environments specially
   - Cache invalidation when files change

4. **Activation**: `activate` function called with `AddonContext`
   - Addons register generators, processors, transformers, result processors
   - Stored in `CompilationContext` for execution
   - Error handling with detailed reporting

### 2.2 Addon Registry (`packages/core/src/compiler/addons/AddonRegistry.ts`)

**Key Features**:

- **Selective Loading**: Only loads addons explicitly requested via CLI or profiles
- **Compilation Caching**: Uses file modification times to skip unnecessary recompilation
- **Lookup Cache**: Caches addon references for performance
- **Dependency Resolution**: Recursively resolves profile dependencies
- **Error Categorization**: Detailed diagnostics for:
  - Missing addons
  - Compilation errors
  - Loading failures
  - Dependency issues
  - Filesystem problems

**Key Methods**:

- `getAddonByName(name)`: Fast lookup with cache
- `getAvailableAddons(profile?)`: Get addons for profile with dependency resolution
- `refresh()`: Clear caches and reload
- `loadAddonsSync()`: Discover and load addons

### 2.3 Compilation Context (`packages/core/src/compiler/compilation/CompilationContext.ts`)

Implements the `AddonContext` interface provided to addons.

**Key Methods**:

- `registerGenerator(fn)`: Register pre-compilation file generator
- `registerProcessor(fn)`: Register source code processor
- `registerTransformer(transformers)`: Register TypeScript transformers
- `registerResultProcessor(fn)`: Register post-compilation processor
- `addInputFile(path)`: Add file to compilation
- `addVirtualFile(path, content)`: Add virtual file without filesystem
- `getFileContent(path)`: Access potentially transformed content
- `getProfileConfig()`: Get addon-specific configuration

**Internal Structure**:

- `FileCache`: Tracks source and output files
- `LanguageService`: TypeScript language service for diagnostics
- `CompilationHost`: Custom TypeScript host
- `addonFunctions`: WeakMap tracking which addon registered each function

---

## 3. Webpack Loader Integration

### 3.1 Loader Entry Point (`packages/webpack/src/loader.ts`)

The webpack loader is simple and delegates to `TsCompiler`:

```typescript
export function loader(this: LoaderContext<WebsmithLoaderConfig>): void {
    const instance = getCompilerInstance(options, this, dependencyCallback);
    const fragment = instance.build(this.resourcePath);
    processResultAndFinish(this, fragment, instance.getProfile());
}
```

### 3.2 TsCompiler (`packages/webpack/src/TsCompiler.ts`)

Extends base `Compiler` for webpack-specific features:

**Key Features**:

- Extends webpack's dependency callback for change detection
- Manages profile-specific compilation
- Handles webpack's compilation context
- Provides version-based cache invalidation

**Instance Caching** (`compiler-instances.ts`):

- Caches `TsCompiler` instances per webpack config
- Reuses instances across multiple file compilations
- Intelligent cache invalidation on config changes

### 3.3 Compilation Queue (`packages/webpack/src/CompilationQueue.ts`)

Manages concurrent compilation requests:

- Queues compilation tasks
- Prevents race conditions
- Handles errors gracefully

### 3.4 Result Handling (`packages/webpack/src/result-handling.ts`)

Processes compiler output for webpack:

- Converts to webpack-compatible format
- Handles source maps
- Manages error/warning reporting

---

## 4. Compilation Pipeline

### 4.1 Main Compilation Flow

**Entry Points**:

1. CLI: `packages/compiler/src/bin.ts` → `addCompileCommand()` → `command.ts`
2. Webpack Loader: `packages/webpack/src/loader.ts`
3. Direct API: Import `Compiler` from `@quatico/websmith-core`

### 4.2 Detailed Pipeline (Compiler.compile())

```
1. Profile Resolution
   ├─ Single profile or multiple profiles (if `--profile` specified)
   └─ Load profile dependencies

2. For Each Profile:
   a. Create CompilationContext
      ├─ Initialize TypeScript LanguageService
      ├─ Create CompilationHost
      └─ Activate addons for this profile

   b. Create TypeScript Program
      └─ Use root files from tsconfig.json or CLI args

   c. For Each Source File (emitSourceFile):
      i.   Run Generators (unmodified input)
      ii.  Run Processors (transform source code)
      iii. Update file cache
      iv.  Transpile (run transformers + TypeScript compilation)
      v.   Process output (write files)

   d. Run ResultProcessors (all files processed)

3. Aggregate Results
   └─ Combine diagnostics from all profiles
```

### 4.3 File Processing Detail

**Generators** (`emitSourceFile()` line 316-322):

- Read unmodified source file
- Run each registered generator
- Generators can create side effects (write files, etc.)
- Cannot modify source code

**Processors** (`emitSourceFile()` line 324-331):

- Run sequentially, each receives output of previous
- Can modify source code completely
- Can add/remove imports and exports
- Stop on first error

**Cache Update** (line 333):

- Update cache with processed source code

**Transpilation** (line 336):

- Use either `transpileOnly` mode or full compilation
- Apply transformers during TypeScript compilation
- Generate output files

**Result Processors** (`emitResult()` line 393-399):

- Run once per profile (not per file)
- Access to all file names and content
- Can create additional output files

---

## 5. Configuration System

### 5.1 websmith.config.json Structure

```json
{
  "addons": ["addon-name"],           // Base addons applied to all profiles
  "addonsDir": "./addons",            // Addon directory path
  "transpileOnly": false,             // Skip type checking
  "profiles": {                        // Compilation profiles
    "client": {
      "addons": ["client-addon"],     // Profile-specific addons
      "depends": ["base"],            // Profile dependencies
      "config": {                      // Profile-specific addon config
        "apiUrl": "https://api.example.com"
      },
      "tsConfig": {                    // Profile-specific TypeScript options
        "outDir": "dist/client",
        "target": "esnext",
        "module": "esnext"
      }
    }
  }
}
```

### 5.2 Configuration Resolution (`packages/core/src/compiler/config/resolve-compiler-config.ts`)

**Process**:

1. Parse JSON with comment support via `comment-json`
2. Resolve relative paths to absolute (based on config file location)
3. Merge profile addons with base addons
4. Validate profile dependencies exist
5. Update path references in profiles

**Key Functions**:

- `resolveCompilationConfig()`: Load and parse config file
- `resolvePaths()`: Convert relative paths to absolute
- `updatePaths()`: Apply path resolution to entire config

### 5.3 Options Resolution (`packages/core/src/compiler/options/resolveCompilerOptions.ts`)

Merges configuration from multiple sources (priority order):

1. CLI arguments
2. Webpack loader options
3. Profile-specific tsConfig
4. Default tsconfig.json
5. Websmith defaults

---

## 6. Key Design Patterns

### 6.1 Registry Pattern

`AddonRegistry` maintains:

- Available addons map
- Compilation cache
- File modification time cache
- Lookup cache
- Compiler host reuse

### 6.2 Context Pattern

`CompilationContext` implements `AddonContext` to provide addons with:

- Access to TypeScript compiler
- File system operations
- Configuration
- Reporter for diagnostics
- Lifecycle hooks (generators, processors, transformers, result processors)

### 6.3 Plugin Pattern

Addons use a registration pattern:

```typescript
export const activate = (ctx: AddonContext) => {
  ctx.registerGenerator((fileName, content) => { /* ... */ });
  ctx.registerProcessor((fileName, content) => { /* ... */ });
  ctx.registerTransformer({
    before: [(ctx) => (sf) => { /* ... */ }]
  });
  ctx.registerResultProcessor((fileNames) => { /* ... */ });
};
```

### 6.4 Lazy Initialization

- WebpackAddonService initialized only when needed
- Compiler host reused if options unchanged
- Files compiled incrementally with caching

### 6.5 Error Handling Strategy

- Detailed categorization (dependency, syntax, filesystem, etc.)
- Suggestions for resolution
- Non-fatal errors allow compilation to continue
- Enhanced diagnostics with context

---

## 7. Important Implementation Details

### 7.1 Profile Dependency Resolution

Profiles can depend on other profiles via `depends` array:

```json
{
  "profiles": {
    "server": { "addons": ["server-addon"] },
    "client": {
      "addons": ["client-addon"],
      "depends": ["server"]
    }
  }
}
```

When `client` profile is selected:

1. Both `client` and `server` profiles are compiled
2. Server addons run first, then client addons
3. Circular dependencies prevented with visited set

### 7.2 Incremental Compilation

`FileCache` stores:

- Source file content and modification time
- Compiled output files
- Version number for webpack cache invalidation

**Cache Invalidation**:

- Per-file modification time tracking
- Configuration changes clear caches
- Webpack uses `version` property for smart cache

### 7.3 Watch Mode

Implemented in `Compiler.watch()`:

- Registers file watchers via `ts.System.watchFile()`
- Debounced (50ms) to prevent rapid recompilation
- Resolves dependencies and recompiles affected files
- Supports profile-based watching

### 7.4 Transformers Merging

TypeScript transformers are merged by phase:

- **before**: All "before" transformers from all addons
- **after**: All "after" transformers from all addons  
- **afterDeclarations**: All "afterDeclarations" transformers

This allows multiple addons to chainably transform code.

### 7.5 Compilation Modes

**transpileOnly**:

- Uses `ts.transpileModule()` for speed
- No type checking
- Smaller output files
- Good for webpack builds

**Full Compilation**:

- Uses TypeScript compiler API
- Type checking and .d.ts generation
- Slower but complete type information
- Used for CLI builds

**Addon Emit Only (addonEmitOnly)**:

- Only emits files that are processed by addon callbacks
- Files are **automatically marked as addon-processed** when:
  - **Processors** return different content than they received (automatic content comparison)
  - **Transformers** modify the output (automatic detection varies by compilation mode):
    - In `transpileOnly: true` mode: Compares transpiled output with/without transformers (precise)
    - In `transpileOnly: false` mode: Uses conservative strategy - emits all files when transformers are registered
  - **Generators** call `addInputFile()` or `addVirtualFile()` (marks both generated file and source file)
- All files are still compiled for dependencies and type checking
- Only addon-processed files are written to disk
- Can be combined with `transpileOnly` for different compilation strategies:
  - `transpileOnly: true` + `addonEmitOnly: true` = Fast selective builds (precise transformer detection)
  - `transpileOnly: false` + `addonEmitOnly: true` = Full compilation with selective emission (conservative transformer handling)
  - `transpileOnly: true` + `addonEmitOnly: false` = Fast builds, emit all files
  - `transpileOnly: false` + `addonEmitOnly: false` = Full builds, emit all files
- Useful for code generation workflows where original source files should remain unchanged
- Example use cases:
  - Generate API documentation from source without emitting transpiled code
  - Create transformed versions of specific files while preserving originals
  - Selective code generation pipelines
  - Decorator-based transformations (e.g., Magellan's `@service()` decorator)
- **Implementation Details**:
  - **Processor detection**: Compares content before and after processing (Compiler.ts:355-370)
  - **Transformer detection in transpileOnly mode**: Uses `ts.transpileModule()` twice to compare output with/without transformers (Compiler.ts:643-679)
  - **Transformer detection in full compilation mode**: Conservative - emits all files when transformers are registered to avoid expensive AST comparisons (Compiler.ts:620-627)
  - **Generator detection**: Files marked when `addInputFile()` or `addVirtualFile()` is called (CompilationContext.ts:126-150, 186-205)
  - **Performance impact**: Minimal in transpileOnly mode (fast transpile comparison), zero overhead in full compilation mode (conservative strategy)
- Configuration example:

  ```json
  {
    "addonsDir": "./addons",
    "addonEmitOnly": true,
    "profiles": {
      "selective": {
        "addons": ["selective-processor"],
        "config": {
          "selective-processor": {
            "filePattern": "arrow",
            "replacement": "processedFoobar"
          }
        }
      }
    }
  }
  ```

---

## 8. Webpack Loader Specifics

### 8.1 Loader Options

```typescript
interface WebsmithLoaderConfig {
  tsConfigFile?: string;              // Path to tsconfig.json
  config?: {                           // Inline config (overrides websmith.config.json)
    addonsDir?: string;
    addons?: string[];
    profiles?: Record<string, CompilationProfile>;
  };
  transpileOnly?: boolean;            // Skip type checking
  addonEmitOnly?: boolean;            // Only emit files processed by addons
  profile?: string;                   // Profile name
  warn?: (err: WebpackError) => void; // Warning handler
  error?: (err: WebpackError) => void;// Error handler
}
```

### 8.2 Dependency Tracking

Loader calls `this.addDependency(path)` for:

- All source files
- Dependencies added via `addAssetDependency()`
- Configuration file changes

### 8.3 Cache Invalidation

Webpack cache uses `loader.version`:

- Set to `CompileFragment.version` for each file
- Version incremented when source changes
- Enables incremental builds

---

## 9. Common Operations

### Adding an Addon to a Profile

1. Create `packages/addons/{addon-name}/addon.ts`
2. Export `activate` function
3. Register in `websmith.config.json` profile
4. Test with example files

### Debugging Addons

- Use `ctx.getReporter().reportDiagnostic(new InfoMessage(...))`
- Enable debug mode: `websmith --debug`
- Check `AddonRegistry` error categorization
- Review `packages/example-addons` for patterns

### Extending CompilationContext

The context is created per profile and stores:

- File cache
- Language service
- Registered functions (with addon tracking)
- Dependency maps
- Configuration

To add new capability, extend `CompilationContext` and update `AddonContext` interface.

---

## 10. Testing

- **Unit Tests**: Each package has `.spec.ts` and `.test.ts` files
- **E2E Tests**: `compiler-test` and `webpack-test` packages
- **Examples**: `example-addons` serves as reference
- **Test Utilities**: `testing` package provides helpers

---

## 11. Key Files to Know

- **Main Compiler**: `/packages/core/src/compiler/Compiler.ts` (664 lines)
- **Addon Registry**: `/packages/core/src/compiler/addons/AddonRegistry.ts` (1279 lines)
- **Compilation Context**: `/packages/core/src/compiler/compilation/CompilationContext.ts`
- **CLI Command**: `/packages/compiler/src/command.ts`
- **Webpack Loader**: `/packages/webpack/src/loader.ts` (compact, delegates to TsCompiler)
- **TsCompiler**: `/packages/webpack/src/TsCompiler.ts`
- **API Types**: `/packages/api/src/addons/AddonContext.ts`

---

## 12. Performance Considerations

1. **Addon Caching**: Compiled addons cached, only recompiled if source changed
2. **Selective Loading**: Only requested addons loaded (not all in directory)
3. **File Caching**: Source and output cached per file
4. **Compiler Host Reuse**: TypeScript compiler host reused if options unchanged
5. **Webpack Instance Pooling**: Compiler instances reused across files
6. **Incremental Builds**: Only changed files recompiled (when using watch)

---

## 13. Monorepo Standards

- **Package Manager**: pnpm
- **Build Tool**: nx (evident from nx commands in root package.json)
- **TypeScript**: Strict mode enabled
- **Testing**: Jest
- **Linting**: ESLint with TypeScript plugin
- **License**: MIT with automatic header injection

---

This guide should provide Claude instances with the foundational understanding needed to:

- Navigate the codebase effectively
- Understand addon execution flow
- Modify compilation pipeline
- Debug configuration issues
- Extend loader/compiler functionality
- Write and test new addons
