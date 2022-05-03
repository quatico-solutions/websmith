import { existsSync } from "fs";
import { resolve } from "path";
import webpack, { Stats, Compiler, Configuration } from "webpack";
import { WebsmithPlugin } from "../src";

export const createWebpackCompiler = (options: Configuration, projectDir: string): Promise<{ stats: Stats; compiler: Compiler }> => {
    options = options ?? {
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
    };

    const compiler = webpack(options);

    return new Promise<{ stats: Stats; compiler: Compiler }>((resolve, reject) =>
        compiler.run((err, stats) => {
            if (err || (stats && stats.hasErrors())) {
                const resolvedError = err || (stats && stats.toJson("errors-only").errors);
                // eslint-disable-next-line no-console
                console.error(`Webpack Compiler Error:\n${JSON.stringify(resolvedError, null, 2)}`);
                reject({ stats: resolvedError, compiler });
            }
            resolve({ stats: stats as unknown as Stats, compiler });
        })
    );
};
