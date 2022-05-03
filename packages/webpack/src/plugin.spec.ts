import { lstatSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import { Compiler, WebpackError } from "webpack";
import { createWebpackCompiler } from "../test/webpack-utils";

const projectDir = resolve(__dirname, "..", "test", "__data__", "module-date");

afterEach(() => {
    rmSync(resolve(projectDir, ".build"), { recursive: true, force: true });
});

describe("WebsmithPlugin", () => {
    it("should throw an error if webpackTarget does not exist as target", async () => {
        let webpack: Compiler;
        await createWebpackCompiler({ ...require(join(projectDir, "webpack_unknownWebpackTarget.config.ts")) }, projectDir)
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

        const { compiler } = await createWebpackCompiler({ ...require(join(projectDir, "webpack_noWebpackTarget.config.ts")) }, projectDir);

        expect(lstatSync(target).isFile()).toBe(true);

        compiler.close(() => undefined);
    });

    it("should select the writeFile target w/ webpackTarget set", async () => {
        const target = resolve(projectDir, ".build", "lib", "main.js");

        const { compiler } = await createWebpackCompiler(
            { ...require(join(projectDir, "webpack_noNoWriteTargetsWithWebpackTarget.config.ts")) },
            projectDir
        );

        expect(lstatSync(target).isFile()).toBe(true);

        compiler.close(() => undefined);
    });

    it("should write a warning if no target w/ writeFile false is specified", async () => {
        const target = resolve(projectDir, ".build", "lib", "main.js");

        const { stats, compiler } = await createWebpackCompiler({ ...require(join(projectDir, "webpack_noNoWriteTargets.config.ts")) }, projectDir);

        expect(lstatSync(target).isFile()).toBe(true);
        expect(stats?.compilation.getWarnings()).toContainEqual(new WebpackError(`No writeFile: false targets found for "*"`));

        compiler.close(() => undefined);
    });

    it("should use default target w/o configured target and webpackTarget", async () => {
        const target = resolve(projectDir, ".build", "lib", "main.js");

        const { stats, compiler } = await createWebpackCompiler({ ...require(join(projectDir, "webpack_noTargets.config.ts")) }, projectDir);

        expect(lstatSync(target).isFile()).toBe(true);
        expect(stats?.compilation.getWarnings()).toEqual([]);

        compiler.close(() => undefined);
    });

    it("should write a warning if more than one target w/ writeFile false is specified", async () => {
        const target = resolve(projectDir, ".build", "lib", "main.js");

        const { stats, compiler } = await createWebpackCompiler(
            { ...require(join(projectDir, "webpack_multipleNoWriteTargets.config.ts")) },
            projectDir
        );

        expect(lstatSync(target).isFile()).toBe(true);
        expect(stats?.compilation.getWarnings()).toContainEqual(new WebpackError(`Target "noWrite2" is not used by the WebsmithPlugin.`));

        compiler.close(() => undefined);
    });

    it("should rebundle the file in watch mode w/ the file content change", async () => {
        const target = resolve(projectDir, ".build", "lib", "main.js");

        const { compiler } = await createWebpackCompiler({ ...require(join(projectDir, "webpack.config.ts")), watch: true }, projectDir);

        const expected = lstatSync(resolve(projectDir, ".build", "lib", "main.js")).mtimeMs;
        writeFileSync(target, readFileSync(target).toString());

        expect(lstatSync(resolve(projectDir, ".build", "lib", "main.js")).mtimeMs).toBeGreaterThan(expected);

        compiler.close(() => undefined);
    });
});
