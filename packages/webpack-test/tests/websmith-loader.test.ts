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
import { WebpackError } from "webpack";

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
                            project: path.join(__dirname, "..", "tsconfig.json"),
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

    it("should throw an error if webpackTarget does not exist as target", async () => {
        writeWebsmithOptions({
            addonsDir: ADDONS_DIR,
            targets: {
                writeOnly: {
                    writeFile: true,
                    addons: ["export-yaml-generator"],
                },
            },
        });

        await expect(() =>
            webpack(undefined, {
                webpack: { ...webpackDefaults },
                websmith: {
                    configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
                    targets: ["writeOnly"],
                    webpackTarget: "unknown",
                },
            })
        ).rejects.toThrow('No target found for "unknown"');
    });

    it("should bundle using the first target w/ writeFile false w/o webpackTarget set", async () => {
        writeWebsmithOptions({
            addonsDir: ADDONS_DIR,
            targets: {
                noWrite: {
                    writeFile: false,
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
            },
        });

        expect(statSync(resolve(OUTPUT_DIR, "main.js")).isFile()).toBe(true);
    });

    it("should select the writeFile target w/ webpackTarget set", async () => {
        writeWebsmithOptions({
            addonsDir: ADDONS_DIR,
            targets: {
                writeOnly: {
                    writeFile: true,
                    addons: ["export-yaml-generator"],
                },
            },
        });

        await webpack(undefined, {
            webpack: { ...webpackDefaults },
            websmith: {
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
                transpileOnly: true,
                targets: ["writeOnly"],
                webpackTarget: "writeOnly",
            },
        });

        expect(statSync(resolve(OUTPUT_DIR, "main.js")).isFile()).toBe(true);
    });

    // FIXME: This test is broken, not sure whether it's the test or the code
    it.skip("should write a warning if no target w/ writeFile false is specified", async () => {
        writeWebsmithOptions({
            addonsDir: ADDONS_DIR,
            targets: {
                writeOnly: {
                    writeFile: true,
                    addons: ["export-yaml-generator"],
                },
            },
        });

        const actual = await webpack(undefined, {
            webpack: { ...webpackDefaults },
            websmith: {
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
                targets: ["writeOnly"],
            },
        });

        expect(statSync(resolve(OUTPUT_DIR, "main.js")).isFile()).toBe(true);
        expect(actual).toContainEqual(new WebpackError(`No writeFile: false targets found for "*"`));
    });

    it("should use default target w/o configured target and webpackTarget", async () => {
        writeWebsmithOptions({
            addonsDir: ADDONS_DIR,
            targets: {
                writeOnly: {
                    writeFile: true,
                    addons: ["export-yaml-generator"],
                },
            },
        });

        const actual = await webpack(undefined, {
            webpack: { ...webpackDefaults },
            websmith: {
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
                transpileOnly: true,
            },
        });

        expect(statSync(resolve(OUTPUT_DIR, "main.js")).isFile()).toBe(true);
        expect(actual).toMatch(/successfully/);
    });

    // FIXME: This test is broken, not sure whether it's the test or the code
    it.skip("should write a warning if more than one target w/ writeFile false is specified", async () => {
        writeWebsmithOptions({
            addonsDir: ADDONS_DIR,
            targets: {
                noWrite: {
                    writeFile: false,
                    addons: ["export-yaml-generator"],
                },
                noWrite2: {
                    writeFile: false,
                    addons: ["export-yaml-generator"],
                },
            },
        });

        const actual = await webpack(undefined, {
            webpack: { ...webpackDefaults },
            websmith: {
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
                transpileOnly: true,
                targets: ["noWrite", "noWrite2"],
                webpackTarget: "noWrite",
            },
        });

        expect(statSync(resolve(OUTPUT_DIR, "main.js")).isFile()).toBe(true);
        expect(actual).toContainEqual(`Target "noWrite2" is not used by the WebsmithPlugin.`);
    });

    // FIXME: Preloaders seem to be broken with the current project setup
    it.skip("should bundle the file w/ thread-loader being used", async () => {
        const webpackConfig = { ...webpackDefaults };
        webpackConfig.module.rules[0].use.unshift({
            loader: "thread-loader",
            options: {
                project: path.resolve(__dirname, "..", "tsconfig.json"),
            },
        });
        writeWebsmithOptions({
            addonsDir: ADDONS_DIR,
            targets: {
                noWrite: {
                    writeFile: false,
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
                    writeFile: false,
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
                    writeFile: false,
                    addons: ["export-yaml-generator"],
                },
            },
        });

        const actual = await webpack(undefined, {
            webpack: { ...webpackDefaults, plugins: [new ForkTsCheckerWebpackPlugin()] },
            websmith: {
                configFile: path.join(OUTPUT_DIR, "websmith.config.json"),
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
