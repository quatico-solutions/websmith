/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import path from "node:path";
import { type Configuration } from "webpack";

export const webpackDefaults: Configuration = {
    devtool: false,
    mode: "development",
    resolve: { extensions: [".ts", ".js"] },
    entry: path.resolve(__dirname, "src/index.ts"),
    output: {
        filename: "[name].js",
        path: path.resolve(__dirname, "lib"),
    },
    target: "node",
    module: {
        rules: [
            {
                test: /\.[jt]s?$/,
                loader: require.resolve("ts-loader"),
                options: {
                    transpileOnly: true,
                    configFile: path.join(process.cwd(), "tsconfig.json"),
                },
            },
        ],
    },
};
