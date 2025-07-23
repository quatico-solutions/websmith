/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable unicorn/prefer-node-protocol */
const path = require("path");
const webpack = require("webpack");

module.exports = {
    mode: "production",
    target: "node",
    entry: {
        bin: path.resolve(__dirname, "src", "bin.ts"),
    },
    output: {
        filename: "[name].js",
        path: path.resolve(__dirname, "bin"),
        clean: true,
    },
    resolve: {
        extensions: [".ts", ".js"],
        alias: {
            "@quatico/websmith-api": path.resolve(__dirname, "../api/lib"),
            "@quatico/websmith-core": path.resolve(__dirname, "../core/src"),
        },
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: {
                    loader: "ts-loader",
                    options: {
                        configFile: path.resolve(__dirname, "tsconfig.json"),
                        transpileOnly: true,
                    },
                },
                exclude: /node_modules/,
            },
        ],
    },
    externals: {
        // Keep these as external Node.js built-ins
        typescript: "commonjs typescript",
    },
    node: {
        // Keep Node.js globals for dynamic addon loading
        __dirname: false,
        __filename: false,
        global: false,
    },
    plugins: [
        new webpack.BannerPlugin({
            banner: "#!/usr/bin/env node",
            raw: true,
        }),
        new webpack.DefinePlugin({
            "process.env.NODE_ENV": JSON.stringify("production"),
        }),
        // Make the output file executable
        {
            apply: compiler => {
                compiler.hooks.afterEmit.tap("MakeExecutable", () => {
                    const fs = require("fs");
                    const outputPath = path.resolve(__dirname, "bin", "bin.js");
                    if (fs.existsSync(outputPath)) {
                        fs.chmodSync(outputPath, "755");
                    }
                });
            },
        },
    ],
    optimization: {
        minimize: false, // Keep readable for debugging
    },
    stats: {
        warnings: false,
    },
};
