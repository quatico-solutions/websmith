<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->
# @quatico/websmith

[![CI](https://github.com/quatico-solutions/websmith/actions/workflows/protect-stable.yml/badge.svg)](https://github.com/quatico-solutions/websmith/actions/workflows/protect-stable.yml)  [![npm version](https://badge.fury.io/js/@quatico%2Fwebsmith-compiler.svg)](https://www.npmjs.com/search?q=%40quatico)

This project is a compiler frontend for the [TypeScript compiler](https://github.com/microsoft/TypeScript#readme). It's a drop-in replacement for the `tsc` command with additional customization options for the compilation output. You can apply compiler addons to modify the compilation input before, during and after compiled artifacts are created. Even non-script files can be processed during the compilation process. Use the `websmith` command with an addon:

* To generate additional configuration or documentation based on the original source code,
* To create additional new source files and add them to the compilation process, or
* To change module dependencies with new or modified imports/exports.

Compiler addons can also access all transpiled files as whole and reason about the entire compilation target. The standard API for TypeScript transformers is fully integrated, thus existing `ts.CustomTransformers` can be simply called from within an addon.

## Getting started

Whenever you use the `tsc` command to compile your TypeScript project, you can replace it with the `websmith` command to apply compiler addons.

### Installation

Add websmith to your TypeScript project with the `@quatico/websmith-compiler` package. For example, use the following command with `pnpm`:

```bash
pnpm add -D @quatico/websmith-compiler
```

If you don't have added the "typescript" dependency yet, add it to your project too.

### Use websmith in your package.json

In your package.json, add the `websmith` command as your build target to the `scripts` section:

 ```json
// ./package.json
 {
     //...
     "scripts": {
         "build": "websmith",
     },
     //...
 }
 ```

The default configuration uses the `tsconfig.json` file in your project root to compile the TypeScript files. Customize the compilation output with CLI arguments (e.g., `--addons`) or in the `websmith.config.json` file:

```json
// ./websmith.config.json
{
    "addons": ["generate-client-proxies", "create-component-documentations"],
}
```

Place your `websmith.config.json` file in the root of your project and add your addons to the `addons` directory next to it. Read more about addons in the [Customizing the compilation output](#customizing-the-compilation-output) section.

### Use websmith with webpack

You can use `websmith-loader` as drop-in replacement for the `ts-loader` to apply websmith addons to your TypeScript files.

Install the `websmith-loader` package:

```bash
pnpm add -D websmith-loader
```

In your webpack configuration, replace the `ts-loader` with the `websmith-loader`:

```javascript
module.exports = {
    // ...
    module: {
        rules: [{ test: /\.tsx?$/, loader: 'websmith-loader' }],
    },
};
```

Add the `websmith-loader` to the `rules` section of your webpack configuration. The `websmith-loader` is configured with the `websmith.config.json` file in the root of your project or with the `config` option in the `websmith-loader` section:

```javascript
module.exports = {
    // ...
    module: {
        rules: [{ test: /\.tsx?$/, loader: 'websmith-loader', options: { 
            config: {
                addonsDir: "./addons",
                addons: ["export-yaml-configuration"],
            },
        } }],
    },
};
```

## <a name="customizing-the-compilation-output"></a>Customizing the compilation output

Compiler addons can be used for code generation, but also to process non-script files during the compilation, e.g. for style compilation with Sass or PostCSS, for documentation with YAML or Markdown.

### Create a compiler addon

Websmith addons are ECMAScript modules with an `activate` function that takes an `AddonContext` as its only parameter. Install the `@quatico/websmith-api` package to use the `AddonContext` type:

```bash
pnpm add -D @quatico/websmith-api
```

Create an directory e.g. `my-code-generator` in the `addons` folder in your project folder and add an ECMAScript module named `addon.ts` or `addon.js`:

```javascript
// ./addons/my-code-generator/addon.ts
import { AddonContext } from '@quatico/websmith-api';
import ts from "typescript";

export const activate = (ctx: AddonContext) => {
    
    ctx.registerGenerator((fileName: string, content: string): void => {
        // for example, register a source generator to generate additional source inputs 
    });
    
    ctx.registerProcessor((fileName: string, content: string): string | never => {
        // or, register a source processor manipulate the source input before it's compiled
    });

    ctx.registerTransformer((options: ts.CustomTransformers): ts.CustomTransformers => {
        // or, register a TypeScript transformer to manipulate the source input during the compilation
    });

    ctx.registerResultProcessor((fileNames: string[]): void => {
        // or, register a result processor to manipulate the compiled output after the compilation
    });
}
```

The file must have an exported function named `activate` that takes an `AddonContext` as its only parameter.

Read more about implementing addons in the [Write your own addon](packages/api/docs/write-your-own-addon.md) section for detailed instructions and examples.

### Find addon examples

You can find a few examples for addons in the [@quatico/websmith-examples](packages/example-addons#readme) package.

Install the `@quatico/websmith-examples` package to use the examples:

```bash
pnpm add -D @quatico/websmith-examples
```

The `@quatico/websmith-examples` package contains the following examples:

* `generate-client-proxies`: a simple addon to generate client proxies
* `create-component-documentations`: a simple addon to create component documentations
* `export-yaml-configuration`: a simple addon to export the configuration as YAML file
* `foobar-added-generator`: a simple addon to generate additional source files
* `foobar-export-processor`: a simple addon to process the compiled output after the compilation
* `foobar-replace-transformer`: a simple addon to replace the source code during the compilation

## Using compilation profiles

A compilation profile is a set of options that specify the environment for a compilation output. You can define a custom compilation profile by adding a `profiles` section to the `websmith.config.json` file. The `profiles` section contains a unique profile `name` and a set of options. The `name` is used to specify the profile when calling the websmith compiler. The options are used to configure the compilation process. The options contain the following sections:

* `addons`: a list of addon names to apply for this profile
* `config`: profile specific configuration properties defined by your addon
* `tsConfig`: a set of compiler options for the TypeScript compiler to use for this profile

An example for a custom compilation profile:

```json
// ./websmith.config.json
{
    "profiles": {
        "client": {
            "addons": ["generate-client-proxies", "create-component-documentation"],
            "config": {
                "publicPath": "/assets",
                "apiUrl": "https://api.example.com"
            },
            "tsConfig": {
                "outDir": "dist/client",
                "module": "esnext",
                "target": "esnext",
            }
        },
        "server": {
            "addons": ["generate-service-functions"],
            "tsConfig": {
                "outDir": "dist/server",
                "module": "commonjs",
                "target": "es5",
            }

        }
    }
}
```

### Activate a compilation profile

To use a compilation profile, specify the profile name when calling the websmith compiler in your `package.json` file:

```json
// ./package.json
{
    "scripts": {
        "build": "websmith --profile client"
    }
}w
```

The compilation profile is applied to the compilation process and the addons are activated with the profile specific options. For more information on how to activate addons, see the [compiler README](packages/compiler#readme).

## Selective File Emission with addonEmitOnly

The `addonEmitOnly` mode allows you to control which files are emitted during compilation. When enabled, only files that are explicitly processed, transformed, or generated by addons will be written to the output directory. All files are still compiled for type checking and dependency resolution, but unprocessed files are not emitted.

### Configuration

Enable `addonEmitOnly` in your `websmith.config.json`:

```json
// ./websmith.config.json
{
    "addonsDir": "./addons",
    "addonEmitOnly": true,
    "profiles": {
        "selective": {
            "addons": ["my-selective-addon"],
            "config": {
                "filePattern": "service"
            }
        }
    }
}
```

### Combining with transpileOnly

The `addonEmitOnly` mode can be combined with `transpileOnly` for different compilation strategies:

| Mode | transpileOnly | addonEmitOnly | Behavior |
|------|--------------|---------------|----------|
| **Full Selective** | `false` | `true` | Full compilation with type checking. Only addon-processed files are emitted. Conservative: emits all files when transformers are registered. |
| **Fast Selective** | `true` | `true` | Fast transpilation without type checking. Only addon-processed files are emitted. Precise: compares output to detect transformer changes. |
| **Full Emission** | `false` | `false` | Full compilation with type checking. All files are emitted. |
| **Fast Emission** | `true` | `false` | Fast transpilation without type checking. All files are emitted. |

**Example configuration:**

```json
// ./websmith.config.json
{
    "transpileOnly": true,
    "addonEmitOnly": true,
    "profiles": {
        "fast-selective": {
            "addons": ["my-transformer-addon"]
        }
    }
}
```

### Automatic Detection of Processed Files

Websmith automatically detects which files have been processed by addons. The detection mechanism varies by addon type:

#### Processors

Processors are functions that modify source code before compilation. A file is marked as processed when:

* The processor **returns different content** than it received

**Example:**

```typescript
// ./addons/my-processor/addon.ts
export const activate = (ctx: AddonContext) => {
    ctx.registerProcessor((fileName: string, content: string): string => {
        // Return modified content - file will be marked as processed
        return content.replace(/oldPattern/g, 'newPattern');

        // Return original content - file will NOT be marked as processed
        // return content;
    });
};
```

**Detection:** Content comparison before and after processing

#### Transformers

Transformers are TypeScript AST transformers that modify code during compilation. Detection strategy depends on compilation mode:

**In transpileOnly mode (`transpileOnly: true`):**

* Websmith compares the transpiled output **with and without transformers**
* If outputs differ, the file is marked as processed
* This is precise but requires transpiling each file twice

**In full compilation mode (`transpileOnly: false`):**

* Websmith uses a **conservative strategy**
* When transformers are registered, **all files are emitted**
* This avoids expensive AST comparisons during full compilation

**Example:**

```typescript
// ./addons/my-transformer/addon.ts
export const activate = (ctx: AddonContext) => {
    const transformer: ts.TransformerFactory<ts.SourceFile> = (_context) => {
        return (sourceFile) => {
            // Transform the AST
            const transformedStatements = sourceFile.statements.map(stmt => {
                // Modify statements as needed
                return stmt;
            });

            // Return modified source file
            return ts.factory.updateSourceFile(sourceFile, transformedStatements);

            // Framework automatically detects changes by comparing output
        };
    };

    ctx.registerTransformer({ before: [transformer] });
};
```

**Detection:**

* `transpileOnly: true` → Output comparison (precise)
* `transpileOnly: false` → Conservative emission (all files when transformers present)

#### Generators

Generators create additional source files during compilation. A file is marked as processed when:

* The generator calls `ctx.addInputFile()` or `ctx.addVirtualFile()`
* Both the **generated file** and the **source file** that triggered generation are marked

**Example:**

```typescript
// ./addons/my-generator/addon.ts
export const activate = (ctx: AddonContext) => {
    ctx.registerGenerator((fileName: string, content: string): void => {
        if (fileName.includes('service')) {
            // Generate a companion file
            const generatedFile = fileName.replace('.ts', '.generated.ts');
            const generatedContent = `// Generated from ${fileName}\nexport const metadata = { source: "${fileName}" };`;

            // This marks BOTH the generated file AND the source file as processed
            ctx.addVirtualFile(generatedFile, generatedContent);
        }
    });
};
```

**Detection:** Explicit via `addInputFile()` or `addVirtualFile()` calls

#### Result Processors

Result processors operate after compilation and receive the list of files that were actually emitted. They can generate supplementary files like documentation, metadata, or reports.

**Key characteristics:**
* Run after all other addons and compilation is complete
* Receive only the files that were actually emitted (respecting `addonEmitOnly`)
* Have access to AddonContext for file system operations and utilities
* Can create additional output files directly

**Example:**

```typescript
// ./addons/my-result-processor/addon.ts
export const activate = (ctx: AddonContext) => {
    ctx.registerResultProcessor((emittedFiles: string[], processorCtx: AddonContext): void => {
        const system = processorCtx.getSystem();
        const outDir = processorCtx.getCompilerOptions().outDir;

        if (!outDir) return;

        // Create metadata about emitted files
        const metadata = {
            timestamp: new Date().toISOString(),
            totalFiles: emittedFiles.length,
            files: emittedFiles.map(filePath => ({
                path: filePath,
                name: path.basename(filePath),
                size: system.readFile(filePath)?.length ?? 0,
            })),
        };

        // Write metadata file
        const metadataPath = path.join(outDir, "build-metadata.json");
        system.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    });
};
```

**Detection:** Result processors receive the actual emitted files list
* When `addonEmitOnly: true` → Only addon-processed files are passed
* When `addonEmitOnly: false` → All compiled files are passed
* Result processors can create their own output files which are not subject to `addonEmitOnly`

### Use Cases

**Code Generation Workflows:**

```json
{
    "transpileOnly": false,
    "addonEmitOnly": true,
    "profiles": {
        "documentation": {
            "addons": ["generate-api-docs"],
            "config": {
                "outputFormat": "markdown"
            }
        }
    }
}
```

**Selective Transformation:**

```json
{
    "transpileOnly": true,
    "addonEmitOnly": true,
    "profiles": {
        "decorators": {
            "addons": ["process-decorators"],
            "config": {
                "decoratorPattern": "@service"
            }
        }
    }
}
```

**Performance Optimization:**

```json
{
    "transpileOnly": true,
    "addonEmitOnly": true,
    "profiles": {
        "changed-files-only": {
            "addons": ["track-changes"]
        }
    }
}
```

### Best Practices

1. **Use `transpileOnly: true` with `addonEmitOnly: true`** for fast selective builds during development
2. **Use `transpileOnly: false` with `addonEmitOnly: true`** for production builds with type checking when using transformers
3. **Return original content** from processors when no changes are needed to avoid unnecessary emission
4. **Check file patterns** in generators to prevent processing generated files (avoid infinite loops)
5. **Combine with profiles** to create different selective compilation strategies for different environments
