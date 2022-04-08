# websmith

This project is a compiler frontend for the [tsc](https://github.com/microsoft/TypeScript). It provides a more powerful API for applying Addons during compilation but uses the original TypeScript compiler to transpile the source files.

1. Install the packages
To install Websmith, execute the following command in your command line environment.

```bash
yarn add typescript @websmith/compiler @websmith/cli @websmith/addon-api --dev
```

2. Update your package.json

 ```json
 {
     ...
     "scripts" :{
         ...
         "build": "websmith",
         ...
     },
     ...
 }
 ```

3. Build your project

```bash
yarn build
```

## Custom compiler addons

Addons can be used to define additional source code transformations, to integrate with other compilers such as Sass or to generate extra documentation for your TS code. Addons can modify your source files before they are transpiled by the original TypeScript compiler, or simply generated additional files during the compilation process.

### Nature of an addon

An addon is an JavaScript module that is a directory containing a file named `addon.ts` or `addon.js`. This file must have an exported function named `activate` that takes a `CompilationContext` as its only parameter. The `activate` function is called when the compilation process is started.

```javascript
// ./addons/foobar-transformer/addon.ts
import { CompilationContext } from '@websmith/addon-api';
import ts from "typescript";

export const activate = (ctx: CompilationContext) => {
    // e.g. add a new transformer
    ctx.registerTransformer("before", () => (sf: ts.SourceFile): ts.SourceFile => {
        return ts.visitNode(sf, (node) => {
            if (ts.isIdentifier(node) && node.text === "foobar") {
                return ts.createIdentifier("barfoo");
            }
            return node;
        });
    });
}
```

### Where to place your addon code

Your addon can be placed in any directory in the `./addons` directory. The `addons` directory is located in the root of the project, i.e. next to your `tsconfig.json`. The `addons` directory is not part of the TypeScript compilation process. You specify a different location for your addons with the CLI argument `--addonsDir`.

### Configure which addons to use

Add the CLI argument `--addons` to specify which addons to use. Provide a comma-separated list of addon names, i.e. the directory names of your addons.

By default all addons found in the addon directory are applied.

### Use the websmith configuration file

websmith looks for a `websmith.config.json` file in the root of your project. If it exists, it is used to configure the compilation process. The configuration file can be used to specify which addons to use, or which compilation targets are known to apply different addons.

Add an "addons" section to the `websmith.config.json` with a default addon list to apply. Use the addon directory names in the list to apply them during the compilation process.

```json
// websmith.config.json
{ 
    "addonsDir": "../my-addons",
    "addons": ["foobar-transformer"],
}
```

You can also specify different lists of addons for dedicated targets

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

If you select a specific target `websmith --targets one,two`, the generic addons list will be replaced.

### Apply different addons for different targets

Add the CLI argument `--targets` with a comma seperated list of target names to select a specific list of addons per target.

### Writing your own addon

[write-your-own-addon](write-your-own-addon.md) contains detailed instructions and examples on how to write your own addons.

## Custom compilation targets

websmith supports custom compilation targets. A compilation target is name that configures which addons and additional configuration to apply to a specific compilation target. Add a `websmith.config.json` file next to your `tsconfig.json` and add a `targets` section to it. Name each target and specify the addons and configuration to apply for that target.

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

Run websmith with the CLI argument `--target` to select a specific target.
