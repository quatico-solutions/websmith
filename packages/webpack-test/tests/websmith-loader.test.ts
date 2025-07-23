/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { webpack } from "@quatico/websmith-node";
import ForkTsCheckerWebpackPlugin from "fork-ts-checker-webpack-plugin";
import fs from "node:fs";
import path from "node:path";
import { getOutput, writeTsConfig, writeWebsmithConfig } from "./test-files";
import ts from "typescript";

const PROJECT_DIR = path.join(__dirname, "..", "output");
const OUTPUT_DIR = path.join(PROJECT_DIR, "lib");
const SOURCE_DIR = path.join(PROJECT_DIR, "src");
const ADDONS_DIR = path.join(__dirname, "..", "..", "example-addons", "src");

const webpackDefaults = {
    entry: {
        main: path.join(SOURCE_DIR, "index.tsx"),
        functions: path.join(SOURCE_DIR, "functions", "getDate.ts"),
    },
    output: {
        path: OUTPUT_DIR,
    },
    module: {
        rules: [
            {
                test: /\.[jt]sx?$/,
                exclude: [/node_modules/],
                use: [
                    {
                        loader: require.resolve("websmith-loader"),
                        options: {
                            transpileOnly: true,
                            tsConfigFile: path.join(PROJECT_DIR, "tsconfig.json"),
                        },
                    },
                ],
            },
        ],
    },
};

beforeAll(() => {
    fs.rmSync(path.resolve(path.join(__dirname, "..", "..", "example-addons", "lib")), { recursive: true, force: true });
});

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

    writeTsConfig({
        moduleResolution: ts.ModuleResolutionKind.Node10,
        outDir: OUTPUT_DIR,
        target: ts.ScriptTarget.ESNext,
        module: ts.ModuleKind.ESNext,
        jsx: ts.JsxEmit.React,
        noEmit: true,
    });
});

afterEach(() => {
    fs.rmSync(PROJECT_DIR, { recursive: true, force: true });
});

describe("webpack w/ websmith", () => {
    it("should yield compiled output with no profile", async () => {
        writeWebsmithConfig({
            addonsDir: ADDONS_DIR,
        });

        const actual = await webpack(undefined, {
            webpack: { ...webpackDefaults },
            websmith: {
                configFile: path.join(PROJECT_DIR, "websmith.config.json"),
                profile: undefined, // TODO: This is a workaround for the loaderContext.options not being set correctly
            },
        });

        expect(getOutput("main.js")).toContain('/***/ "./output/src/functions/getDate.ts":');
        expect(getOutput("main.js")).toContain('/***/ "./output/src/model/index.ts":');
        expect(actual).toMatch(/successfully/);
    });

    it("should yield compiled and generated output with transpileOnly true", async () => {
        writeWebsmithConfig({
            addonsDir: ADDONS_DIR,
            profiles: {
                valid: {
                    addons: ["export-yaml-generator"],
                },
            },
        });

        const actual = await webpack(undefined, {
            webpack: { ...webpackDefaults },
            websmith: {
                configFile: path.join(PROJECT_DIR, "websmith.config.json"),
                transpileOnly: true,
                profile: "valid",
            },
        });

        expect(getOutput("output.yaml")).toContain("exports: [getDate]");
        expect(getOutput("main.js")).toContain('/***/ "./output/src/functions/getDate.ts":');
        expect(getOutput("main.js")).toContain('/***/ "./output/src/model/index.ts":');
        expect(actual).toMatch(/successfully/);
    });

    it("should throw error with transpileOnly false", async () => {
        writeWebsmithConfig({
            addonsDir: ADDONS_DIR,
            profiles: {
                valid: {
                    addons: ["export-yaml-generator"],
                },
            },
        });

        await expect(() =>
            webpack(undefined, {
                webpack: { ...webpackDefaults },
                websmith: {
                    configFile: path.join(PROJECT_DIR, "websmith.config.json"),
                    transpileOnly: false,
                    profile: "valid",
                },
            })
        ).rejects.toThrow(/No processed output found for ".*\/functions\/getDate\.ts" with profile "valid"/);
    });

    it("should throw error with unknown profile name", async () => {
        writeWebsmithConfig({
            addonsDir: ADDONS_DIR,
            profiles: {
                existing: {
                    addons: ["export-yaml-generator"],
                },
            },
        });

        await expect(() =>
            webpack(undefined, {
                webpack: { ...webpackDefaults },
                websmith: {
                    configFile: path.join(PROJECT_DIR, "websmith.config.json"),
                    transpileOnly: true,
                    profile: "unknown",
                },
            })
        ).rejects.toThrow("Found missing profile(s) 'unknown' in available profile(s) 'existing'.");
    });

    it("should use default profile w/o configured profile", async () => {
        writeWebsmithConfig({
            addonsDir: ADDONS_DIR,
            profiles: {
                writeOnly: {
                    addons: ["export-yaml-generator"],
                },
            },
        });

        const actual = await webpack(undefined, {
            webpack: { ...webpackDefaults },
            websmith: {
                configFile: path.join(PROJECT_DIR, "websmith.config.json"),
                transpileOnly: true,
                profile: undefined, // TODO: This is a workaround for the loaderContext.options not being set correctly
            },
        });

        expect(fs.statSync(path.resolve(OUTPUT_DIR, "main.js")).isFile()).toBe(true);
        expect(actual).toMatch(/successfully/);
    });

    // TODO: Skipped Test: Preloaders seem to be broken with the current project setup
    it.skip("should bundle the file w/ thread-loader being used", async () => {
        const webpackConfig = { ...webpackDefaults };
        webpackConfig.module.rules[0].use.unshift({
            loader: "thread-loader",
        } as any);
        writeWebsmithConfig({
            addonsDir: ADDONS_DIR,
            profiles: {
                noWrite: {
                    addons: ["export-yaml-generator"],
                },
            },
        });

        await webpack(undefined, {
            webpack: { ...webpackDefaults },
            websmith: {
                configFile: path.join(PROJECT_DIR, "websmith.config.json"),
                transpileOnly: true,
                profile: "noWrite",
            },
        });

        expect(getOutput("main.js")).toContain('/***/ "./output/src/functions/getDate.ts":');
        expect(getOutput("main.js")).toContain('/***/ "./output/src/model/index.ts":');
    });

    it("should bundle invalid TypeScript file w/ transpileOnly being used", async () => {
        fs.writeFileSync(path.join(SOURCE_DIR, "invalid.ts"), "this is no valid source code", {
            encoding: "utf-8",
        });
        writeWebsmithConfig({
            addonsDir: ADDONS_DIR,
            profiles: {
                noWrite: {
                    addons: ["export-yaml-generator"],
                },
            },
        });

        const actual = await webpack(undefined, {
            webpack: { ...webpackDefaults, entry: { main: path.join(SOURCE_DIR, "invalid.ts") }, devtool: "source-map" },
            websmith: {
                configFile: path.join(PROJECT_DIR, "websmith.config.json"),
                transpileOnly: true,
                profile: "noWrite",
            },
        });

        expect(getOutput("main.js")).toContain('/***/ "./output/src/invalid.ts":');
        expect(actual).toMatch(/successfully/);

        fs.rmSync(path.resolve(SOURCE_DIR, "invalid.ts"), { force: true });
    });

    it("should bundle the file w/ fork-ts-checker-webpack-plugin being used", async () => {
        writeWebsmithConfig({
            addonsDir: ADDONS_DIR,
            profiles: {
                noWrite: {
                    addons: ["export-yaml-generator"],
                },
            },
        });

        const actual = await webpack(undefined, {
            webpack: { ...webpackDefaults, plugins: [new ForkTsCheckerWebpackPlugin()] },
            websmith: {
                configFile: path.join(PROJECT_DIR, "websmith.config.json"),
                transpileOnly: true,
                profile: "noWrite",
            },
        });

        expect(getOutput("main.js")).toContain('/***/ "./output/src/functions/getDate.ts":');
        expect(getOutput("main.js")).toContain('/***/ "./output/src/model/index.ts":');
        expect(actual).toMatch(/successfully/);
    });
});
