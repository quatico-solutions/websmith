<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# Addon Rules

How addons are discovered, compiled, loaded and activated, what `AddonContext` offers, and how to write and debug
addons.

## CRITICAL: Export an `activate` Function

**The Rule:** Every addon MUST export an `activate(ctx: AddonContext)` function (CommonJS or ES module syntax).

**Why?** `AddonRegistry` looks for `activate` on the loaded module. If an `addon.ts` lacks it, the registry emits a
warning (`does not export an "activate" function and will be ignored`) and the addon silently does nothing.

### Wrong

```typescript
// ❌ Default-exported object, no activate: the addon is ignored
export default {
    run: (ctx: AddonContext) => ctx.registerProcessor(myProcessor),
};
```

### Correct

```typescript
// ✅ Named activate export registering callbacks
import { type AddonContext } from "@quatico/websmith-api";

export const activate = (ctx: AddonContext): void => {
    ctx.registerGenerator((fileName, content) => { /* side effects only */ });
    ctx.registerProcessor((fileName, content) => content /* modified source */);
    ctx.registerTransformer({ before: [ctx => sf => sf] });
    ctx.registerResultProcessor((emittedFiles, context) => { /* after all files; context gives fs access and utilities */ });
};
```

## CRITICAL: Pick the Right Callback

**The Rule:** Generators NEVER modify source code. Processors change source text. Transformers change the AST
during emit. Result processors run once per profile after emit.

**Why?** Each callback runs at a fixed point in the pipeline (see `architecture.md`). Using the wrong one either
has no effect (a generator's return value is ignored) or breaks `addonEmitOnly` detection.

| Callback | Runs | Input | May |
|----------|------|-------|-----|
| Generator | per file, before processors | unmodified source | create side effects, `addInputFile`, `addVirtualFile`, write files |
| Processor | per file, sequentially | previous processor's output | rewrite source, add/remove imports and exports; first error stops the chain |
| Transformer | per file, inside TypeScript emit | `ts.SourceFile` | rewrite the AST |
| ResultProcessor | once per profile, after emit | emitted files + `AddonContext` | create supplementary files (docs, metadata, reports) via the context's file system and utilities |

### Wrong

```typescript
// ❌ Generator trying to change the source: the return value is discarded
ctx.registerGenerator((fileName, content) => content.replace(/foo/g, "bar"));
```

### Correct

```typescript
// ✅ Pure AST changes belong in a transformer
ctx.registerTransformer({ before: [createReplaceIdentifierTransformer(/foobar/gi, "barfoo")] });
```

Prefer transformers for pure AST manipulation. Use processors when you must change imports/exports before
compilation (so TypeScript resolves them), need explicit error handling, or chain transformations with custom
recovery (see `packages/example-addons/src/foobar-replace-processor` vs `client-processor`).

## Loading Flow

1. **Discovery** — `AddonRegistry.loadAddonsSync()` scans `addonsDir` (default `./addons`) for directories with
   `addon.ts`/`addon.js` or `index.ts`/`index.js`. Only explicitly requested addons (CLI `--addons` or profile)
   are loaded.
2. **Compilation** — TypeScript addons compile to JavaScript in an adjacent `lib` directory, batched and cached by
   file modification time, with filesystem/permission validation and error reports that include dependency
   analysis.
3. **Module loading** — via `createRequire()`; needs the `activate` export; supports CommonJS and ES modules;
   handles Jest test environments specially; invalidates the cache when files change.
4. **Activation** — `activate(ctx)` registers generators, processors, transformers and result processors, which
   `CompilationContext` stores for execution. Errors are reported in detail.

## AddonRegistry

`packages/core/src/compiler/addons/AddonRegistry.ts`

- **Selective loading** of requested addons only.
- **Compilation caching** keyed on file modification times.
- **Lookup cache** for addon references.
- **Dependency resolution** of profile dependencies (recursive).
- **Error categorization**: missing addons, compilation errors, loading failures, dependency issues,
  filesystem problems.

Key methods: `getAddonByName(name)` (cached lookup), `getAvailableAddons(profile?)` (addons for a profile incl.
dependencies), `refresh()` (clear caches and reload), `loadAddonsSync()` (discover and load).

## AddonContext / CompilationContext

`CompilationContext` (`packages/core/src/compiler/compilation/`) implements `AddonContext` and is created per
profile.

| Method | Purpose |
|--------|---------|
| `registerGenerator(fn)` | pre-compilation file generator |
| `registerProcessor(fn)` | source code processor |
| `registerTransformer(transformers)` | TypeScript custom transformers |
| `registerResultProcessor(fn)` | post-compilation processor |
| `addInputFile(path)` | add a file to the compilation |
| `addVirtualFile(path, content)` | add a file without touching the filesystem |
| `addAssetDependency(child, parent)` | declare a dependency for change detection |
| `getFileContent(path)` | read possibly transformed content |
| `getProfileConfig()` | addon-specific configuration of the profile |
| `getReporter()` | report diagnostics |
| `markFileAsAddonProcessed(path)` | force emission under `addonEmitOnly` |

Internally it holds the `FileCache`, the `LanguageService`, the `CompilationHost`, dependency maps, the
configuration, and an `addonFunctions` WeakMap recording which addon registered each callback.

To add a capability: extend `CompilationContext` **and** the `AddonContext` interface in `packages/api`.

## Transformer Merging

Transformers are merged by phase across all active addons: all `before`, all `after`, all
`afterDeclarations`. Multiple addons therefore chain on the same phase.

### Wrong

```typescript
// ❌ Assuming your transformer is the only one in its phase
ctx.registerTransformer({ before: [ctx => sf => ts.factory.createSourceFile([], eofToken, 0)] });
```

### Correct

```typescript
// ✅ Transform only the nodes you own; return others untouched for the next transformer
ctx.registerTransformer({ before: [ctx => sf => ts.visitEachChild(sf, visitOwnNodes, ctx)] });
```

## Profile Dependencies and Execution Order

With `depends`, selecting `client` that depends on `server` compiles both; server addons run first, then client
addons. A visited set prevents circular dependencies. Configuration details: `configuration.md`.

## Performance: `needsTypeInfo`

Addons can export `needsTypeInfo = false` (see `CompilerAddon` in `packages/api`) to opt into the
`transpileModule` fast path. The fast path is used only when **all** active addons of a profile set it to
`false` and no declarations are required (or `transpileOnly` is on). Legacy addons (undefined) keep the full
program.

```typescript
// ✅ Opt in only when the addon needs no type checker
export const needsTypeInfo = false;
```

## Adding an Addon

1. Create `<addonsDir>/<addon-name>/addon.ts` (examples: `packages/example-addons/src/<name>/addon.ts`).
2. Export `activate`.
3. Register the addon in `websmith.config.json` (base `addons` or a profile).
4. Test it with example files (see `testing.md`).

## Debugging Addons

- Report through the context, NEVER with `console`:

```typescript
// ❌ Fails lint (no-console) and bypasses the reporter
console.log("processing", fileName);
```

```typescript
// ✅ Reporter-based diagnostics
ctx.getReporter().reportDiagnostic(new InfoMessage(`processing ${fileName}`));
```

- Run the CLI with `--debug`.
- Check the `AddonRegistry` error categories in the output.
- Compare with `packages/example-addons`: `foo-added-generator` (creates source files), `foobar-export-processor`
  (modifies exports), `foobar-replace-transformer` (replaces identifiers), `export-yaml-generator` (config as
  YAML), and the profile examples `client-processor`, `server-processor`, `client-transformer`,
  `server-transformer`.

**Related:** `architecture.md` (pipeline), `configuration.md` (profiles, `addonEmitOnly`), `testing.md`.
