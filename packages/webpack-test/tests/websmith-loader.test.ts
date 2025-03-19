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
import { getOutput, writeWebsmithConfig } from "./test-files";

const OUTPUT_DIR = path.join(__dirname, "..", "lib");
const SOURCE_DIR = path.join(__dirname, "..", "src");
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
                            tsConfigFile: path.join(__dirname, "..", "tsconfig.json"),
                        },
                    },
                ],
            },
        ],
    },
};

describe("webpack w/ websmith", () => {
    afterEach(() => {
        fs.rmSync(path.resolve(OUTPUT_DIR), { recursive: true, force: true });
    });

    it("should yield compiled output with no profile", async () => {
        writeWebsmithConfig({
            addonsDir: ADDONS_DIR,
        });

        const actual = await webpack(undefined, {
            webpack: { ...webpackDefaults },
            websmith: {
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
                profile: undefined, // TODO: This is a workaround for the loaderContext.options not being set correctly
            },
        });

        expect(getOutput("main.js")).toContain('/***/ "./src/functions/getDate.ts":');
        expect(getOutput("main.js")).toContain('/***/ "./src/model/index.ts":');
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
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
                transpileOnly: true,
                profile: "valid",
            },
        });

        expect(getOutput("output.yaml")).toContain("exports: [getDate]");
        expect(getOutput("main.js")).toContain('/***/ "./src/functions/getDate.ts":');
        expect(getOutput("main.js")).toContain('/***/ "./src/model/index.ts":');
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
                    configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
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
                    configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
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
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
                transpileOnly: true,
                profile: undefined, // TODO: This is a workaround for the loaderContext.options not being set correctly
            },
        });

        expect(fs.statSync(path.resolve(OUTPUT_DIR, "main.js")).isFile()).toBe(true);
        expect(actual).toMatch(/successfully/);
    });

    // FIXME: Preloaders seem to be broken with the current project setup
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
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
                transpileOnly: true,
                profile: "noWrite",
            },
        });

        expect(getOutput("main.js")).toContain('/***/ "./src/functions/getDate.ts":');
        expect(getOutput("main.js")).toContain('/***/ "./src/model/index.ts":');
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
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
                transpileOnly: true,
                profile: "noWrite",
            },
        });

        expect(getOutput("main.js")).toContain('/***/ "./src/invalid.ts":');
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
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
                transpileOnly: true,
                profile: "noWrite",
            },
        });

        expect(getOutput("main.js")).toContain('/***/ "./src/functions/getDate.ts":');
        expect(getOutput("main.js")).toContain('/***/ "./src/model/index.ts":');
        expect(actual).toMatch(/successfully/);
    });
});
