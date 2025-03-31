<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->
# websmith-loader

A drop-in replacement for the [ts-loader](https://github.com/TypeStrong/ts-loader#readme) to add the websmith compiler to your build and bundling process. Websmith provides an [API to create compiler addons](https://github.com/quatico-solutions/websmith/tree/develop/packages/api#readme) to modify the compilation input before, during and after compiled artifacts are created, [compilation profiles](https://github.com/quatico-solutions/websmith/tree/develop/packages/compiler/README.md#compilation-profiles) to specify individual environments for different outputs, and integrates seamlessly with `webpack` build commands.

Visit the [websmith github repository](https://github.com/quatico-solutions/websmith#readme) for more information and examples.

## Getting started

Whenever you use the `ts-loader` to compile your TypeScript project, you can replace it with the `websmith-loader` command and apply compiler addons.

### Installation

Add the loader to your TypeScript project with the `websmith-loader` package. For example, use the following command with `pnpm`:

```sh
pnpm add --dev websmith-loader
```

### Use websmith-loader in your webpack configuration

You can use the `websmith-loader` loader in your webpack configuration by adding the following entry to your `module.rules` configuration:

```javascript
// ./webpack.config.js
const { join } = require("path");

module.exports = {
    // ...
    module: {
        rules: [
            {
                test: /\.(?:[j|t]sx?)$/,
                use: [
                    {
                        loader: "websmith-loader",
                        options: {
                            tsConfigFile: join(__dirname, "tsconfig.json"),
                            config: {
                                addonsDir: join(__dirname, "addons"),
                                addons: ["export-yaml-generator"],
                            },
                            transpileOnly: true,
                        },
                    },
                ],
            },
            // ...
        ],
    },
};
```

The default configuration uses the `tsconfig.json` file in your project root to compile the TypeScript files. Add a custom compilation config to the loader options or use the `websmith.config.json` file to configure the compilation output.

### Add websmith configuration

You can use a `websmith.config.json` file to configure which addons should be used for what profile by websmith during the webpack compilation process:

```json
// websmith.config.json
{
    "profiles": {
        "executeAddons": {
            "addons": ["my-addon"],
        },
    }
}
```

**Note:** The webpack loader will expect a profile called `executeAddons` which we need to configure in the webpack configuration.

Read more about compilation profiles in the [websmith compiler documentation](https://github.com/quatico-solutions/websmith/tree/develop/packages/compiler/README.md#compilation-profiles). Or check out more details on the configuration file in the [compiler documentation](https://github.com/quatico-solutions/websmith/tree/develop/packages/compiler/README.md#websmith-configuration-file).
