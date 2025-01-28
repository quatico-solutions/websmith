import path from "path";
import ts from "typescript";
import { tsDefaults } from "../compiler-options";
import { Logger } from "../Logger";
import { Compiler } from "./Compiler";

const TEST_TARGETS_DIR = path.join(__dirname, "..", "..", "test", "__test-targets__");

describe("Compiler#getTsOptions", () => {
    it("should return tsDefaults without tsOptions", () => {
        const testObj = new Compiler();

        expect(testObj.getTsOptions()).toEqual(tsDefaults);
    });

    it("should return tsOptions with tsOptions parameter", () => {
        const testObj = new Compiler({ target: ts.ScriptTarget.ESNext });

        expect(testObj.getTsOptions()).toEqual({ target: ts.ScriptTarget.ESNext });
    });
});

describe("Compiler#compile", () => {
    beforeEach(() => {
        jest.spyOn(Logger.prototype, "log").mockImplementation(() => {});
        jest.spyOn(Logger.prototype, "error").mockImplementation(() => {});
    });

    it("should yield success with default config and existing file path", async () => {
        const testObj = new Compiler({
            noEmit: true,
        });

        const stdout = await testObj.compile([path.join(TEST_TARGETS_DIR, "foobar-arrow.ts")]);

        expect(stdout).toContain(""); // success
    });

    it("should yield help with help flag", async () => {
        const testObj = new Compiler({
            help: true,
        });

        const stdout = await testObj.compile();

        expect(stdout).toContain("tsc: The TypeScript Compiler - Version 5.7.3");
    });

    it("should yield compile error with unknown file path", async () => {
        const testObj = new Compiler({});

        await expect(() => testObj.compile(["src/does-not-exist.ts"])).rejects.toThrow("error TS6053: File 'src/does-not-exist.ts' not found.");
    });
});
