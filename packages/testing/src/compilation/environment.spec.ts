import ts from "typescript";
import { compilationEnv, type CompilationEnv } from "./environment";

describe("compilationEnv", () => {
    let testObj: CompilationEnv;

    afterEach(() => {
        testObj.cleanUp();
    });

    it("should return a new compilation environment with defaults", () => {
        testObj = compilationEnv("expected");

        expect(testObj.getRootDir().endsWith("/expected")).toBe(true);
        expect(testObj.getCompiler()).toBeDefined();
        expect(testObj.getSystem()).toBe(ts.sys);
    });

    it("should return a new compilation environment with default compiler options", () => {
        testObj = compilationEnv("/target");

        const actual = testObj.getCompilerOptions();

        expect(actual).toMatchObject({
            buildDir: "/",
            project: {
                configFilePath: "./tsconfig.json",
                module: ts.ModuleKind.ESNext,
                target: ts.ScriptTarget.ESNext,
            },
            sourceMap: false,
            targets: ["*"],
            transpileOnly: false,
            tsconfig: {
                errors: [],
                options: {},
            },
            watch: false,
        });
    });

    it("should return a new compilation environment with custom compiler options", () => {
        testObj = compilationEnv("/target", { compilerOptions: { buildDir: "/expected-src", project: { outDir: "/expected-out" } } });

        const actual = testObj.getCompilerOptions();

        expect(actual).toMatchObject({
            buildDir: "/expected-src",
            project: {
                configFilePath: "./tsconfig.json",
                module: ts.ModuleKind.ESNext,
                target: ts.ScriptTarget.ESNext,
                outDir: "/expected-out",
            },
        });
    });

    it("should return a new compilation environment with default addons", () => {
        testObj = compilationEnv("/target");

        const actual = testObj.getAddons();

        expect(actual.getAddonDir()).toBe("./addons");
        expect(actual.getAvailableAddons()).toEqual([]);
    });

    it("should return a new compilation environment with valid custom addons", () => {
        testObj = compilationEnv("/target").addAddon("expected-addon", `export const activate = () => {};`);

        const actual = testObj.getAddons().getAvailableAddons();

        expect(testObj.getSystem().readDirectory("/target")).toEqual(["/addons/expected-addon/addon.ts"]);
        expect(actual).toEqual(["expected-addon"]);
    });

    it("should return a new compilation environment with valid custom addonsXXX", () => {
        testObj = compilationEnv("/target").addAddon("expected-addon", `export const activate = () => {};`);

        const actual = testObj.getAddons().getAvailableAddons();

        expect(actual).toEqual(["expected-addon"]);
    });
});
