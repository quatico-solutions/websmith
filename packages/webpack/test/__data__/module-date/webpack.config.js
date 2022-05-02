const { resolve } = require("path");
const { MagellanPlugin } = require("../../../lib");

const sourceDir = resolve(__dirname, "src");

module.exports = {
    target: "web",
    devtool: "source-map",
    mode: "development",
    entry: {
        main: resolve(sourceDir, "index.tsx"),
        functions: resolve(sourceDir, "functions", "getDate.ts"),
    },
    output: {
        path: resolve(__dirname, ".build/lib"),
        publicPath: "/",
    },
    resolve: {
        extensions: [".js", ".ts", ".tsx"],
    },
    plugins: [
        new MagellanPlugin({
            project: resolve(__dirname, "tsconfig.json"),
            config: resolve(__dirname, "websmith.config.json"),
            targets: "client,server",
        }),
    ],
    module: {
        rules: [
            {
                test: /\.[j|t]sx?$/,
                include: [sourceDir],
                exclude: [/\.spec\.tsx?$/, /node_modules/],
                loader: MagellanPlugin.loader,
            },
        ],
    },
};
