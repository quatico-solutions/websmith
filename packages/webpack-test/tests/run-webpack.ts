/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export type BuildReport = { errors: string[]; outputs: Record<string, string> };
export type RunOptions = {
    /** A JavaScript expression of the webpack configuration, an array for a MultiCompiler; `projectDir` and `loader` are in scope. */
    config: string;
    /** Output files to report, relative to the project. */
    outputs: string[];
    /** Files to write after each watch build, relative to the project; runs webpack once when absent. */
    steps?: Record<string, string>[];
    /** Files to write before each further run() of the same compiler, without watch, relative to the project. */
    reruns?: Record<string, string>[];
};

/**
 * Runs webpack in a separate Node process, like in webpack-esm-check.test.ts, and returns the report of each build: the
 * errors and the content of the requested output files.
 */
export const runWebpack = (projectDir: string, { config, outputs, steps, reruns }: RunOptions): BuildReport[] => {
    const script = `
        const fs = require("node:fs");
        const path = require("node:path");
        const webpack = require(${JSON.stringify(require.resolve("webpack"))});
        const projectDir = ${JSON.stringify(projectDir)};
        const loader = ${JSON.stringify(require.resolve("websmith-loader"))};
        const loaderOptions = profile => ({
            transpileOnly: true,
            tsConfigFile: path.join(projectDir, "tsconfig.json"),
            configFile: path.join(projectDir, "websmith.config.json"),
            profile,
        });
        const steps = ${JSON.stringify(steps ?? null)};
        const reruns = ${JSON.stringify(reruns ?? [])};
        const outputs = ${JSON.stringify(outputs)};
        const compiler = webpack(${config});
        const report = stats => {
            const errors = (stats.stats ?? [stats]).flatMap(cur => cur.compilation.errors.map(error => error.message));
            const read = fileName => {
                const filePath = path.join(projectDir, fileName);
                return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : "";
            };
            console.log("RESULT " + JSON.stringify({ errors, outputs: Object.fromEntries(outputs.map(cur => [cur, read(cur)])) }));
        };
        if (!steps) {
            let run = 0;
            const onRun = (err, stats) => {
                if (err) {
                    console.error(err);
                    process.exitCode = 2;
                    return compiler.close(() => undefined);
                }
                report(stats);
                const files = reruns[run++];
                if (!files) {
                    return compiler.close(() => undefined);
                }
                // A later modification time than the previous run's
                setTimeout(() => {
                    Object.entries(files).forEach(([fileName, content]) => fs.writeFileSync(path.join(projectDir, fileName), content));
                    compiler.run(onRun);
                }, 1000);
            };
            compiler.run(onRun);
        } else {
            let step = 0;
            let watchdog;
            let awaited = null;
            const watching = compiler.watch({ aggregateTimeout: 100 }, (err, stats) => {
                if (err) {
                    console.error(err);
                    process.exitCode = 2;
                    return watching.close(() => undefined);
                }
                // Only a rebuild that saw the edited files is the awaited one
                const modified = compiler.modifiedFiles || new Set();
                if (awaited && !awaited.every(cur => modified.has(cur))) {
                    return;
                }
                report(stats);
                clearTimeout(watchdog);
                const files = steps[step++];
                if (!files) {
                    return watching.close(() => undefined);
                }
                awaited = Object.keys(files).map(fileName => path.join(projectDir, fileName));
                watchdog = setTimeout(() => {
                    console.error("no rebuild containing " + awaited.join(", ") + " within 25000ms");
                    process.exitCode = 2;
                    watching.close(() => undefined);
                }, 25000);
                // Let the watcher settle, so the write is seen as a change after this build
                setTimeout(() => Object.entries(files).forEach(([fileName, content]) => fs.writeFileSync(path.join(projectDir, fileName), content)), 1000);
            });
        }
    `;
    const scriptPath = path.join(projectDir, "run-webpack.cjs");
    fs.writeFileSync(scriptPath, script, { encoding: "utf-8" });

    const builds = (steps ?? reruns ?? []).length + 1;
    const result = spawnSync(process.execPath, [scriptPath], { cwd: projectDir, encoding: "utf-8", timeout: builds * 26000 + 15000 });
    const reports = result.stdout
        .split("\n")
        .filter(cur => cur.startsWith("RESULT "))
        .map(cur => JSON.parse(cur.slice("RESULT ".length)) as BuildReport);
    if (reports.length !== builds) {
        throw new Error(`webpack reported ${reports.length} builds, expected ${builds}: ${result.stdout}${result.stderr}`);
    }
    return reports;
};
