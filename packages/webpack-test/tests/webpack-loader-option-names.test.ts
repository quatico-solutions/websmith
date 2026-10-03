/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { writeSourceFile, writeTsConfig } from "./test-files";

// Webpack runs in a separate Node process, like in webpack-profile-config.test.ts
const getTestDirs = () => {
    const testId = expect.getState().currentTestName?.replace(/[^a-zA-Z0-9]/g, "_") || "unknown";
    const PROJECT_DIR = path.resolve(__dirname, "..", `test-output-option-names-${testId}_${Date.now()}`);
    return { PROJECT_DIR, OUTPUT_DIR: path.join(PROJECT_DIR, "dist"), SOURCE_DIR: path.join(PROJECT_DIR, "src") };
};

let testDirs: ReturnType<typeof getTestDirs>;

beforeEach(() => {
    testDirs = getTestDirs();

    writeSourceFile("package.json", JSON.stringify({ type: "module" }), testDirs.PROJECT_DIR);
    writeTsConfig({ target: ts.ScriptTarget.ES2022, outDir: testDirs.OUTPUT_DIR }, testDirs.PROJECT_DIR);
});

afterEach(() => {
    fs.rmSync(testDirs.PROJECT_DIR, { recursive: true, force: true });
});

describe("webpack w/ websmith-loader and option names in loader options", () => {
    it.each([true, false])("should emit ES module code w/ tsConfig module NodeNext and transpileOnly %s", transpileOnly => {
        writeSourceFile("index.ts", `export const hello: string = "world";\n`, testDirs.SOURCE_DIR);

        const actual = runWebpack({ transpileOnly, tsConfig: { module: "NodeNext" } });

        expect(actual.exitCode).toBe(0);
        expect(actual.emitted).toContain("export const hello");
        expect(actual.emitted).not.toContain("exports.hello");
    }, 60000);

    it("should fail w/ config error once w/ invalid tsConfig module and several modules", () => {
        writeSourceFile("index.ts", `export { hello } from "./hello";\n`, testDirs.SOURCE_DIR);
        writeSourceFile("hello.ts", `export const hello: string = "world";\n`, testDirs.SOURCE_DIR);

        const actual = runWebpack({ transpileOnly: true, tsConfig: { module: "nope" } });

        expect(actual.exitCode).toBe(1);
        expect(countOf(actual.output, "Invalid 'tsConfig.module' value 'nope' in the loader options")).toBe(1);
    }, 60000);
});

// Records the code websmith-loader emits per module: webpack rewrites the module syntax in the bundle
const CAPTURE_LOADER = `
const fs = require("node:fs");
module.exports = function (source) {
    fs.appendFileSync(require("node:path").join(__dirname, "emitted.txt"), source);
    return source;
};
`;

const runWebpack = (loaderOptions: Record<string, unknown>): { exitCode: number | null; output: string; emitted: string } => {
    const captureLoaderPath = path.join(testDirs.PROJECT_DIR, "capture-loader.cjs");
    fs.writeFileSync(captureLoaderPath, CAPTURE_LOADER, { encoding: "utf-8" });
    const script = `
        const webpack = require(${JSON.stringify(require.resolve("webpack"))});
        webpack(
            {
                mode: "development",
                devtool: false,
                target: "node",
                entry: ${JSON.stringify(path.join(testDirs.SOURCE_DIR, "index.ts"))},
                output: { path: ${JSON.stringify(testDirs.OUTPUT_DIR)} },
                resolve: { extensions: [".ts", ".js"] },
                module: {
                    rules: [
                        {
                            test: /\\.ts$/,
                            use: [
                                ${JSON.stringify(captureLoaderPath)},
                                {
                                    loader: ${JSON.stringify(require.resolve("websmith-loader"))},
                                    options: ${JSON.stringify({ ...loaderOptions, tsConfigFile: path.join(testDirs.PROJECT_DIR, "tsconfig.json") })},
                                },
                            ],
                        },
                    ],
                },
            },
            (err, stats) => {
                if (err || stats.hasErrors()) {
                    console.error(err ?? stats.toString("errors-only"));
                    process.exitCode = 1;
                }
            }
        );
    `;
    const scriptPath = path.join(testDirs.PROJECT_DIR, "run-webpack.cjs");
    fs.writeFileSync(scriptPath, script, { encoding: "utf-8" });

    const result = spawnSync(process.execPath, [scriptPath], { cwd: testDirs.PROJECT_DIR, encoding: "utf-8", timeout: 50000 });
    const emittedPath = path.join(testDirs.PROJECT_DIR, "emitted.txt");
    return {
        exitCode: result.status,
        output: `${result.stdout}${result.stderr}`,
        emitted: fs.existsSync(emittedPath) ? fs.readFileSync(emittedPath, "utf-8") : "",
    };
};

const countOf = (text: string, part: string): number => text.split(part).length - 1;
