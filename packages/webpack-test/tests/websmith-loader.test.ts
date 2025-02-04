/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { webpack } from "@quatico/websmith-node";
import { readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path, { join, resolve } from "node:path";
import ts from "typescript";
import { WebpackError, type Compiler, type Configuration } from "webpack";

const projectDir = path.resolve(__dirname, "../__data__/module-test");
const OUTPUT_DIR = path.join(__dirname, "..", "lib");
const targetInput = path.resolve(projectDir, "src", "index.tsx");
const input = readFileSync(targetInput).toString();
let cleanupCompiler: Compiler | undefined;

const tsDefaults = {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Node10,
    project: path.join(__dirname, "..", "tsconfig.json"),
    outDir: OUTPUT_DIR,
    removeComments: true,
};

const webpackDefaults = {
    output: {
        path: OUTPUT_DIR,
    },
    module: {
        rules: [
            {
                test: /\.[jt]s?$/,
                loader: require.resolve("@quatico/websmith-webpack"),
                options: {
                    transpileOnly: true,
                    project: path.join(__dirname, "..", "tsconfig.json"),
                },
            },
            {
                test: /\.[jt]s?$/,
                loader: require.resolve("ts-loader"),
                options: {
                    transpileOnly: true,
                    configFile: path.join(__dirname, "..", "tsconfig.json"),
                },
            },
        ],
    },
};

afterEach(() => {
    if (cleanupCompiler) {
        cleanupCompiler.close(() => undefined);
        cleanupCompiler = undefined;
    }
    rmSync(resolve(projectDir, ".build"), { recursive: true, force: true });
    writeFileSync(targetInput, input);
});

// FIXME: This test is not working, we need valid entries
describe.skip("webpack loader", () => {
    console.info = jest.fn();
    it("should throw an error if webpackTarget does not exist as target", async () => {
        const webpackConfig = requireWebpackConfig("webpack_unknownWebpackTarget.config.js");

        await expect(() =>
            webpack([], {
                webpack: webpackConfig,
            })
        ).rejects.toThrow('No target found for "unknown"');
    });

    it("should bundle using the first target w/ writeFile false w/o webpackTarget set", async () => {
        const target = resolve(projectDir, ".build", "lib", "main.js");
        const webpackConfig = requireWebpackConfig("webpack_noWebpackTarget.config.js");

        await webpack([], { webpack: webpackConfig });

        expect(statSync(target).isFile()).toBe(true);
    });

    it("should select the writeFile target w/ webpackTarget set", async () => {
        const target = resolve(projectDir, ".build", "lib", "main.js");
        const webpackConfig = requireWebpackConfig("webpack_noNoWriteTargetsWithWebpackTarget.config.js");

        await webpack([], { webpack: webpackConfig });

        expect(statSync(target).isFile()).toBe(true);
    });

    it("should write a warning if no target w/ writeFile false is specified", async () => {
        const target = resolve(projectDir, ".build", "lib", "main.js");
        const webpackConfig = requireWebpackConfig("webpack_noNoWriteTargets.config.js");

        const actual = await webpack([], { webpack: webpackConfig });

        expect(statSync(target).isFile()).toBe(true);
        expect(actual).toContainEqual(new WebpackError(`No writeFile: false targets found for "*"`));
    });

    it("should use default target w/o configured target and webpackTarget", async () => {
        const target = resolve(projectDir, ".build", "lib", "main.js");
        const webpackConfig = requireWebpackConfig("webpack_noTargets.config.js");

        const actual = await webpack([], { webpack: webpackConfig });

        expect(statSync(target).isFile()).toBe(true);
        expect(actual).toContainEqual("");
    });

    it("should write a warning if more than one target w/ writeFile false is specified", async () => {
        const target = resolve(projectDir, ".build", "lib", "main.js");
        const webpackConfig = requireWebpackConfig("webpack_multipleNoWriteTargets.config.js");

        const actual = await webpack([], { webpack: webpackConfig });

        expect(statSync(target).isFile()).toBe(true);
        expect(actual).toContainEqual(`Target "noWrite2" is not used by the WebsmithPlugin.`);
    });

    // FIXME: Preloaders seem to be broken with the current project setup
    it.skip("should bundle the file w/ thread-loader being used", async () => {
        const target = resolve(projectDir, ".build", "lib", "main.js");
        const webpackConfig = requireWebpackConfig("webpack_threadLoader.config.js");

        await webpack([], {
            webpack: { ...webpackConfig },
        });

        expect(statSync(target).isFile()).toBe(true);
        const output = readFileSync(target).toString();
        expect(output).toContain('/***/ "./__data__/module-test/src/functions/getDate.ts":');
        expect(output).toContain('/***/ "./__data__/module-test/src/model/index.ts":');
    });

    it("should bundle invalid TypeScript file w/ transpileOnly being used", async () => {
        const target = resolve(projectDir, ".build", "lib", "main.js");
        const webpackConfig = requireWebpackConfig("webpack_transpileOnly.config.js");

        const actual = await webpack([], { webpack: webpackConfig });

        expect(statSync(target).isFile()).toBe(true);
        expect(actual).toEqual("");
        const output = readFileSync(target).toString();
        expect(output).toContain('/***/ "./__data__/module-test/src/invalid.ts":');
    });

    it("should bundle the file w/ fork-ts-checker-webpack-plugin being used", async () => {
        const target = resolve(projectDir, ".build", "lib", "main.js");
        const webpackConfig = requireWebpackConfig("webpack_fork_ts.config.js");

        const actual = await webpack([], { webpack: webpackConfig });

        expect(statSync(target).isFile()).toBe(true);
        expect(actual).toEqual("");
        const output = readFileSync(target).toString();
        expect(output).toContain('/***/ "./__data__/module-test/src/functions/getDate.ts":');
        expect(output).toContain('/***/ "./__data__/module-test/src/model/index.ts":');
    });
});

const requireWebpackConfig = (configFileName: string, watch = false): Configuration => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return { ...require(join(projectDir, configFileName))(), ...(!!watch && { watch }) } as Configuration;
};
