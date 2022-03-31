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

By default all addons found in the addon directory are applied.

## Use the websmith configuration file

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

## Apply different addons for different targets

Add the CLI argument `--targets` with a comma seperated list of target names to select a specific list of addons per target.

## Writing your own addon

Inside your addons directory, create a directory that contains a file `addon.ts`. This file is called the addon activator and it requires a function `activate(ctx: CompilationContext)`. The activator is called before the compilation process to register the addon in the appropriate step during the compilation process.

You can register two kinds of addons: `Generator` and `Transformer`.

- `Generators` can be used to create additional files (eg documentation) based on your source code files.
- `Transformer` can be used to alter a source input file during the compilation.

... your addon can use external dependencies ...

- import dependencies and add them as devDependencies to your package.json.
  - those are not included in the compilation of your target code

... The structure of your addon folder is up to you, websmith interacts only with the addon activator ...
... The addon directory is not subject to the addon compilation process ...

### Choose your addon kind

#### Generator

- `Generators` are executed before the compilation and enable you to act upon the unaltered input source code.

```javascript

```

#### Transformer
- `Transformer` are executed as part of the compilation process and allow you to transform the 
- transformator (pre emit vs emit >> ts.CustomTransformers)

```javascript

```

### Error reporting

### How to interact with the compiler: CompilationContext and Reporter explained

```javascript
interface CompilationContext {
    getSystem(): ts.System;
    getConfig(): ts.ParsedCommandLine;
    getReporter(): Reporter;

    registerGenerator(...);
    registerPreEmitTransformer(...);
    registerEmitTransformer(...);
    // Add link to typescript transformer and transformer handbook
}

interface Report {
    reportDiagnostics(...);
}

ErrorMessage, WarnMessage, InfoMessage
// Zusammenarbeit mit --debug >> console.log / info / debug
```
