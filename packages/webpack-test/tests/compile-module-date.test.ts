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
import { getOutput, writeTsConfig, writeWebsmithConfig } from "./test-files";

// Create unique test directories for each test to prevent cross-test contamination
const getTestDirs = () => {
    const testId = expect.getState().currentTestName?.replace(/[^a-zA-Z0-9]/g, "_") || "unknown";
    const timestamp = Date.now();
    const uniqueId = `${testId}_${timestamp}`;
    const PROJECT_DIR = path.resolve(__dirname, "..", `test-output-${uniqueId}`);
    const OUTPUT_DIR = path.resolve(PROJECT_DIR, "lib");
    const SOURCE_DIR = path.join(PROJECT_DIR, "src");
    return { PROJECT_DIR, OUTPUT_DIR, SOURCE_DIR };
};

const ADDONS_DIR = path.join(__dirname, "..", "..", "example-addons", "src");

const getTsDefaults = (OUTPUT_DIR: string) => ({
    moduleResolution: ts.ModuleResolutionKind.Node10,
    outDir: OUTPUT_DIR,
    removeComments: true,
});

const getWebpackDefaults = (PROJECT_DIR: string, OUTPUT_DIR: string) => ({
    output: {
        path: OUTPUT_DIR,
    },
    module: {
        rules: [
            {
                test: /\.[j|t]sx?$/,
                exclude: /node_modules/,
                use: [
                    {
                        loader: require.resolve("websmith-loader"),
                        options: {
                            transpileOnly: true,
                            tsConfigFile: path.join(PROJECT_DIR, "tsconfig.json"),
                        },
                    },
                    {
                        loader: require.resolve("ts-loader"),
                        options: {
                            transpileOnly: true,
                            configFile: path.join(PROJECT_DIR, "tsconfig.json"),
                        },
                    },
                ],
            },
        ],
    },
});

beforeAll(() => {
    fs.rmSync(path.resolve(path.join(__dirname, "..", "..", "example-addons", "lib")), { recursive: true, force: true });
});

let PROJECT_DIR: string;
let OUTPUT_DIR: string;
let SOURCE_DIR: string;

beforeEach(() => {
    jest.spyOn(process.stdout, "write").mockImplementation(() => true); // Don't show extensive log messages in tests

    const testDirs = getTestDirs();
    PROJECT_DIR = testDirs.PROJECT_DIR;
    OUTPUT_DIR = testDirs.OUTPUT_DIR;
    SOURCE_DIR = testDirs.SOURCE_DIR;

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

describe("project bundling", () => {
    it("yields bundled output", async () => {
        const tsDefaults = getTsDefaults(OUTPUT_DIR);
        const webpackDefaults = getWebpackDefaults(PROJECT_DIR, OUTPUT_DIR);

        writeWebsmithConfig(
            {
                addonsDir: ADDONS_DIR,
                profiles: {
                    noWrite: {
                        addons: ["export-yaml-generator"],
                    },
                },
            },
            PROJECT_DIR
        );

        writeTsConfig(
            {
                ...tsDefaults,
                jsx: ts.JsxEmit.React,
            },
            PROJECT_DIR
        );

        await webpack(undefined, {
            webpack: {
                ...webpackDefaults,
                devtool: "source-map",
                entry: {
                    main: path.join(SOURCE_DIR, "index.tsx"),
                    functions: path.join(SOURCE_DIR, "functions", "getDate.ts"),
                },
            },
            tsLoader: {
                compilerOptions: {
                    ...tsDefaults,
                    jsx: ts.JsxEmit.React,
                },
            },
            websmith: {
                configFile: path.join(PROJECT_DIR, "websmith.config.json"),
                profile: "noWrite",
            },
        });

        expect(fs.readdirSync(OUTPUT_DIR)).toEqual(["functions.js", "functions.js.map", "main.js", "main.js.map", "output.yaml"]);

        const expected = getOutput("output.yaml", OUTPUT_DIR);
        [
            `-file: "${path.resolve(SOURCE_DIR, "index.tsx")}"\nexports: [render]`,
            `-file: "${path.resolve(SOURCE_DIR, "functions/getDate.ts")}"\nexports: [getDate]`,
            `-file: "${path.resolve(SOURCE_DIR, "model/index.ts")}"\nexports: []`,
            `-file: "${path.resolve(SOURCE_DIR, "model/create-message.ts")}"\nexports: [createMessage]`,
        ].forEach(it => expect(expected).toContain(it));
    }, 60000);
});
