<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->
# @quatico/websmith-api

The websmith API package provides interfaces and functionality to implement compiler **addons** to customize the compilation output.

Compiler addons can be used to modify the compilation artifacts before, during and after the compiled output is created. Even non-script files can be created and processed in the compilation process. Use the `websmith` command with an addon:

* To generate additional configuration or documentation based on the original source code,
* To create additional new source files and add them to the compilation process, or
* To change module dependencies with new or modified imports/exports.

Compiler addons can also access all transpiled files as whole and reason about the entire compilation target. The standard API for TypeScript transformers is fully integrated, thus existing `ts.CustomTransformers` can be simply called from within an addon.

For a general introduction to websmith see the [websmith github repository](https://github.com/quatico-solutions/websmith#readme).

## Getting started

The websmith API package is a peer dependency of the [websmith compiler](https://github.com/quatico-solutions/websmith/tree/develop/packages/compiler#readme) and provides the interfaces and functionality to implement compiler addons.

### Installation

Install the API package using pnpm:

```sh
pnpm add --dev @quatico/websmith-api
```

## Implementing compiler addons

Create an directory e.g. `my-code-generator` in the `addons` folder in your project folder and add an ECMAScript module named `addon.ts`:

```typescript
// ./addons/component-doc-generator/addon.ts
import type { AddonContext, AddonActivator } from "@quatico/websmith-api";
import { readFileSync, writeFileSync } from "fs";

export type ComponentDocConfig = {
    apiCollectionPath: string;
};

export const activate: AddonActivator = (ctx: AddonContext<ComponentDocConfig>) => {
    // Use one of the register methods to add a generator to the compilation process.
    ctx.registerGenerator((fileName: string, content: string): void => {
        const { apiCollectionPath } = ctx.getProfileConfig();
        // Collect all TypeScript files containing foo in their filename
        if (/\/.*Component.*\\.ts$/.test(fileName)) {
            writeFileSync(apiCollectionPath, readFileSync(apiCollectionPath).toString() + `\n- ${fileName}`);
        }
    });
};
```

The `addon.ts` file must export an `activate` function implementing the `AddonActivator` interface. The `AddonActivator` type is a function that takes an `AddonContext` object as argument. You can use the `AddonContext` object to register a "generator", "processor", transformer" or "resultProcessor to the compilation process.

For more information on how to implement addons, see the [write your own addon](docs/write-your-own-addon.md) documentation.

## CompilerAddon Interface

Starting with websmith v0.8.6, addons can implement the `CompilerAddon` interface to declare performance optimization features:

```typescript
import type { AddonContext, CompilerAddon } from "@quatico/websmith-api";

export const activate = (ctx: AddonContext) => {
    // Register your addon logic
};

// Optional: Filter which files this addon processes
export const shouldProcessFile = (filePath: string, ctx: AddonContext): boolean => {
    return filePath.includes("/target-directory/");
};

// Optional: Declare if addon needs TypeScript type information
export const needsTypeInfo = false; // Enables 10-20x faster compilation
```

### Performance Features

- **`shouldProcessFile`**: Skip files your addon doesn't need to process, reducing overhead by 10x+
- **`needsTypeInfo`**: Opt into fast transpileModule path when type information isn't required (10-20x faster)

See the [performance optimization section](docs/write-your-own-addon.md#7-performance-optimization) for detailed documentation and examples.

## Activate a compiler addon

You can activate your addon by using the `--addons` command line parameter when calling the websmith compiler. Add the `--addons` parameter to the build command in the `package.json` file:

```json
// ./package.json
{
    "scripts": {
        "build": "websmith --addons component-doc-generator"
    }
}
```

See the [compiler README](https://github.com/quatico-solutions/websmith/tree/develop/packages/compiler#readme) for more options on how to use addons.
