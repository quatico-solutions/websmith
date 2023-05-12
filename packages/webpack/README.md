# websmith-webpack

A custom webpack loader to add the websmith compiler to your build and bundling process.

Visit the [websmith github repository](https://github.com/quatico-solutions/websmith) for more information and examples.

## Getting started

### Installation

Install the websmith webpack loader using npm:

```sh
npm i -D @quatico/websmith-webpack
```

### Add websmith configuration

A `websmith.config.json` file is needed to configure which addons should be used by websmith during the webpack compilation process:

```json
// websmith.config.json
{
    "targets": {
        "executeAddons": {
            "addons": ["my-addon"],
            "writeFile": false,
        },
    }
}
```

**Note:** The webpack loader will expect a target called `executeAddons` which we need to configure in the webpack configuration.

### Add webpack configuration

Now we can use the `@quatico/websmith-webpack` loader and the websmith configuration to configure webpack.

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
                exclude: [/\.spec\.tsx?$/, /node_modules/],
                use: [
                    {
                        loader: "@quatico/websmith-webpack",
                        options: {
                            project: join(__dirname, "tsconfig.json"),
                            config,
                            targets: "executeAddons",
                            webpackTarget: "executeAddons",
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

You can run webpack in one of your build targets with:

```sh
webpack
```
