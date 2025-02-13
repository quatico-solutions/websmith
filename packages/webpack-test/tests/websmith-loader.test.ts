/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type CompilationConfig as WebsmithOptions } from "@quatico/websmith-core";
import { webpack } from "@quatico/websmith-node";
import ForkTsCheckerWebpackPlugin from "fork-ts-checker-webpack-plugin";
import fs, { readFileSync, rmSync, statSync } from "node:fs";
import path, { resolve } from "node:path";

const OUTPUT_DIR = path.join(__dirname, "..", "lib");
const SOURCE_DIR = path.join(__dirname, "..", "src");
const ADDONS_DIR = path.join(__dirname, "..", "..", "example-addons", "lib");

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
                        loader: require.resolve("@quatico/websmith-webpack"),
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
        rmSync(resolve(OUTPUT_DIR), { recursive: true, force: true });
    });

    it("should yield compiled output with no targets", async () => {
        writeWebsmithOptions({
            addonsDir: ADDONS_DIR,
        });

        const actual = await webpack(undefined, {
            webpack: { ...webpackDefaults },
            websmith: {
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
                targets: undefined, // TODO: This is a workaround for the loaderContext.options not being set correctly
                webpackTarget: undefined, // TODO: This is a workaround for the loaderContext.options not being set correctly
            },
        });

        const output = readFileSync(resolve(OUTPUT_DIR, "main.js")).toString();
        expect(output).toContain('/***/ "./src/functions/getDate.ts":');
        expect(output).toContain('/***/ "./src/model/index.ts":');
        expect(actual).toMatch(/successfully/);
    });

    it("should yield compiled and generated output with transpileOnly true", async () => {
        writeWebsmithOptions({
            addonsDir: ADDONS_DIR,
            targets: {
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
                targets: ["valid"],
                webpackTarget: "valid",
            },
        });

        expect(readFileSync(resolve(OUTPUT_DIR, "output.yaml")).toString()).toContain("exports: [getDate]");

        const output = readFileSync(resolve(OUTPUT_DIR, "main.js")).toString();
        expect(output).toContain('/***/ "./src/functions/getDate.ts":');
        expect(output).toContain('/***/ "./src/model/index.ts":');
        expect(actual).toMatch(/successfully/);
    });

    it("should throw error with transpileOnly false", async () => {
        writeWebsmithOptions({
            addonsDir: ADDONS_DIR,
            targets: {
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
                    targets: ["valid"],
                    webpackTarget: "valid",
                },
            })
        ).rejects.toThrow(/No processed output found for ".*\/functions\/getDate\.ts" with targets "valid"/);
    });

    it("should throw error with unknown webpackTarget name", async () => {
        writeWebsmithOptions({
            addonsDir: ADDONS_DIR,
            targets: {
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
                    targets: ["existing"],
                    webpackTarget: "unknown",
                },
            })
        ).rejects.toThrow("No target found for 'webpackTarget' with name 'unknown'.");
    });

    it("should throw error with unknown target name in targets", async () => {
        writeWebsmithOptions({
            addonsDir: ADDONS_DIR,
            targets: {
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
                    targets: ["unknown"],
                    webpackTarget: "existing",
                },
            })
        ).rejects.toThrow("No target found for 'targets' with names '[\"unknown\"]'.");
    });

    it("should bundle using the first target w/o webpackTarget set", async () => {
        writeWebsmithOptions({
            addonsDir: ADDONS_DIR,
            targets: {
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
                targets: ["noWrite"],
                webpackTarget: undefined, // TODO: This is a workaround for the loaderContext.options not being set correctly
            },
        });

        expect(statSync(resolve(OUTPUT_DIR, "main.js")).isFile()).toBe(true);
    });

    it("should use default target w/o configured target and webpackTarget", async () => {
        writeWebsmithOptions({
            addonsDir: ADDONS_DIR,
            targets: {
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
                targets: undefined, // TODO: This is a workaround for the loaderContext.options not being set correctly
                webpackTarget: undefined, // TODO: This is a workaround for the loaderContext.options not being set correctly
            },
        });

        expect(statSync(resolve(OUTPUT_DIR, "main.js")).isFile()).toBe(true);
        expect(actual).toMatch(/successfully/);
    });

    // FIXME: Preloaders seem to be broken with the current project setup
    it.skip("should bundle the file w/ thread-loader being used", async () => {
        const webpackConfig = { ...webpackDefaults };
        webpackConfig.module.rules[0].use.unshift({
            loader: "thread-loader",
        } as any);
        writeWebsmithOptions({
            addonsDir: ADDONS_DIR,
            targets: {
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
                targets: ["noWrite"],
                webpackTarget: "noWrite",
            },
        });

        expect(statSync(resolve(OUTPUT_DIR, "main.js")).isFile()).toBe(true);
        const output = readFileSync(resolve(OUTPUT_DIR, "main.js")).toString();
        expect(output).toContain('/***/ "./src/functions/getDate.ts":');
        expect(output).toContain('/***/ "./src/model/index.ts":');
    });

    it("should bundle invalid TypeScript file w/ transpileOnly being used", async () => {
        fs.writeFileSync(path.join(SOURCE_DIR, "invalid.ts"), "this is no valid source code", {
            encoding: "utf-8",
        });
        writeWebsmithOptions({
            addonsDir: ADDONS_DIR,
            targets: {
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
                targets: ["noWrite"],
                webpackTarget: "noWrite",
            },
        });

        expect(statSync(resolve(OUTPUT_DIR, "main.js")).isFile()).toBe(true);
        const output = readFileSync(resolve(OUTPUT_DIR, "main.js")).toString();
        expect(output).toContain('/***/ "./src/invalid.ts":');
        expect(actual).toMatch(/successfully/);

        rmSync(resolve(SOURCE_DIR, "invalid.ts"), { force: true });
    });

    it("should bundle the file w/ fork-ts-checker-webpack-plugin being used", async () => {
        writeWebsmithOptions({
            addonsDir: ADDONS_DIR,
            targets: {
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
                targets: ["noWrite"],
                webpackTarget: "noWrite",
            },
        });

        expect(statSync(resolve(OUTPUT_DIR, "main.js")).isFile()).toBe(true);
        const output = readFileSync(resolve(OUTPUT_DIR, "main.js")).toString();
        expect(output).toContain('/***/ "./src/functions/getDate.ts":');
        expect(output).toContain('/***/ "./src/model/index.ts":');
        expect(actual).toMatch(/successfully/);
    });
});

const writeWebsmithOptions = (options: Partial<WebsmithOptions>) => {
    fs.mkdirSync(OUTPUT_DIR, {
        recursive: true,
    });
    fs.writeFileSync(path.join(OUTPUT_DIR, "websmith.config.json"), JSON.stringify(options), {
        encoding: "utf-8",
    });
};
