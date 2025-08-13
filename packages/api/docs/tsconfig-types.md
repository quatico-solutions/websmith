# TypeScript Configuration Types

This document describes the comprehensive TypeScript types available for working with `tsconfig.json` files in the Websmith API package.

## Overview

The `TsConfigOptions` type provides complete type coverage for all possible `tsconfig.json` configuration options, including:

- Compiler options (with proper JSON string values, not TypeScript internal enums)
- File inclusion/exclusion patterns
- Project references
- Type acquisition settings
- Watch options
- Build options
- ts-node configuration

**Key Feature:** Unlike TypeScript's built-in `ts.CompilerOptions`, these types use the actual string literal values that appear in tsconfig.json files (e.g., `"ES2020"`, `"CommonJS"`) rather than internal enum numbers. This makes them perfect for JSON serialization and working with actual tsconfig.json file content.

## Main Types

### `TsConfigOptions`

The main interface that represents a complete `tsconfig.json` file structure.

```typescript
import { TsConfigOptions } from "@quatico/websmith-api";

const tsconfig: TsConfigOptions = {
    compilerOptions: {
        target: "ES2020",
        module: "ESNext",
        strict: true
    },
    include: ["src/**/*"],
    exclude: ["node_modules"]
};
```

### `TsConfigCompilerOptions`

TypeScript compiler options as they appear in tsconfig.json files. This uses string literal types for values instead of TypeScript's internal enum values, making it perfect for representing actual tsconfig.json content.

```typescript
import { TsConfigCompilerOptions } from "@quatico/websmith-api";

const compilerOptions: TsConfigCompilerOptions = {
    target: "ES2020",        // String literal, not enum value
    module: "ESNext",        // String literal, not enum value
    strict: true,
    plugins: [
        {
            name: "typescript-plugin-css-modules"
        }
    ]
};
```

> **Note:** This type uses the actual string values that appear in tsconfig.json files (e.g., `"ES2020"`, `"ESNext"`) rather than TypeScript's internal enum values (e.g., `99`, `100`). This makes it suitable for JSON serialization and actual tsconfig.json file representation.

## Supported Sections

### Compiler Options

All TypeScript compiler options are supported, including:

- **Basic Options**: `target`, `module`, `lib`, `allowJs`, `checkJs`, etc.
- **Strict Type Checking**: `strict`, `noImplicitAny`, `strictNullChecks`, etc.
- **Module Resolution**: `moduleResolution`, `baseUrl`, `paths`, `typeRoots`, etc.
- **Source Maps**: `sourceMap`, `inlineSourceMap`, `sourceRoot`, etc.
- **Experimental**: `experimentalDecorators`, `emitDecoratorMetadata`, etc.
- **Advanced**: `skipLibCheck`, `forceConsistentCasingInFileNames`, etc.

### Top-Level Properties

- `files`: Array of specific files to include
- `include`: Array of glob patterns for files to include
- `exclude`: Array of glob patterns for files to exclude
- `extends`: Base configuration file(s) to inherit from
- `references`: Project references for multi-project builds
- `compileOnSave`: Enable compile-on-save functionality

### Additional Sections

- `typeAcquisition`: Type acquisition settings for JavaScript projects
- `watchOptions`: File watching configuration
- `buildOptions`: Build-specific options for project references
- `ts-node`: Configuration for the ts-node runtime

## Utility Types

### `TsConfigOptionKey`

Union type of all possible tsconfig.json option keys.

```typescript
import { TsConfigOptionKey } from "@quatico/websmith-api";

const key: TsConfigOptionKey = "compilerOptions"; // Valid
const anotherKey: TsConfigOptionKey = "include"; // Valid
```

### `CompilerOptionKey`

Union type of all compiler option keys.

```typescript
import { CompilerOptionKey } from "@quatico/websmith-api";

const option: CompilerOptionKey = "target"; // Valid
const anotherOption: CompilerOptionKey = "strict"; // Valid
```

### `TsConfigTopLevelKey`

Union type of all top-level tsconfig.json keys.

```typescript
import { TsConfigTopLevelKey } from "@quatico/websmith-api";

const topLevelKey: TsConfigTopLevelKey = "compilerOptions"; // Valid
const anotherTopLevelKey: TsConfigTopLevelKey = "references"; // Valid
```

## Enums

### `WatchFileKind`

Strategies for watching individual files:

- `FixedPollingInterval`
- `PriorityPollingInterval`
- `DynamicPriorityPolling`
- `FixedChunkSizePolling`
- `UseFsEvents`
- `UseFsEventsOnParentDirectory`

### `WatchDirectoryKind`

Strategies for watching directories:

- `UseFsEvents`
- `FixedPollingInterval`
- `DynamicPriorityPolling`
- `FixedChunkSizePolling`

### `PollingWatchKind`

Polling strategies for file watching:

- `FixedInterval`
- `PriorityInterval`
- `DynamicPriority`
- `FixedChunkSize`

## Examples

### Basic Configuration

```typescript
import { TsConfigOptions } from "@quatico/websmith-api";

const basicConfig: TsConfigOptions = {
    compilerOptions: {
        target: "ES2020",
        module: "CommonJS",
        strict: true,
        esModuleInterop: true,
        outDir: "./dist",
        rootDir: "./src"
    },
    include: ["src/**/*"],
    exclude: ["node_modules"]
};
```

### React Project Configuration

```typescript
import { TsConfigOptions } from "@quatico/websmith-api";

const reactConfig: TsConfigOptions = {
    compilerOptions: {
        target: "ES2020",
        lib: ["DOM", "DOM.Iterable", "ES6"],
        allowJs: true,
        skipLibCheck: true,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        strict: true,
        forceConsistentCasingInFileNames: true,
        module: "ESNext",
        moduleResolution: "node",
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        jsx: "react-jsx"
    },
    include: ["src"],
    exclude: ["node_modules"]
};
```

### Monorepo Configuration with Project References

```typescript
import { TsConfigOptions } from "@quatico/websmith-api";

const monorepoConfig: TsConfigOptions = {
    compilerOptions: {
        target: "ES2020",
        module: "ESNext",
        strict: true,
        composite: true,
        declaration: true,
        declarationMap: true
    },
    references: [
        { path: "./packages/core" },
        { path: "./packages/utils" },
        { path: "./packages/api" }
    ],
    include: ["src/**/*"],
    exclude: ["node_modules", "dist"]
};
```

### Configuration with Plugins

```typescript
import { TsConfigOptions } from "@quatico/websmith-api";

const configWithPlugins: TsConfigOptions = {
    compilerOptions: {
        target: "ES2020",
        module: "ESNext",
        strict: true,
        plugins: [
            {
                name: "typescript-plugin-css-modules"
            },
            {
                name: "@typescript-eslint/eslint-plugin",
                rules: {
                    "no-unused-vars": "error"
                }
            }
        ]
    },
    include: ["src/**/*"]
};
```

## Type Safety Benefits

Using these types provides several benefits:

1. **IntelliSense Support**: Full autocomplete for all tsconfig.json options
2. **Type Checking**: Compile-time validation of configuration values
3. **Documentation**: Built-in JSDoc comments for all options
4. **Consistency**: Ensures consistent configuration across projects
5. **Future-Proof**: Automatically includes new TypeScript compiler options

## Integration with Websmith

These types are designed to work seamlessly with the Websmith compiler infrastructure and can be used in:

- Configuration file validation
- Compiler option processing
- Project setup utilities
- Build tool integrations
- IDE extensions

For more examples, see the `examples/tsconfig-example.ts` file in the API package.
