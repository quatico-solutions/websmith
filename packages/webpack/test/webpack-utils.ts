import { existsSync } from "fs";
import { resolve } from "path";
import webpack, { Compiler, Configuration, Stats, StatsError } from "webpack";
import { WebsmithPlugin } from "../src";

export const createWebpackCompiler = (
    options: Configuration,
    projectDir: string
): Promise<{ stats?: Stats; errors?: Error | StatsError[]; compiler: Compiler }> => {
    options = {
        ...{
            entry: {
                main: existsSync(resolve(projectDir, "src", "index.ts"))
                    ? resolve(projectDir, "src", "index.ts")
                    : resolve(projectDir, "src", "index.tsx"),
                functions: resolve(projectDir, "src", "functions", "getDate.ts"),
            },
            output: {
                path: resolve(projectDir, ".build", "lib"),
            },
            plugins: [
                new WebsmithPlugin({
                    addonsDir: resolve(__dirname, "..", "addons", "lib"),
                    config: resolve(projectDir, "websmith.config.json"),
                    project: resolve(projectDir, "tsconfig.json"),
                    webpackTarget: "*",
                }),
            ],
            mode: "development",
            resolve: {
                extensions: [".js", ".ts", ".tsx"],
            },
            module: {
                rules: [
                    {
                        test: /\.tsx?$/,
                        include: [resolve(projectDir, "src")],
                        exclude: [/\.spec\.tsx?$/, /node_modules/],
                        loader: `${WebsmithPlugin.loader}.ts`,
                    },
                ],
            },
        },
        ...options,
    };

    const compiler = webpack(options);

    return new Promise<{ stats?: Stats; errors?: Error | webpack.StatsError[]; compiler: Compiler }>((resolve, reject) =>
        compiler.run((err, stats) => {
            if (err || (stats && stats.hasErrors())) {
                const resolvedErrors = err ? [err] : stats && stats.toJson("errors-only").errors;
                reject({ errors: resolvedErrors, compiler });
            }
            resolve({ stats: stats as unknown as Stats, compiler });
        })
    );
};
