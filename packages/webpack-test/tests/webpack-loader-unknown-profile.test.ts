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

// Webpack runs in a separate Node process, like in webpack-profile-config.test.ts
const getTestDirs = () => {
    const testId = expect.getState().currentTestName?.replace(/[^a-zA-Z0-9]/g, "_") || "unknown";
    const PROJECT_DIR = path.resolve(__dirname, "..", `test-output-unknown-profile-${testId}_${Date.now()}`);
    return { PROJECT_DIR, OUTPUT_DIR: path.join(PROJECT_DIR, "dist"), SOURCE_DIR: path.join(PROJECT_DIR, "src") };
};

let testDirs: ReturnType<typeof getTestDirs>;

beforeEach(() => {
    testDirs = getTestDirs();

    writeSourceFile("hello.ts", `export const hello: string = "world";\n`, testDirs.SOURCE_DIR);
    writeSourceFile("other.ts", `export const other: string = "planet";\n`, testDirs.SOURCE_DIR);
    writeTsConfig({ target: ts.ScriptTarget.ES2020, outDir: testDirs.OUTPUT_DIR, rootDir: testDirs.SOURCE_DIR }, testDirs.PROJECT_DIR);
});

afterEach(() => {
    fs.rmSync(testDirs.PROJECT_DIR, { recursive: true, force: true });
});

describe("webpack w/ websmith-loader and an unconfigured profile", () => {
    it("should fail w/ profile error once w/ two entries and unknown profile in config file", () => {
        writeWebsmithConfig({ profiles: { a: {}, b: {} } }, testDirs.PROJECT_DIR);

        const actual = runWebpack({ profile: "missing", configFile: true });

        expect(actual.exitCode).toBe(1);
        expect(countOf(actual.output, "Profile 'missing' is not configured in")).toBe(1);
        expect(actual.output).toContain("Available profiles: a, b.");
        expect(actual.output).not.toMatch(/Module build failed|No processed output found|No profile with name|Missing profile/);
    }, 60000);

    it("should fail w/ profile error once w/ two entries and profile w/o config file", () => {
        const actual = runWebpack({ profile: "missing" });

        expect(actual.exitCode).toBe(1);
        expect(countOf(actual.output, "Profile 'missing' is passed but no websmith.config.json was found.")).toBe(1);
        expect(actual.output).not.toMatch(/Module build failed|No processed output found|Missing profile/);
    }, 60000);

    it("should fail w/ profile error once w/ thread-loader and unknown profile in config file", () => {
        writeWebsmithConfig({ profiles: { a: {}, b: {} } }, testDirs.PROJECT_DIR);

        const actual = runWebpack({ profile: "missing", configFile: true, threadLoader: true });

        expect(actual.exitCode).toBe(1);
        expect(countOf(actual.output, "Profile 'missing' is not configured in")).toBe(1);
        expect(actual.output).not.toMatch(/No profile with name|No processed output found/);
    }, 60000);

    it("should fail w/ depends error once w/ missing depends target in loader options profiles", () => {
        const actual = runWebpack({ profile: "a", config: { profiles: { a: { depends: ["nope"] } } } });

        expect(actual.exitCode).toBe(1);
        expect(countOf(actual.output, "Unknown profile 'nope' in 'depends' of the loader options. Available profiles: a.")).toBe(1);
    }, 60000);

    it("should fail w/ profile error in second build w/ filesystem cache and unknown profile in config file", () => {
        writeWebsmithConfig({ profiles: { a: {}, b: {} } }, testDirs.PROJECT_DIR);
        const first = runWebpack({ profile: "missing", configFile: true, filesystemCache: true });

        const actual = runWebpack({ profile: "missing", configFile: true, filesystemCache: true });

        expect(first.exitCode).toBe(1);
        expect(actual.exitCode).toBe(1);
        expect(countOf(actual.output, "Profile 'missing' is not configured in")).toBe(1);
    }, 120000);
});

type RunOptions = {
    profile: string;
    configFile?: boolean;
    config?: { profiles: Record<string, { depends?: string[] }> };
    threadLoader?: boolean;
    filesystemCache?: boolean;
};

const runWebpack = ({ profile, configFile = false, config, threadLoader = false, filesystemCache = false }: RunOptions): { exitCode: number | null; output: string } => {
    const loaderOptions = {
        transpileOnly: true,
        tsConfigFile: path.join(testDirs.PROJECT_DIR, "tsconfig.json"),
        ...(configFile && { configFile: path.join(testDirs.PROJECT_DIR, "websmith.config.json") }),
        ...(config && { config }),
        profile,
    };
    const script = `
        const webpack = require(${JSON.stringify(require.resolve("webpack"))});
        webpack(
            {
                mode: "development",
                devtool: false,
                target: "node",
                entry: {
                    hello: ${JSON.stringify(path.join(testDirs.SOURCE_DIR, "hello.ts"))},
                    other: ${JSON.stringify(path.join(testDirs.SOURCE_DIR, "other.ts"))},
                },
                output: { path: ${JSON.stringify(testDirs.OUTPUT_DIR)} },
                ${filesystemCache ? `cache: { type: "filesystem", cacheDirectory: ${JSON.stringify(path.join(testDirs.PROJECT_DIR, ".cache"))} },` : ""}
                resolve: { extensions: [".ts", ".js"] },
                module: {
                    rules: [
                        {
                            test: /\\.ts$/,
                            use: [
                                ${threadLoader ? `{ loader: ${JSON.stringify(require.resolve("thread-loader"))}, options: { workers: 1 } },` : ""}
                                {
                                    loader: ${JSON.stringify(require.resolve("websmith-loader"))},
                                    options: ${JSON.stringify(loaderOptions)},
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

const countOf = (text: string, part: string): number => text.split(part).length - 1;
