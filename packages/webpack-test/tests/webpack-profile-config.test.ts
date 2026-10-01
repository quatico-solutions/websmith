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
import { writeSourceFile, writeTsConfig, writeWebsmithConfig } from "./test-files";

// Webpack runs in a separate Node process, like in webpack-esm-consumer.test.ts
const getTestDirs = () => {
    const testId = expect.getState().currentTestName?.replace(/[^a-zA-Z0-9]/g, "_") || "unknown";
    const PROJECT_DIR = path.resolve(__dirname, "..", `test-output-profile-config-${testId}_${Date.now()}`);
    return { PROJECT_DIR, OUTPUT_DIR: path.join(PROJECT_DIR, "dist"), SOURCE_DIR: path.join(PROJECT_DIR, "src") };
};

let testDirs: ReturnType<typeof getTestDirs>;

beforeEach(() => {
    testDirs = getTestDirs();

    writeSourceFile("index.ts", `export const hello: string = "world";\n`, testDirs.SOURCE_DIR);
    writeTsConfig({ target: ts.ScriptTarget.ES2020, outDir: testDirs.OUTPUT_DIR }, testDirs.PROJECT_DIR);
    writeWebsmithConfig(
        {
            profiles: {
                broken: { depends: ["unknown-profile"] },
                valid: { tsConfig: { outDir: testDirs.OUTPUT_DIR } },
            },
        },
        testDirs.PROJECT_DIR
    );
});

afterEach(() => {
    fs.rmSync(testDirs.PROJECT_DIR, { recursive: true, force: true });
});

describe("webpack w/ websmith-loader and a broken profile in websmith.config.json", () => {
    it("should build w/o errors w/ valid selected profile", () => {
        const actual = runWebpack("valid");

        expect(actual).toEqual({ exitCode: 0, output: expect.not.stringContaining("unknown-profile") });
    }, 60000);

    it("should report the config error w/ broken selected profile", () => {
        const actual = runWebpack("broken");

        expect(actual.output).toContain("Unknown profile 'unknown-profile' in 'depends'");
    }, 60000);
});

const runWebpack = (profile: string): { exitCode: number | null; output: string } => {
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
                                {
                                    loader: ${JSON.stringify(require.resolve("websmith-loader"))},
                                    options: {
                                        transpileOnly: true,
                                        tsConfigFile: ${JSON.stringify(path.join(testDirs.PROJECT_DIR, "tsconfig.json"))},
                                        configFile: ${JSON.stringify(path.join(testDirs.PROJECT_DIR, "websmith.config.json"))},
                                        profile: ${JSON.stringify(profile)},
                                    },
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
    return { exitCode: result.status, output: `${result.stdout}${result.stderr}` };
};
