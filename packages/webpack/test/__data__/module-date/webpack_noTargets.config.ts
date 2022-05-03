import path, { resolve } from "path";
import { WebsmithPlugin } from "../../../src";

const sourceDir = resolve(__dirname, "src");

module.exports = {
    target: "web",
    devtool: "source-map",
    mode: "development",
    entry: {
        main: path.resolve(sourceDir, "index.tsx"),
        functions: path.resolve(sourceDir, "functions","getDate.ts"),
    },
    output: {
        path: path.resolve(__dirname, ".build/lib"),
        publicPath: "/",
    },
    resolve: {
        extensions: [".js", ".ts", ".tsx"],
    },
    plugins: [
        new WebsmithPlugin({
            project: path.resolve(__dirname, "tsconfig.json"),
            config: path.resolve(__dirname, "websmith_notargets.config.json"),
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
