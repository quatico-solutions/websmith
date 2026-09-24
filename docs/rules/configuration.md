<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->

# Configuration Rules

`websmith.config.json`, profiles, option resolution, and the compilation modes `transpileOnly` and
`addonEmitOnly`.

## CRITICAL: Profile `config` Is Shared by All Addons of the Profile

**The Rule:** A profile's `config` is one opaque object. `ctx.getProfileConfig()` returns it unchanged to
**every** addon of that profile. Namespace per-addon settings under the addon name, and read them defensively.

**Why?** websmith does not split `config` per addon. Two addons reading a flat `replacement` key would silently
share (and fight over) it.

### Wrong

```json
{ "profiles": { "p": { "addons": ["a", "b"], "config": { "replacement": "x" } } } }
```

**What's wrong?** Both `a` and `b` see `replacement`; neither owns it.

### Correct

```json
{ "profiles": { "p": { "addons": ["a", "b"], "config": { "a": { "replacement": "x" } } } } }
```

```typescript
// ✅ Addon accepts nested (by addon name) and flat config
const profileConfig = ctx.getProfileConfig();
const addonConfig = (profileConfig as Record<string, MyConfig>)?.["my-addon"] ?? profileConfig;
```

A flat `config` (e.g. `{ "apiUrl": "https://api.example.com" }`) is fine for single-addon profiles.

## websmith.config.json

```jsonc
{
    "addons": ["addon-name"],          // base addons, applied to all profiles
    "addonsDir": "./addons",           // addon directory
    "transpileOnly": false,            // skip type checking
    "addonEmitOnly": false,            // emit only addon-processed files
    "profiles": {
        "client": {
            "addons": ["client-addon"],    // profile-specific addons
            "depends": ["base"],           // profile dependencies
            "config": {                    // profile-specific addon config
                "apiUrl": "https://api.example.com"
            },
            "tsConfig": {                  // profile-specific TypeScript options
                "outDir": "dist/client",
                "target": "esnext",
                "module": "esnext"
            }
        }
    }
}
```

Comments are allowed: the file is parsed with `comment-json`.

## Configuration Resolution

`packages/core/src/compiler/config/resolve-compiler-config.ts`

1. Parse JSON with comment support (`comment-json`).
2. Resolve relative paths to absolute, based on the config file location.
3. Merge profile addons with base addons.
4. Validate that profile dependencies exist.
5. Update path references in profiles.

Functions: `resolveCompilationConfig()` (load and parse), `resolvePaths()` (relative → absolute for
`tsConfig`), `resolvePath()` (single path).

### Wrong

```typescript
// ❌ Resolving against process.cwd(): breaks when the config lives elsewhere
const dir = path.resolve(config.addonsDir);
```

### Correct

```typescript
// ✅ Resolve against the config file's directory
const dir = resolvePath(system, basePath, config.addonsDir);
```

## Options Resolution

`packages/core/src/compiler/options/resolveCompilerOptions.ts` merges sources, highest priority first:

1. CLI arguments
2. webpack loader options
3. Profile-specific `tsConfig`
4. Default `tsconfig.json`
5. websmith defaults

**Rule:** A new option MUST be threaded through this chain in priority order, not read ad hoc from one source.

## Profile Dependencies

```json
{
    "profiles": {
        "server": { "addons": ["server-addon"] },
        "client": { "addons": ["client-addon"], "depends": ["server"] }
    }
}
```

Selecting `client` compiles both `client` and `server`; server addons run first, then client addons. A visited
set prevents circular dependencies. Unknown names in `depends` fail validation.

## Compilation Modes

### transpileOnly

- Uses `ts.transpileModule()`: fast, no type checking, smaller output.
- Good for webpack builds.
- Cannot produce `.d.ts` files.

### Full compilation

- Uses the TypeScript compiler API: type checking and `.d.ts` generation.
- Slower but complete type information; used for CLI builds.

### addonEmitOnly

Emits only files processed by addon callbacks. All files are still compiled for dependencies and type checking;
only addon-processed files are written.

A file is **automatically marked** as addon-processed when:

- a **processor** returns content different from what it received (content comparison in `emitSourceFile`);
- a **transformer** changes the output. Detection compares output with and without transformers:
  - `transpileOnly: true` — `ts.transpileModule()` twice (`Compiler.transpile`);
  - `transpileOnly: false` — `program.emit()` / language-service emit with and without transformers
    (`transpileInternal`, `transpileSourceCode`);
- a **generator** calls `addInputFile()` or `addVirtualFile()` — marks both the generated file and the current
  source file (`CompilationContext`).

Addons can force emission with `ctx.markFileAsAddonProcessed(fileName)`.

Baseline (no-transformer) output is computed once and cached per file, so the overhead is small in both modes.

| transpileOnly | addonEmitOnly | Result |
|---------------|---------------|--------|
| true | true | fast selective builds (precise transformer detection) |
| false | true | full compilation, selective emission (precise transformer detection) |
| true | false | fast builds, emit all files |
| false | false | full builds, emit all files |

Use cases: API docs generated from source without emitting transpiled code; transformed copies of specific files
while keeping originals; selective code-generation pipelines; decorator-based transformations (e.g. Magellan's
`@service()` decorator).

Result processors receive only the emitted files: with `addonEmitOnly: true` only addon-processed files, with
`false` all compiled files. Files that result processors create are not subject to `addonEmitOnly` filtering.

```json
{
    "addonsDir": "./addons",
    "addonEmitOnly": true,
    "profiles": {
        "selective": {
            "addons": ["selective-processor"],
            "config": {
                "selective-processor": { "filePattern": "arrow", "replacement": "processedFoobar" }
            }
        }
    }
}
```

### Wrong

```typescript
// ❌ Processor that always rewrites (e.g. reformats) every file: every file counts as processed
ctx.registerProcessor((fileName, content) => prettier.format(content));
```

### Correct

```typescript
// ✅ Return the original string untouched when nothing applies
ctx.registerProcessor((fileName, content) => (fileName.includes(pattern) ? content.replace(re, repl) : content));
```

## webpack Loader Overrides

Loader options (`transpileOnly`, `addonEmitOnly`, `profiles`, `config`, `configFile`, `tsConfigFile`, `profile`)
override values from `websmith.config.json`. Full type: see `architecture.md` → Loader options.

**Related:** `addons.md` (callbacks and `getProfileConfig`), `architecture.md` (pipeline).
