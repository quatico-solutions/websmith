/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { webpack } from "@quatico/websmith-node";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { writeTsConfig } from "./test-files";

const PROJECT_DIR = path.join(__dirname, "..", "output");
const OUTPUT_DIR = path.join(PROJECT_DIR, "lib");
const SOURCE_DIR = path.join(PROJECT_DIR, "src");

const webpackDefaults = {
    output: {
        path: OUTPUT_DIR,
    },
    module: {
        rules: [
            {
                test: /\.[jt]s?$/,
                loader: require.resolve("ts-loader"),
                options: {
                    transpileOnly: true,
                    configFile: path.join(PROJECT_DIR, "tsconfig.json"),
                },
            },
        ],
    },
};

beforeEach(() => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
    fs.rmSync(PROJECT_DIR, { recursive: true, force: true });
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.mkdirSync(SOURCE_DIR, { recursive: true });

    // Copy all source files for each test
    const originalSourceDir = path.join(__dirname, "..", "src");
    const sourceFiles = fs.readdirSync(originalSourceDir);
    for (const file of sourceFiles) {
        const srcPath = path.join(originalSourceDir, file);
        const destPath = path.join(SOURCE_DIR, file);
        if (fs.statSync(srcPath).isDirectory()) {
            fs.cpSync(srcPath, destPath, { recursive: true });
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
});

afterEach(() => {
    fs.rmSync(PROJECT_DIR, { recursive: true, force: true });
});

describe("webpack w/ ts-loader", () => {
    it("should build foobar-arrow.js with ES2020 target", async () => {
        writeTsConfig({
            target: ts.ScriptTarget.ES2020,
        });

        await webpack([path.join(SOURCE_DIR, "foobar-arrow.ts")], {
            webpack: { ...webpackDefaults },
            tsLoader: {
                compilerOptions: {
                    target: ts.ScriptTarget.ES2020,
                },
            },
        });

        expect(getOutput("main.js")).toMatchSnapshot();
    });

    it("should build foobar-function.js with ES2020 target", async () => {
        writeTsConfig({
            target: ts.ScriptTarget.ES2020,
        });

        await webpack([path.join(SOURCE_DIR, "foobar-function.ts")], {
            webpack: { ...webpackDefaults },
            tsLoader: {
                compilerOptions: {
                    target: ts.ScriptTarget.ES2020,
                },
            },
        });

        expect(getOutput("main.js")).toMatchSnapshot();
    });

    it("should build foobar-arrow.js with ES5 target", async () => {
        writeTsConfig({
            target: ts.ScriptTarget.ES5,
        });

        await webpack([path.join(SOURCE_DIR, "foobar-arrow.ts")], {
            webpack: { ...webpackDefaults },
            tsLoader: {
                compilerOptions: {
                    target: ts.ScriptTarget.ES5,
                },
            },
        });

        expect(getOutput("main.js")).toMatchSnapshot();
    });

    it("should build foobar-function.js with ES5 target", async () => {
        writeTsConfig({
            target: ts.ScriptTarget.ES5,
        });

        await webpack([path.join(SOURCE_DIR, "foobar-function.ts")], {
            webpack: { ...webpackDefaults },
            tsLoader: {
                compilerOptions: {
                    target: ts.ScriptTarget.ES5,
                },
            },
        });

        expect(getOutput("main.js")).toMatchSnapshot();
    });

    it("should build foobar-arrow.js with ESNEXT and ESM target", async () => {
        writeTsConfig({
            target: ts.ScriptTarget.ESNext,
            module: ts.ModuleKind.ESNext,
        });

        await webpack([path.join(SOURCE_DIR, "foobar-arrow.ts")], {
            webpack: {
                ...webpackDefaults,
                experiments: {
                    outputModule: true,
                },
                target: "node",
            },
            tsLoader: {
                compilerOptions: {
                    target: ts.ScriptTarget.ESNext,
                    module: ts.ModuleKind.ESNext,
                },
            },
        });

        expect(getOutput("main.mjs")).toMatchSnapshot();
    });

    it("should throw error with transpileOnly false", async () => {
        await expect(() =>
            webpack([path.join(SOURCE_DIR, "foobar-arrow.ts")], {
                webpack: { ...webpackDefaults },
                tsLoader: {
                    compilerOptions: {
                        target: ts.ScriptTarget.ES2020,
                    },
                    transpileOnly: false,
                },
            })
        ).rejects.toThrow(/error while parsing tsconfig\.json|The 'files' list in config file.*is empty/);
    });
});

const getOutput = (filePath: string) => fs.readFileSync(path.join(OUTPUT_DIR, filePath), "utf-8");
