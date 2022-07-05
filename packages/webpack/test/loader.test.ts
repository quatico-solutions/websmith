/* eslint-disable no-console */
/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { readFileSync, rmSync, statSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import { Compiler, WebpackError } from "webpack";
import { createWebpackCompiler } from "./webpack-utils";

const projectDir = resolve(__dirname, "..", "test", "__data__", "module-date");
const targetInput = resolve(projectDir, "src", "index.tsx");
const input = readFileSync(targetInput).toString();
let cleanupCompiler: Compiler | undefined;

afterEach(() => {
    if (cleanupCompiler) {
        cleanupCompiler.close(() => undefined);
        cleanupCompiler = undefined;
    }
    rmSync(resolve(projectDir, ".build"), { recursive: true, force: true });
    writeFileSync(targetInput, input);
});

describe("webpack loader", () => {
    // eslint-disable-next-line no-console
    console.info = () => undefined;
    it("should throw an error if webpackTarget does not exist as target", async () => {
        await createWebpackCompiler(requireWebpackConfig("webpack_unknownWebpackTarget.config.js"), projectDir)
            .then(({ compiler }) => {
                cleanupCompiler = compiler;
            })
            .catch(({ errors }) => {
                // eslint-disable-next-line jest/no-conditional-expect
                expect(errors).toContain('No target found for "noWrite"');
            });
    });

    it("should bundle using the first target w/ writeFile false w/o webpackTarget set", async () => {
        const target = resolve(projectDir, ".build", "lib", "main.js");

        const { compiler } = await createWebpackCompiler(requireWebpackConfig("webpack_noWebpackTarget.config.js"), projectDir);
        cleanupCompiler = compiler;

        expect(statSync(target).isFile()).toBe(true);
    });

    it("should select the writeFile target w/ webpackTarget set", async () => {
        const target = resolve(projectDir, ".build", "lib", "main.js");

        const { compiler } = await createWebpackCompiler(requireWebpackConfig("webpack_noNoWriteTargetsWithWebpackTarget.config.js"), projectDir);
        cleanupCompiler = compiler;

        expect(statSync(target).isFile()).toBe(true);
    });

    it("should write a warning if no target w/ writeFile false is specified", async () => {
        const target = resolve(projectDir, ".build", "lib", "main.js");

        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { stats, compiler } = await createWebpackCompiler(requireWebpackConfig("webpack_noNoWriteTargets.config.js"), projectDir);
        cleanupCompiler = compiler;

        expect(statSync(target).isFile()).toBe(true);
        expect(stats?.compilation.getWarnings()).toContainEqual(new WebpackError(`No writeFile: false targets found for "*"`));
    });

    it("should use default target w/o configured target and webpackTarget", async () => {
        const target = resolve(projectDir, ".build", "lib", "main.js");

        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { stats, compiler } = await createWebpackCompiler(requireWebpackConfig("webpack_noTargets.config.js"), projectDir);
        cleanupCompiler = compiler;

        expect(statSync(target).isFile()).toBe(true);
        expect(stats?.compilation.getWarnings()).toEqual([]);
    });

    it("should write a warning if more than one target w/ writeFile false is specified", async () => {
        const target = resolve(projectDir, ".build", "lib", "main.js");

        const { stats, compiler } = await createWebpackCompiler(requireWebpackConfig("webpack_multipleNoWriteTargets.config.js"), projectDir);
        cleanupCompiler = compiler;

        expect(statSync(target).isFile()).toBe(true);
        expect(stats?.compilation.getWarnings()).toContainEqual(new WebpackError(`Target "noWrite2" is not used by the WebsmithPlugin.`));
    });

    it("should bundle the file w/ thread-loader being used", async () => {
        const target = resolve(projectDir, ".build", "lib", "main.js");

        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { stats, compiler } = await createWebpackCompiler(requireWebpackConfig("webpack_thread_loader.config.js"), projectDir);
        cleanupCompiler = compiler;

        expect(statSync(target).isFile()).toBe(true);
        expect(stats?.compilation.getWarnings()).toEqual([]);
        const output = readFileSync(target).toString();
        expect(output).toContain('/***/ "./test/__data__/module-date/src/functions/getDate.ts":');
        expect(output).toContain('/***/ "./test/__data__/module-date/src/model/index.ts":');
    });

    it("should bundle the file w/ fork-ts-checker-webpack-plugin being used", async () => {
        const target = resolve(projectDir, ".build", "lib", "main.js");

        const { stats, compiler } = await createWebpackCompiler(requireWebpackConfig("webpack_fork_ts.config.js"), projectDir);
        cleanupCompiler = compiler;

        expect(statSync(target).isFile()).toBe(true);
        expect(stats?.compilation.getWarnings()).toEqual([]);
        const output = readFileSync(target).toString();
        expect(output).toContain('/***/ "./test/__data__/module-date/src/functions/getDate.ts":');
        expect(output).toContain('/***/ "./test/__data__/module-date/src/model/index.ts":');
    });
    
    it("should rebundle the file in watch mode w/ the file content change", async () => {
        const newInput = readFileSync(targetInput).toString();
        const target = resolve(projectDir, ".build", "lib", "main.js");
        let count = 0;
        const callback = () => {
            count++;
        };

        const { compiler } = await createWebpackCompiler(requireWebpackConfig("webpack.config.js", true), projectDir, callback);
        cleanupCompiler = compiler;
        
        let success = await waitFor(() => count > 0, "initial compile");
        expect(success).toBe(true);
        let expected = statSync(target).mtimeMs;

        const count2 = count;
        writeFileSync(targetInput, newInput + "\nexport const addition1 = () => 'addition 1';");

        success = await waitFor(() => count > count2, "first change");
        expect(success).toBe(true);
        expect(statSync(target).mtimeMs).toBeGreaterThan(expected);
        expected = statSync(target).mtimeMs;

        const count3 = count;
        writeFileSync(targetInput, newInput + "\nexport const addition2 = () => 'addition 2';");

        success = await waitFor(() => count > count3, "second change");
        expect(success).toBe(true);
        expect(statSync(target).mtimeMs).toBeGreaterThan(expected);

        compiler.watching.close(() => undefined);
    });
});

const waitFor = (fn: () => boolean, tag: string, maximum = 80) => {
    return new Promise<boolean>((resolve, reject) => {
        let counter = 0;
        const interval = setInterval(() => {
            if (fn()) {
                clearInterval(interval);
                resolve(true);
            }
            if (++counter > maximum) {
                console.error(`waitFor timed out after ${maximum} tries on ${tag} @ ${new Date().toISOString()}`);
                clearInterval(interval);
                reject(false);
            }
        }, 100);
    });
};

const requireWebpackConfig = (configFileName: string, watch = false) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return { ...require(join(projectDir, configFileName))(), ...(!!watch && { watch }) };
};
