/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { lstatSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import { Compiler, WebpackError } from "webpack";
import { createWebpackCompiler } from "./webpack-utils";

const projectDir = resolve(__dirname, "..", "test", "__data__", "module-date");

afterEach(() => {
    rmSync(resolve(projectDir, ".build"), { recursive: true, force: true });
});

describe("webpack loader", () => {
    it("should throw an error if webpackTarget does not exist as target", async () => {
        let webpack: Compiler;

        await createWebpackCompiler(requireWebpackConfig("webpack_unknownWebpackTarget.config.js"), projectDir)
            .then(({ compiler }) => {
                webpack = compiler;
            })
            .catch(({ errors }) => {
                // eslint-disable-next-line jest/no-conditional-expect
                expect(errors).toContain('No target found for "noWrite"');
            })
            .finally(() => webpack && webpack.close(() => undefined));
    });

    it("should bundle using the first target w/ writeFile false w/o webpackTarget set", async () => {
        const target = resolve(projectDir, ".build", "lib", "main.js");

        const { compiler } = await createWebpackCompiler(requireWebpackConfig("webpack_noWebpackTarget.config.js"), projectDir);

        expect(lstatSync(target).isFile()).toBe(true);

        compiler.close(() => undefined);
    });

    it("should select the writeFile target w/ webpackTarget set", async () => {
        const target = resolve(projectDir, ".build", "lib", "main.js");

        const { compiler } = await createWebpackCompiler(requireWebpackConfig("webpack_noNoWriteTargetsWithWebpackTarget.config.js"), projectDir);

        expect(lstatSync(target).isFile()).toBe(true);

        compiler.close(() => undefined);
    });

    it("should write a warning if no target w/ writeFile false is specified", async () => {
        const target = resolve(projectDir, ".build", "lib", "main.js");

        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { stats, compiler } = await createWebpackCompiler(requireWebpackConfig("webpack_noNoWriteTargets.config.js"), projectDir);

        expect(lstatSync(target).isFile()).toBe(true);
        expect(stats?.compilation.getWarnings()).toContainEqual(new WebpackError(`No writeFile: false targets found for "*"`));

        compiler.close(() => undefined);
    });

    it("should use default target w/o configured target and webpackTarget", async () => {
        const target = resolve(projectDir, ".build", "lib", "main.js");

        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { stats, compiler } = await createWebpackCompiler(requireWebpackConfig("webpack_noTargets.config.js"), projectDir);

        expect(lstatSync(target).isFile()).toBe(true);
        expect(stats?.compilation.getWarnings()).toEqual([]);

        compiler.close(() => undefined);
    });

    it("should write a warning if more than one target w/ writeFile false is specified", async () => {
        const target = resolve(projectDir, ".build", "lib", "main.js");

        const { stats, compiler } = await createWebpackCompiler(requireWebpackConfig("webpack_multipleNoWriteTargets.config.js"), projectDir);

        expect(lstatSync(target).isFile()).toBe(true);
        expect(stats?.compilation.getWarnings()).toContainEqual(new WebpackError(`Target "noWrite2" is not used by the WebsmithPlugin.`));

        compiler.close(() => undefined);
    });

    it("should bundle the file w/ thread-loader being used", async () => {
        const target = resolve(projectDir, ".build", "lib", "main.js");

        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { stats, compiler } = await createWebpackCompiler(requireWebpackConfig("webpack_thread_loader.config.js"), projectDir);

        expect(lstatSync(target).isFile()).toBe(true);
        expect(stats?.compilation.getWarnings()).toEqual([]);
        const output = readFileSync(target).toString();
        expect(output).toContain('/***/ "./test/__data__/module-date/src/functions/getDate.ts":');
        expect(output).toContain('/***/ "./test/__data__/module-date/src/model/index.ts":');

        compiler.close(() => undefined);
    });

    it("should bundle the file w/ fork-ts-checker-webpack-plugin being used", async () => {
        const target = resolve(projectDir, ".build", "lib", "main.js");

        const { stats, compiler } = await createWebpackCompiler(requireWebpackConfig("webpack_fork_ts.config.js"), projectDir);

        expect(lstatSync(target).isFile()).toBe(true);
        expect(stats?.compilation.getWarnings()).toEqual([]);
        const output = readFileSync(target).toString();
        expect(output).toContain('/***/ "./test/__data__/module-date/src/functions/getDate.ts":');
        expect(output).toContain('/***/ "./test/__data__/module-date/src/model/index.ts":');

        compiler.close(() => undefined);
    });

    it("should rebundle the file in watch mode w/ the file content change", async () => {
        const target = resolve(projectDir, ".build", "lib", "main.js");

        const { compiler } = await createWebpackCompiler(requireWebpackConfig("webpack.config.js", true), projectDir);

        const expected = lstatSync(resolve(projectDir, ".build", "lib", "main.js")).mtimeMs;
        writeFileSync(target, readFileSync(target).toString());

        expect(lstatSync(resolve(projectDir, ".build", "lib", "main.js")).mtimeMs).toBeGreaterThan(expected);

        compiler.close(() => undefined);
    });
});

const requireWebpackConfig = (configFileName: string, watch = false) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return { ...require(join(projectDir, configFileName))(), ...(!!watch && { watch }) };
};
