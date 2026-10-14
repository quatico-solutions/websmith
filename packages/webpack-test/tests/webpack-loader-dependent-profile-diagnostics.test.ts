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

// Webpack runs in a separate Node process, like in webpack-loader-unknown-profile.test.ts
const getTestDirs = () => {
    const testId = expect.getState().currentTestName?.replace(/[^a-zA-Z0-9]/g, "_") || "unknown";
    const PROJECT_DIR = path.resolve(__dirname, "..", `test-output-dependent-profile-${testId}_${Date.now()}`);
    return { PROJECT_DIR, OUTPUT_DIR: path.join(PROJECT_DIR, "dist"), SOURCE_DIR: path.join(PROJECT_DIR, "src") };
};

// TS4094 under declaration: true, with transpileOnly: false
const DECLARATION_ERROR_SOURCE = `export const C = class { private p = 1; };\n`;
const DECLARATION_ERROR = "may not be private or protected";
// A file-less option error of the dependent profile: TS5095 on TypeScript 5, where its wording varies across versions;
// TypeScript 6 lifts that restriction and reports the deprecated ES5 target instead (TS5107)
const OPTION_ERROR = /can only be used when 'module' is set to|target=ES5' is deprecated/;

let testDirs: ReturnType<typeof getTestDirs>;

beforeEach(() => {
    testDirs = getTestDirs();

    writeSourceFile("other.ts", `export const other: string = "planet";\n`, testDirs.SOURCE_DIR);
    writeTsConfig(
        { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext, strict: true, outDir: testDirs.OUTPUT_DIR, rootDir: testDirs.SOURCE_DIR },
        testDirs.PROJECT_DIR
    );
});

afterEach(() => {
    fs.rmSync(testDirs.PROJECT_DIR, { recursive: true, force: true });
});

describe("webpack w/ websmith-loader and dependent profiles", () => {
    const outDir = (name: string) => path.join(testDirs.PROJECT_DIR, name);

    it("should fail w/ declaration error only in dependent profile", () => {
        writeSourceFile("hello.ts", DECLARATION_ERROR_SOURCE, testDirs.SOURCE_DIR);
        writeWebsmithConfig(
            {
                profiles: {
                    app: { depends: ["dep"], tsConfig: { declaration: false, outDir: outDir("dist") } },
                    dep: { tsConfig: { declaration: true, outDir: outDir("dep-out") } },
                },
            },
            testDirs.PROJECT_DIR
        );

        const actual = runWebpack({ profile: "app" });

        expect(actual.exitCode).toBe(1);
        expect(countOf(actual.output, `${DECLARATION_ERROR}. (profile "dep")`)).toBe(1);
        expect(countOf(actual.output, DECLARATION_ERROR)).toBe(1);
    }, 60000);

    it("should fail w/ declaration error only in dependent profile under thread-loader", () => {
        writeSourceFile("hello.ts", DECLARATION_ERROR_SOURCE, testDirs.SOURCE_DIR);
        writeWebsmithConfig(
            {
                profiles: {
                    app: { depends: ["dep"], tsConfig: { declaration: false, outDir: outDir("dist") } },
                    dep: { tsConfig: { declaration: true, outDir: outDir("dep-out") } },
                },
            },
            testDirs.PROJECT_DIR
        );

        const actual = runWebpack({ profile: "app", threadLoader: true });

        expect(actual.exitCode).toBe(1);
        expect(countOf(actual.output, `${DECLARATION_ERROR}. (profile "dep")`)).toBe(1);
        expect(countOf(actual.output, DECLARATION_ERROR)).toBe(1);
    }, 60000);

    it("should report declaration error once w/ error in target and dependent profile", () => {
        writeSourceFile("hello.ts", DECLARATION_ERROR_SOURCE, testDirs.SOURCE_DIR);
        writeWebsmithConfig(
            {
                profiles: {
                    app: { depends: ["dep"], tsConfig: { declaration: true, outDir: outDir("dist") } },
                    dep: { tsConfig: { declaration: true, outDir: outDir("dep-out") } },
                },
            },
            testDirs.PROJECT_DIR
        );

        const actual = runWebpack({ profile: "app" });

        expect(actual.exitCode).toBe(1);
        expect(countOf(actual.output, DECLARATION_ERROR)).toBe(1);
        expect(actual.output).not.toContain('(profile "dep")');
    }, 60000);

    it("should fail w/ option error once w/ option error only in dependent profile", () => {
        writeSourceFile("hello.ts", `export const hello: string = "world";\n`, testDirs.SOURCE_DIR);
        writeTsConfig(
            {
                target: ts.ScriptTarget.ES2020,
                module: ts.ModuleKind.ESNext,
                moduleResolution: ts.ModuleResolutionKind.Bundler,
                strict: true,
                outDir: testDirs.OUTPUT_DIR,
                rootDir: testDirs.SOURCE_DIR,
            },
            testDirs.PROJECT_DIR
        );
        writeWebsmithConfig(
            {
                profiles: {
                    app: { depends: ["dep"], tsConfig: { module: "esnext", target: "es2020", outDir: outDir("dist") } },
                    dep: { tsConfig: { module: "commonjs", target: "es5", outDir: outDir("dep-out") } },
                },
            },
            testDirs.PROJECT_DIR
        );

        const actual = runWebpack({ profile: "app" });

        expect(actual.exitCode).toBe(1);
        expect(actual.output).toMatch(OPTION_ERROR);
        expect(countOf(actual.output, '(profile "dep")')).toBe(1);
    }, 60000);

    it("should report declaration error once w/ error in two dependent profiles", () => {
        writeSourceFile("hello.ts", DECLARATION_ERROR_SOURCE, testDirs.SOURCE_DIR);
        writeWebsmithConfig(
            {
                profiles: {
                    app: { depends: ["dep1", "dep2"], tsConfig: { declaration: false, outDir: outDir("dist") } },
                    dep1: { tsConfig: { declaration: true, outDir: outDir("dep1-out") } },
                    dep2: { tsConfig: { declaration: true, outDir: outDir("dep2-out") } },
                },
            },
            testDirs.PROJECT_DIR
        );

        const actual = runWebpack({ profile: "app" });

        expect(actual.exitCode).toBe(1);
        expect(countOf(actual.output, `${DECLARATION_ERROR}. (profile "dep1")`)).toBe(1);
        expect(countOf(actual.output, DECLARATION_ERROR)).toBe(1);
    }, 60000);
});

type RunOptions = {
    profile: string;
    threadLoader?: boolean;
};

const runWebpack = ({ profile, threadLoader = false }: RunOptions): { exitCode: number | null; output: string } => {
    const loaderOptions = {
        transpileOnly: false,
        tsConfigFile: path.join(testDirs.PROJECT_DIR, "tsconfig.json"),
        configFile: path.join(testDirs.PROJECT_DIR, "websmith.config.json"),
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
