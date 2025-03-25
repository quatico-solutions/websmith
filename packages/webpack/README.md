<!--
 ---------------------------------------------------------------------------------------------
   Copyright (c) Quatico Solutions AG. All rights reserved.
   Licensed under the MIT License. See LICENSE in the project root for license information.
 ---------------------------------------------------------------------------------------------
-->
# websmith-webpack

A custom webpack loader to add the websmith compiler to your build and bundling process.

Visit the [websmith github repository](https://github.com/quatico-solutions/websmith) for more information and examples.

## Getting started

### Installation

Install the websmith webpack loader using npm:

```sh
npm i -D websmith-loader
```

### Add websmith configuration

A `websmith.config.json` file is needed to configure which addons should be used by websmith during the webpack compilation process:

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

### Add webpack configuration

Now we can use the `websmith-loader` loader and the websmith configuration to configure webpack.

```javascript
// webpack.config.js
const { join } = require("path");

module.exports = {
    ...
    module: {
        rules: [
            ...,
            {
                test: /\.(?:[j|t]sx?)$/,
                include: [sourceDir],
                exclude: [/node_modules/],
                use: [
                    {
                        loader: "websmith-loader",
                        options: {
                            tsConfigFile: join(__dirname, "tsconfig.json"),
                            config: {
                                addonsDir: join(__dirname, "addons"),
                            },
                            profile: "executeAddons",
                        },
                    },
                ],
            },
            ...
        ],
    },
};
```

### Bundle your project

You can run webpack in one of your build profiles with:

```sh
webpack
```
