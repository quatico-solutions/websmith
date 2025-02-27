<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->
# @quatico/websmith

[![CI](https://github.com/quatico-solutions/websmith/actions/workflows/protect-stable.yml/badge.svg)](https://github.com/quatico-solutions/websmith/actions/workflows/protect-stable.yml)  [![npm version](https://badge.fury.io/js/@quatico%2Fwebsmith-compiler.svg)](https://www.npmjs.com/search?q=%40quatico)

This project is a compiler frontend for the [TypeScript compiler](https://github.com/microsoft/TypeScript). It's a drop-in replacement for the `tsc` command and provides additional API for customizing the compilation process with addons. Provide your own compiler addons to modify the compilation input "before" the actual compilation process, during the compilation process or "after" compiled artifacts are created. An addon can

* consume the unmodified source files to generate additional information based on the original source code,
* create additional new input files and add them to the compilation process, or
* modify input files to change module dependencies and modify imports/exports.

Compiler addons can also access all transpiled files as whole and reason about the entire compilation target. The standard API for TypeScript transformers is fully integrated, thus existing `ts.CustomTransformers` can be simply called from within every addon.

## Getting started

### Installation

Install the following packages to add websmith to your TypeScript project. For example, execute the following command in your command line environment using `pnpm`:

```bash
pnpm add typescript @quatico/websmith-compiler @quatico/websmith-api --dev
```

### Add websmith to package.json

In your package.json, add the `websmith` command as your build target to the `scripts` section:

 ```json
 {
     //...
     "scripts": {
         "build": "websmith",
         //...
     },
     //...
 }
 ```

### Build your project

The default configuration uses your `tsconfig.json` file to compile the TypeScript files and looks for compiler addons in the `./addons` directory.

```bash
pnpm build
```

## Customizing the compilation process

Add a compiler addon to generate new source files or restructure module dependencies before the actual compilation process. Use addons to process non-script files during the compilation, e.g., using Sass or PostCSS, or to generate documentation with YAML or Markdown and add them to the transpiled output.

### Using compiler addons

An addon is a directory containing an ECMAScript module named `addon.ts` or `addon.js`. The file must have an exported function named `activate` that takes an `AddonContext` as its only parameter. Addons can register generators, processors or transformers to the compilation process:

```javascript
// ./addons/foobar-transformer/addon.ts
import { AddonContext } from '@quatico/websmith-api';
import ts from "typescript";

export const activate = (ctx: AddonContext) => {
    
    // Use one of the register methods to add a generator, processor or transformer to the compilation process.
    ctx.registerGenerator((fileName: string, content: string): void => {
        // for example, register a source generator
    });
    
    ctx.registerProcessor((fileName: string, content: string): string | never => {
        // or, register a source processor
    });
}
```

The `activate` function is called when the compilation process is started.

### Placing addons in your project

Add for every addon a separate folder within the `./addons` directory. The folder name is used as addon name, if no explicit name is provided. The `addons` directory should be placed in the root of the project, i.e. next to your `tsconfig.json`. The `addons` directory is not part of your project's compilation process. You can specify a different location for your addons using the CLI argument `--addonsDir`.

### Define which addons to use

Use the CLI argument `--addons` to specify which addons to use. Provide a comma-separated list of addon names, i.e. the directory names of your addons.
By default no addon is applied, even if addons are present in the `./addons` directory.

### Provide a websmith configuration file

Websmith looks for a `websmith.config.json` file in the root of your project. If it exists, it is used to configure the compilation process. The configuration file can be used to specify which addons to use. Provide a lists of addon names or define compilation profile to apply different addons for different profiles.

Add an `addons` section to the `websmith.config.json` with the addon names to apply. All mentioned addons will be applied during the compilation:

```json
// ./websmith.config.json
{ 
    "addonsDir": "../my-addons",
    "addons": ["foobar-transformer"],
}
```

You can also define compilation profiles in the config file to use separate lists of addons for different compilation targets:

```json
// ./websmith.config.json
{
    "profiles": {
        "client": {
            "addons": ["generate-client-proxies", "create-component-documentation"],
        },
        "server": {
            "addons": ["generate-service-functions"],
        }
    }
}
```

Use `--profile` to run websmith with selected profile, e.g., `websmith --profile server`. If you use `--addons` in combination with `--profile`, the profile addons will be replaced by the addons provided with `--addons`. If you're having problems with addons not being correctly applied, please check the order of addon names. The order of addons in the config file is important! Addons are applied in the order they are defined.

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

## Implementing compiler addons

See [Write your own addon](docs/write-your-own-addon.md) for detailed instructions and examples on how to write your own addon.
