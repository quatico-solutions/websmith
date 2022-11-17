# websmith-webpack

Empower your webpack bundling processes with powerful addon and transformer capabilities working with your TypeScript source code.

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
            "addons": ["addon-myOwn"],
        },
    }
}
```

### Add webpack configuration

Now we can use the `@quatico/websmith-webpack` loader and the websmith configuration to configure webpack.

```javascript
// webpack.config.js
const { join } = require("path");

const createConfig= ({
    sourceDir = join(__dirname, "src"),
    config = join(__dirname, "websmith.config.json"),
    preLoaders = [],
    postLoaders = [],
    targets = "executeAddons",
    webpackTarget = "executeAddons",
}) => {
    const websmithLoaderOptions = {
        project: join(__dirname, "tsconfig.json"),
        config,
        targets,
        ...(!!webpackTarget && { webpackTarget }),
    };

    return {
        target: "web",
        devtool: "source-map",
        mode: "development",
        entry: {
            main: join(sourceDir, "index.ts"),
        },
        output: {
            path: join(__dirname, "lib"),
            publicPath: "/",
        },
        resolve: {
            extensions: [".js", ".ts", ".tsx"],
        },
        module: {
            rules: [
                {
                    test: /\.(?:[j|t]sx?|scss)$/,
                    include: [sourceDir],
                    exclude: [/\.spec\.tsx?$/, /node_modules/],
                    use: [
                        ...preLoaders,
                        {
                            loader: "@quatico/websmith-webpack",
                            options: websmithLoaderOptions,
                        },
                        ...postLoaders,
                    ],
                },
            ],
        },
    };
}

module.exports = createConfig({
    targets: "executeAddons",
    webpackTarget: "executeAddons",
});
```

### Bundle your TypeScript project

```sh
webpack
```