import { resolve } from "path";
import { WebsmithPlugin } from "../../../src";

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
        new WebsmithPlugin({
            project: resolve(__dirname, "tsconfig.json"),
            config: resolve(__dirname, "websmith.config.json"),
            targets: "noWrite",
            webpackTarget: "noWrite",
        }),
    ],
    module: {
        rules: [
            {
                test: /\.[j|t]sx?$/,
                include: [sourceDir],
                exclude: [/\.spec\.tsx?$/, /node_modules/],
                loader: WebsmithPlugin.loader + ".ts",
            },
        ],
    },
};
