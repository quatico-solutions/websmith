# Custom compiler addons

websmith provides an Addon API to customize the compilation process. Addons can be used to define additional TS to TS transformations, to integrate with other compilers such as Sass or to generate extra documentation for your TS code. Addons can modify your source files before they are transpiled by the original TypeScript compiler, or simply generated additional files during the compilation process.

## Nature of an addon

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

## Where to place your addon code

Your addon can be placed in any directory in the `./addons` directory. The `addons` directory is located in the root of the project, i.e. next to your `tsconfig.json`. The `addons` directory is not part of the TypeScript compilation process. You specify a different location for your addons with the CLI argument `--addonsDir`.

## Configure which addons to use

Add the CLI argument `--addons` to specify which addons to use. Provide a comma-separated list of addon names, i.e. the directory names of your addons.

## Use the websmith configuration file

websmith looks for a `websmith.config.json` file in the root of your project. If it exists, it is used to configure the compilation process. The configuration file can be used to specify which addons to use, or which compilation targets are known to apply different addons.

Add an "addons" section to the `websmith.config.json` with a list of addon directory names to apply them during the compilation process.

```json
// websmith.config.json
{ 
    "addons": ["addon-foo", "addon-bar"],
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

## Apply different addons for different targets

Add the CLI argument `--target` with a "target-name" to select a specific list of addons to apply.
