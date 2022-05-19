<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->
# websmith

This project is a compiler frontend for the [TypeScript compiler](https://github.com/microsoft/TypeScript). It provides additional API for customizing the compilation process of the original compiler. You can provide your own compiler addons to modify the compilation input before the actual compilation process. Addons can

* consume the unmodified source files to generate additional information based on the original source code,
* create additional new input files and add them to the compilation process, or
* modify input files to change module dependencies and modify imports/exports.

An addon can also access all processed source files as whole and reason about the entire compilation target. Standard API for TypeScript transformers is fully integrated, thus existing `ts.CustomTransformers` can be simply called from within every addon.

## Getting started

### Installation

Install the following packages to add websmith to your TypeScript project. For example, execute the following command in your command line environment using `yarn`:

```bash
yarn add typescript @quatico/websmith-cli @quatico/websmith-api --dev
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
yarn build
```

## Custom compiler addons

websmith's compiler addons are a powerful mechanism to generate new source files or restructure module dependencies before the compilation, or transform source code during the actual compilation process. You can use it to process non TypeScript files with e.g. with Sass or PostCSS, generate documentation files for e.g. Storybook, or post process your transpiled output. Addons can modify source files before, during or after they are transpiled by the original TypeScript compiler, or consume them as input to generated additional files non-compilation related files.

### Nature of an addon

An addon is a directory containing an ES module named `addon.ts` or `addon.js`. This file must have an exported function named `activate` that takes an `AddonContext` as its only parameter. The `activate` function is called when the compilation process is started.

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

### Where to place your addon code?

Place your addon in a separate folder in the `./addons` directory. The folder name is used as addon name, if no explicit name is provided. The `addons` directory should be located in the root of the project, i.e. next to your `tsconfig.json`. The `addons` directory is not part of the TypeScript compilation process. You can specify a different location for your addons using the CLI argument `--addonsDir`.

### Configure which addons to use

Add the CLI argument `--addons` to specify which addons to use. Provide a comma-separated list of addon names, i.e. the directory names of your addons.

By default all addons found in the addon directory are applied.

### Use the websmith configuration file

websmith looks for a `websmith.config.json` file in the root of your project. If it exists, it is used to configure the compilation process. The configuration file can be used to specify which addons to use. Provide a lists of addon names or define compilation targets with addons names to apply different addons for different targets.

Add an "addons" section to the `websmith.config.json` with the addon names to apply. This default list of addons will be applied for every compilation. The addon name is the addon directory name if not specified otherwise:

```json
// websmith.config.json
{ 
    "addonsDir": "../my-addons",
    "addons": ["foobar-transformer"],
}
```

You can also define compilation targets in the config file and specify a different list of addons for every target:

```json
// websmith.config.json
{
    "targets": {
        "one": {
            "addons": ["addon-foo", "addon-bar"],
            "writeFile": false,
        },
        "two": {
            "addons": ["addon-zip"],
        }
    }
}
```

Run the websmith compiler with selected targets `websmith --targets one, two` to apply specific addons during compilation. If a target specific addon list is provided, the default addons list will be replaced, i.e., the no addon of the defaults list will be applied.

## Custom compilation targets

websmith supports custom configurations for different compilation targets. A compilation target is a set of options that specify the environment for a compilation output. You can define a custom compilation target by adding a `targets` section to the `websmith.config.json` file. The `targets` section contains a unique target `name` and a set of options. The `name` is used to specify the target when calling the websmith compiler. The options are used to configure the compilation process. The options contain the following sections:

* `addons`: a list of addon names to apply for this target
* `writeFile`: a boolean value that specifies whether the output file should be written to disk
* `config`: target specific configuration properties defined by your addon
* `options`: a set of compiler options for the TypeScript compiler to use for this target

An example for a custom compilation target could be:

```json
// websmith.config.json
{
    "targets": {
        "one": {
            "addons": ["addon-zip", "addon-zap"],
            "config": {
                "foo": "bar",
                "baz": "qux"
            },
            "options": {
                "outDir": "../dist/one",
                "module": "commonjs",
                "target": "es5",
            }
        },
        "two": {
            "addons": ["addon-zip"],
            "writeFile": false,
        }
    }
}
```

### Apply different addons for different targets

Run websmith with the CLI argument `--targets` to select a specific target. You can specify a single target or multiple targets by separating them with a comma. If multiple targets are specified, the compiler will build the targets in the specified order.

## Writing your own addon

See [Write your own addon](docs/write-your-own-addon.md) for detailed instructions and examples on how to write your own addon.
