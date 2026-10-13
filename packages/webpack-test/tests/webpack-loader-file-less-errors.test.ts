/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { writeSourceFile } from "./test-files";

// Webpack runs in a separate Node process, like in webpack-loader-option-errors-once.test.ts
const getProjectDir = () => {
    const testId = expect.getState().currentTestName?.replace(/[^a-zA-Z0-9]/g, "_") || "unknown";
    return path.resolve(__dirname, "..", `test-output-file-less-errors-${testId}_${Date.now()}`);
};

let projectDir: string;
// TS2688 and TS6059 prefixes; the loader reports TypeScript's message without its code
const MISSING_TYPES_ERROR = "Cannot find type definition file for 'does-not-exist'";
const ROOT_DIR_ERROR = "is not under 'rootDir'";

const writeTsConfig = (compilerOptions: object) =>
    writeSourceFile(
        "tsconfig.json",
        JSON.stringify({ compilerOptions: { target: "es2020", module: "commonjs", outDir: "tsout", ...compilerOptions } }),
        projectDir
    );

beforeEach(() => {
    projectDir = getProjectDir();
    writeSourceFile("websmith.config.json", JSON.stringify({ profiles: { one: {} } }), projectDir);
});

afterEach(() => {
    fs.rmSync(projectDir, { recursive: true, force: true });
});

describe("webpack w/ websmith-loader and a missing type definition file", () => {
    it("should fail w/ the error once w/ declaration and three modules", () => {
        writeTsConfig({ rootDir: "src", declaration: true, types: ["does-not-exist"] });
        writeSourceFile("src/index.ts", `import { a } from "./a";\nimport { b } from "./b";\nexport const main = [a, b];\n`, projectDir);
        writeSourceFile("src/a.ts", `export const a = 1;\n`, projectDir);
        writeSourceFile("src/b.ts", `export const b = 2;\n`, projectDir);

        const actual = runWebpack();

        expect(actual.exitCode).toBe(1);
        expect(countOf(actual.output, MISSING_TYPES_ERROR)).toBe(1);
    }, 60000);
});

describe("webpack watch w/ websmith-loader and a source file outside rootDir", () => {
    it.each([{ declaration: false }, { declaration: true }])(
        "should report the error once in the first build and not after the import is removed w/ declaration $declaration",
        ({ declaration }) => {
            writeTsConfig({ rootDir: "src/lib", declaration, types: [] });
            writeSourceFile("src/lib/index.ts", `import { b } from "../b";\nexport const main = [b];\n`, projectDir);
            writeSourceFile("src/b.ts", `export const b = 2;\n`, projectDir);

            const actual = runWebpack({ entry: "./src/lib/index.ts", edit: `export const main = [];\n` });
            const builds = actual.output.split(BUILD_MARKER).slice(1);

            expect(builds).toHaveLength(2);
            expect(countOf(builds[0], ROOT_DIR_ERROR)).toBe(1);
            expect(countOf(builds[1], ROOT_DIR_ERROR)).toBe(0);
        },
        60000
    );
});

const BUILD_MARKER = "=== build ";

/**
 * Runs webpack with one loader rule over `./src/index.ts`. With `watch`, runs `compiler.watch` over `watch.entry`,
 * writes `watch.edit` to the entry after the first build and closes the watcher after the second; the output of
 * each build follows a `BUILD_MARKER` line.
 */
const runWebpack = (watch?: { entry: string; edit: string }): { exitCode: number | null; output: string } => {
    const script = `
        const fs = require("node:fs");
        const path = require("node:path");
        const webpack = require(${JSON.stringify(require.resolve("webpack"))});
        const projectDir = ${JSON.stringify(projectDir)};
        const loader = ${JSON.stringify(require.resolve("websmith-loader"))};
        const loaderOptions = {
            tsConfigFile: path.join(projectDir, "tsconfig.json"),
            configFile: path.join(projectDir, "websmith.config.json"),
            profile: "one",
        };
        const config = {
            mode: "development",
            devtool: false,
            target: "node",
            context: projectDir,
            entry: { main: ${JSON.stringify(watch?.entry ?? "./src/index.ts")} },
            output: { path: path.join(projectDir, "dist") },
            resolve: { extensions: [".ts", ".js"] },
            module: { rules: [{ test: /\\.ts$/, use: [{ loader, options: loaderOptions }] }] },
        };
        // Marker and errors go to stdout together, so each build's errors follow its marker
        const report = (build, err, stats) => {
            console.log(${JSON.stringify(BUILD_MARKER)} + build + " ===");
            if (err || stats.hasErrors()) {
                console.log(String(err ?? stats.toString("errors-only")));
                process.exitCode = 1;
            }
        };
        ${
            watch
                ? `
        setTimeout(() => { console.error("watch timed out"); process.exit(3); }, 40000).unref();
        let build = 0;
        const watching = webpack(config).watch({ aggregateTimeout: 50, poll: 100 }, (err, stats) => {
            report(build, err, stats);
            if (build++ === 0) {
                setTimeout(() => fs.writeFileSync(path.join(projectDir, ${JSON.stringify(watch.entry)}), ${JSON.stringify(watch.edit)}), 300);
            } else {
                watching.close(() => {});
            }
        });`
                : `webpack(config, (err, stats) => report(0, err, stats));`
        }
    `;
    const scriptPath = path.join(projectDir, "run-webpack.cjs");
    fs.writeFileSync(scriptPath, script, { encoding: "utf-8" });

    const result = spawnSync(process.execPath, [scriptPath], { cwd: projectDir, encoding: "utf-8", timeout: 50000 });
    return { exitCode: result.status, output: `${result.stdout}${result.stderr}` };
};

const countOf = (text: string, part: string): number => text.split(part).length - 1;
