/* eslint-disable no-console */
/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { existsSync } from "fs";
import webpack, { type Compiler, type Configuration, type Stats } from "webpack";
import { uPath } from "@quatico/websmith-webpack";

export const webpackBuild = (
    options: Configuration,
    projectDir: string,
    callback?: (err?: Error | null, stats?: webpack.Stats) => void
): Promise<{ stats?: Stats; errors?: string[]; compiler: Compiler }> => {
    // We don't want displayDone to pollute the test run output.
    console.info = () => undefined;
    options = {
        ...{
            entry: {
                main: existsSync(uPath.resolve(projectDir, "src", "index.ts"))
                    ? uPath.resolve(projectDir, "src", "index.ts")
                    : uPath.resolve(projectDir, "src", "index.tsx"),
                functions: uPath.resolve(projectDir, "src", "functions", "getDate.ts"),
            },
            output: {
                path: uPath.resolve(projectDir, ".build", "lib"),
            },
            mode: "development",
            resolve: {
                extensions: [".js", ".ts", ".tsx"],
            },
            module: {
                rules: [
                    {
                        test: /\.tsx?$/,
                        include: [uPath.resolve(projectDir, "src")],
                        loader: "@quatico/websmith-webpack",
                        options: {
                            addonsDir: uPath.resolve(__dirname, "addons", "lib"),
                            config: uPath.resolve(projectDir, "websmith.config.json"),
                            project: uPath.resolve(projectDir, "tsconfig.json"),
                            webpackTarget: "*",
                        },
                    },
                ],
            },
        },
        ...options,
    };

    const compiler = callback ? webpack(options, callback) : webpack(options);

    return callback
        ? Promise.resolve({ compiler })
        : new Promise<{ stats?: Stats; errors?: string[]; compiler: Compiler }>((resolve, reject) =>
              compiler.run((err, stats) => {
                  if (err || (stats && stats.hasErrors())) {
                      const resolvedErrors = err ? [err.message] : stats?.toJson("errors-only").errors?.map(cur => cur.message) ?? [];
                      reject(new Error(resolvedErrors.join("\n")));
                  }
                  resolve({ stats: stats as unknown as Stats, compiler });
              })
          );
};
