import { createFsFromVolume, Volume } from "memfs";
import path from "node:path";
import ts from "typescript";
import { Logger } from "../Logger";
import { webpackDefaults } from "./webpack-options";
import { WebpackBuild } from "./WebpackBuild";

const TEST_TARGETS_DIR = path.join(__dirname, "..", "..", "test", "__test-targets__");

describe("WebpackBuild#getTsLoaderOptions", () => {
    it("should return tsDefaults without TsLoaderOptions", () => {
        const testObj = new WebpackBuild();

        expect(testObj.getTsLoaderOptions()).toBeUndefined();
    });

    it("should return TsLoaderOptions with TsLoaderOptions parameter", () => {
        const testObj = new WebpackBuild().setTsLoaderOptions({ compilerOptions: { target: ts.ScriptTarget.ESNext, version: true } });

        expect(testObj.getTsLoaderOptions()).toEqual({ compilerOptions: { target: ts.ScriptTarget.ESNext, version: true } });
    });
});

describe("WebpackBuild#getConfig", () => {
    it("should return processOptions with processOptions parameter", () => {
        const testObj = new WebpackBuild({ target: "node", mode: "production" });

        expect(testObj.getConfig()).toEqual({ ...webpackDefaults, target: "node", mode: "production" });
    });

    it("should return empty object without processOptions", () => {
        const testObj = new WebpackBuild();

        expect(testObj.getConfig()).toEqual(webpackDefaults);
    });
});

describe("WebpackBuild#build", () => {
    beforeEach(() => {
        jest.spyOn(Logger.prototype, "log").mockImplementation(() => {});
        jest.spyOn(Logger.prototype, "error").mockImplementation(() => {});
    });

    it("should yield success with default config and existing file path", async () => {
        const testObj = new WebpackBuild({
            mode: "development",
            target: "node",
            module: {
                rules: [
                    {
                        test: /\.ts$/,
                        loader: require.resolve("ts-loader"),
                        options: {
                            transpileOnly: true,
                        },
                    },
                ],
            },
        })
            .setTsLoaderOptions({ compilerOptions: { noEmit: true } })
            .setOutputFileSystem(createFsFromVolume(new Volume()));

        const stdout = await testObj.build([path.join(TEST_TARGETS_DIR, "foobar-arrow.ts")]);

        expect(stdout).toContain(""); // success
    });

    it("should yield compile error with unknown file path", async () => {
        const testObj = new WebpackBuild();

        await expect(() => testObj.build(["src/does-not-exist.ts"])).rejects.toThrow(
            "Module not found: Error: Can't resolve 'src/does-not-exist.ts'"
        );
    });
});
