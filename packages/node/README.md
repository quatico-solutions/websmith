<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->
# @quatico/websmith-node

This package contains a compiler runner for Node.js. It provides a small API for running the websmith compiler and webpack with the websmith-loader  from within a Node.js application.

## Getting started

Install the package with your favorite package manager. For example with pnpm:

```bash
pnpm add @quatico/websmith-node
```

## Usage

The library exports a two main functions. The first one is `compile` compiles one or more files with the websmith compiler. The second one is `webpack` to bundle one or more files with webpack.

### Compile files with the websmith compiler

You can compile a single file or a whole directory with the websmith compiler:

```ts
import { compile } from "@quatico/websmith-node";

const logs = await compile(["./src/index.ts"]);

console.log(logs);
```

The `compile` function returns a string with the logs of the compilation. It also accepts a second argument with the following options:

- `tsConfig`: A typescript compiler options object. See [tsconfig.json](https://www.typescriptlang.org/tsconfig) for more information.
- `websmith`: A websmith options object. See [websmith.config.ts](https://github.com/quatico-solutions/websmith/blob/develop/packages/core/src/compiler/options/CompilerOptions.ts) for more information.

Run your profile or addons with the websmith compiler:

```ts
import { compile } from "@quatico/websmith-node";

const logs = await compile(["./src/index.ts"], {
    tsConfig: { 
        target: ts.ScriptTarget.ESNext,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Node10,
        outDir: "./lib",
        noEmit: false,
    },
    websmith: {
        config: {
            addonsDir: "./example-addons",
            addons: ["export-yaml-generator"],
            profiles: {
                "my-profile": {
                    addons: ["foobar-replace-transformer"],
                },
            },
            profile: "my-profile",
        },
    },
});
```

### Bundle files with webpack

The `webpack` function bundles one or more files with webpack. It accepts a single argument with the files to bundle, and an optional second argument with the webpack configuration.

```ts
import { webpack } from "@quatico/websmith-node";

const logs = await webpack(["./src/index.ts"]);

console.log(logs);
```

The `webpack` function returns a string with the logs of the webpack build. It also accepts a second argument with the following options:

- `webpack`: A webpack configuration object. See [webpack.config.ts](https://webpack.js.org/configuration/) for more information.
- `websmith`: A websmith-loader options object. See [WebpackLoaderOptions.ts](https://github.com/quatico-solutions/websmith/blob/develop/packages/core/src/compiler/options/WebpackLoaderOptions.ts) for more information.

Run your profile or addons with the webpack build:

```ts
import { webpack } from "@quatico/websmith-node";

const logs = await webpack(["./src/index.ts"], {
    webpack: {
        output: {
            path: "./lib",
        },
        module: {
            rules: [
                {
                    test: /\.[jt]s?$/,
                    use: [
                        {
                            loader: require.resolve("websmith-loader"),
                            options: {
                                transpileOnly: true,
                                tsConfigFile: path.join(__dirname, "..", "tsconfig.json"),
                            },
                        },
                    ],
                },
            ],
        },
    },
    websmith: {
        config: {
            profile: "my-profile",
        },
    },
});
```

See the [websmith github repository](https://github.com/quatico-solutions/websmith) for more information and examples.
