# websmith-webpack

Webpack loader extension to provide websmith configurations to integrate it with the build, bundle and chunking process.

Visit the [websmith github repository](https://github.com/quatico-solutions/websmith) for more information and examples.

## Getting started

### Installation

Install the websmith webpack package using npm:

```sh
npm i -D @quatico/websmith-webpack
```

### Add websmith configuration

With websmith-webpack installed, you need to prepare a websmith configuration for usage in webpack.

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

### Bundle your TypeScript project

```sh
webpack
```
