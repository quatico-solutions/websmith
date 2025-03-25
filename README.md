<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->
# @quatico/websmith

[![CI](https://github.com/quatico-solutions/websmith/actions/workflows/protect-stable.yml/badge.svg)](https://github.com/quatico-solutions/websmith/actions/workflows/protect-stable.yml)  [![npm version](https://badge.fury.io/js/@quatico%2Fwebsmith-compiler.svg)](https://www.npmjs.com/search?q=%40quatico)

This project is a compiler frontend for the [TypeScript compiler](https://github.com/microsoft/TypeScript). It's a drop-in replacement for the `tsc` command with additional customization options for the compilation process. You can apply compiler addons to modify the compilation input "before", during and "after" compiled artifacts are created. Even non-script files can be processed during the compilation process. Use the `websmith` command with an addon:

* To generate additional configuration or documentation based on the original source code,
* To create additional new source files and add them to the compilation process, or
* To change module dependencies with new or modified imports/exports.

Compiler addons can also access all transpiled files as whole and reason about the entire compilation target. The standard API for TypeScript transformers is fully integrated, thus existing `ts.CustomTransformers` can be simply called from within an addon.

## Getting started

Whenever you use the `tsc` command to compile your TypeScript project, you can replace it with the `websmith` command to apply compiler addons.

### Installation

Add websmith to your TypeScript project with the `@quatico/websmith-compiler` package. For example, use the following command with `pnpm`:

```bash
pnpm add --dev @quatico/websmith-compiler
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

The default configuration uses the `tsconfig.json` file in your project root to compile the TypeScript files. Customize the compilation process with CLI arguments (e.g., `--addons`) or in the `websmith.config.json` file:

```json
// ./websmith.config.json
{
    "addons": ["generate-client-proxies", "create-component-documentations"],
}
```

Place your `websmith.config.json` file in the root of your project and add your addons to the `addons` directory next to it. Read more about addons in the [Customizing the compilation process](#customizing-the-compilation-process) section.

### Use websmith with webpack

You can use `websmith-loader` as drop-in replacement for the `ts-loader` to apply websmith addons to your TypeScript files.

Install the `websmith-loader` package:

```bash
pnpm add --dev websmith-loader
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

## Customizing the compilation process

Compiler addons can be used for code generation, but also to process non-script files during the compilation, e.g. for style compilation with Sass or PostCSS, for documentation with YAML or Markdown.

### Create a compiler addon

Websmith addons are ECMAScript modules with an `activate` function that takes an `AddonContext` as its only parameter. Install the `@quatico/websmith-api` package to use the `AddonContext` type:

```bash
pnpm add --dev @quatico/websmith-api
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

Read more about implementing addons in the [Write your own addon](docs/write-your-own-addon.md) section for detailed instructions and examples.

### Find addon examples

You can find a few examples for addons in the [@quatico/websmith-examples](https://github.com/quatico-solutions/websmith/tree/develop/packages/example-addons/README.md) package.

Install the `@quatico/websmith-examples` package to use the examples:

```bash
pnpm add --dev @quatico/websmith-examples
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

The compilation profile is applied to the compilation process and the addons are activated with the profile specific options. For more information on how to activate addons, see the [compiler README](https://github.com/quatico-solutions/websmith/tree/develop/packages/compiler/README.md).
