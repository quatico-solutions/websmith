/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import path from "node:path";
import ts from "typescript";
import { compilationEnv } from "./environment";

beforeEach(() => {
    jest.spyOn(process.stderr, "write").mockImplementation(() => true); // Suppress console.warn
    jest.spyOn(process.stdout, "write").mockImplementation(() => true); // Suppress console.log
});

describe("compilationEnv", () => {
    it("should yield default configuration with defaults", () => {
        const testObj = compilationEnv("/expected");

        expect(testObj.isVirtual()).toBe(true);
        expect(testObj.getRootDir()).toBe("/expected");
        expect(testObj.getAddonsDir()).toBe("/expected/addons");
        expect(testObj.getSourceDir()).toBe("/expected/src");
        expect(testObj.getOutputDir()).toBe("/expected/dist");
        expect(testObj.getSystem()).toBeDefined();
        expect(testObj.getSystem().useCaseSensitiveFileNames).toBe(false);
    });

    it("should yield configuration with non-virtual system", () => {
        const testObj = compilationEnv("./expected", { virtual: false });

        expect(testObj.isVirtual()).toBe(false);
        expect(testObj.getRootDir()).toBe(path.resolve("./expected"));
        expect(testObj.getAddonsDir()).toBe(path.resolve("./expected/addons"));
        expect(testObj.getOutputDir()).toBe(path.resolve("./expected/dist"));
        expect(testObj.getSourceDir()).toBe(path.resolve("./expected/src"));
        expect(testObj.getSystem()).toEqual(ts.sys);
        expect(testObj.getSystem().useCaseSensitiveFileNames).toBe(ts.sys.useCaseSensitiveFileNames);

        testObj.cleanUp();
    });

    it("should yield default compiler options with defaults", () => {
        const testObj = compilationEnv("/target").addProjectFromSource({
            "index.ts": `export class Target {}`,
        });

        const actual = testObj.getCompilerOptions();

        expect(actual).toMatchObject({
            buildDir: "/target",
            tsConfig: {
                configFilePath: "/target/tsconfig.json",
                target: ts.ScriptTarget.ESNext,
            },
            cliArgs: {
                options: {},
            },
            watch: false,
        });
    });

    it("should yield custom compiler options with custom overrides", () => {
        const testObj = compilationEnv("/target", { tsConfig: { outDir: "./expected-out" } });

        const actual = testObj.getCompilerOptions();

        expect(actual).toMatchObject({
            buildDir: "/target",
            tsConfig: {
                configFilePath: "/target/tsconfig.json",
                target: ts.ScriptTarget.ESNext,
                outDir: "/target/expected-out",
            },
        });
    });
});

describe("compilationEnv#addons", () => {
    it("should yields no addons with defaults", () => {
        const testObj = compilationEnv("/target");

        expect(testObj.getAddonsDir()).toBe("/target/addons");
        expect(testObj.getActiveAddons()).toHaveLength(0);
    });

    it("should yield addon with valid addon source", () => {
        const testObj = compilationEnv("/target").addAddon("expected-addon", { "addon.ts": `export const activate = () => {};` });

        const actual = testObj.getActiveAddons().getNames();

        expect(actual).toEqual(["expected-addon"]);
    });

    it("should log warning with invalid addon source", () => {
        jest.spyOn(console, "error").mockImplementation(() => {});
        const testObj = compilationEnv("/target");

        // Should not throw an exception but instead log a warning
        expect(() => testObj.addAddon("invalid-addon", { "addon.ts": `export const NO_ACTIVATE_FUNCTION = true;` })).not.toThrow();

        // Should have no available addons since the invalid addon is ignored
        expect(testObj.getActiveAddons()).toHaveLength(0);
    });

    it("should yield addon with single addon in default addons path", () => {
        const testObj = compilationEnv("/target");
        testObj.getSystem().writeFile("/addons/expected-addon/addon.ts", `export const activate = () => {};`);

        testObj.addAddon("expected-addon");

        const actual = testObj.getActiveAddons().getNames();

        expect(actual).toEqual(["expected-addon"]);
    });

    it("should yield addons with multiple addons in default addons path", () => {
        const testObj = compilationEnv("/target");
        testObj.getSystem().writeFile("/addons/expected-addon1/addon.ts", `export const activate = () => {};`);
        testObj.getSystem().writeFile("/addons/expected-addon2/addon.ts", `export const activate = () => {};`);

        testObj.addAddons(["expected-addon1", "expected-addon2"]);

        const actual = testObj.getActiveAddons().getNames();

        expect(actual).toEqual(["expected-addon1", "expected-addon2"]);
    });

    it("should yield addons with multiple addons in custom addons path", () => {
        const testObj = compilationEnv("/target", {}, { addonsDir: "./custom-addons-folder/" });
        testObj.getSystem().writeFile("/target/custom-addons-folder/expected-addon1/addon.ts", `export const activate = () => {};`);
        testObj.getSystem().writeFile("/target/custom-addons-folder/expected-addon2/addon.ts", `export const activate = () => {};`);

        testObj.addAddons(["expected-addon1", "expected-addon2"], "./custom-addons-folder/");

        const actual = testObj.getActiveAddons().getNames();

        expect(actual).toEqual(["expected-addon1", "expected-addon2"]);
    });
});

describe("compilationEnv#projects", () => {
    it("should yield empty project with non-existing path", () => {
        const testObj = compilationEnv("/target").addProjectFromDisk("whatever", "/does-not-exist");

        const actual = testObj.getProjectFiles();

        expect(actual.getPaths()).toEqual(["/target/tsconfig.json"]);
        expect(actual).toHaveLength(1);
    });

    it("should yield project with project source and file names", () => {
        const testObj = compilationEnv("/target").addProjectFromSource({
            "index.ts": `export * from "./target";`,
            "target.ts": `export class Target {}`,
        });

        const actual = testObj.getProjectFiles();

        expect(actual.getPaths()).toEqual(["/target/tsconfig.json", "/target/src/index.ts", "/target/src/target.ts"]);
        expect(actual.getContents()).toEqual([
            '{"compilerOptions":{"outDir":"/target/dist","target":"ESNext","module":"ESNext","esModuleInterop":true},"include":["/target/src/**/*.ts","/target/src/**/*.tsx"],"exclude":["node_modules","/target/dist"]}',
            `export * from "./target";`,
            `export class Target {}`,
        ]);
    });

    it("should yield project with project source and relative paths", () => {
        const testObj = compilationEnv("/target").addProjectFromSource({
            "./expected/index.ts": `export * from "./target";`,
            "./expected/target.ts": `export class Target {}`,
        });

        const actual = testObj.getProjectFiles();

        expect(actual.getPaths()).toEqual(["/target/tsconfig.json", "/target/src/expected/index.ts", "/target/src/expected/target.ts"]);
    });

    it("should yield project with project source and relative src paths", () => {
        const testObj = compilationEnv("/target").addProjectFromSource({
            "./src/index.ts": `export * from "./target";`,
            "./src/target.ts": `export class Target {}`,
        });

        const actual = testObj.getProjectFiles();

        expect(actual.getPaths()).toEqual(["/target/tsconfig.json", "/target/src/index.ts", "/target/src/target.ts"]);
    });

    it("should yield project with project source and absolute paths", () => {
        const testObj = compilationEnv("/target").addProjectFromSource({
            "/target/src/index.ts": `export * from "./target";`,
            "/target/src/target.ts": `export class Target {}`,
        });

        const actual = testObj.getProjectFiles();

        expect(actual.getPaths()).toEqual(["/target/tsconfig.json", "/target/src/index.ts", "/target/src/target.ts"]);
    });

    it("should yield empty project with invalid absolute paths", () => {
        const testObj = compilationEnv("/target").addProjectFromSource({
            "/whatever-path/index.ts": `export * from "./target";`,
            "/whatever-path/target.ts": `export class Target {}`,
        });

        const actual = testObj.getProjectFiles();

        expect(actual.getPaths()).toEqual(["/target/tsconfig.json"]);
        expect(actual).toHaveLength(1);
        expect(testObj.getSystem().readFile("/whatever-path/index.ts")).toBe(`export * from "./target";`);
        expect(testObj.getSystem().readFile("/whatever-path/target.ts")).toBe(`export class Target {}`);
    });

    it("should yield project with single project in default projects path", () => {
        const testObj = compilationEnv("/target");
        testObj.getSystem().writeFile("/test-projects/expected-project/src/index.ts", `export * from "./target";`);
        testObj.getSystem().writeFile("/test-projects/expected-project/src/target.ts", `export class Target {}`);
        testObj.getSystem().writeFile("/test-projects/expected-project/tsconfig.json", `{}`);

        testObj.addProjectFromDisk("expected-project");

        const actual = testObj.getProjectFiles();

        expect(actual.getPaths()).toEqual(["/target/tsconfig.json", "/target/src/index.ts", "/target/src/target.ts"]);
    });

    it("should yield projects with multiple projects in default projects path", () => {
        const testObj = compilationEnv("/target");
        testObj.getSystem().writeFile("/test-projects/expected-project1/src/index.ts", `export * from "./one";`);
        testObj.getSystem().writeFile("/test-projects/expected-project1/src/one.ts", `export class One {}`);
        testObj.getSystem().writeFile("/test-projects/expected-project2/src/index.ts", `export * from "./two";`);
        testObj.getSystem().writeFile("/test-projects/expected-project2/src/two.ts", `export class Two {}`);

        testObj.addProjectFromDisk("expected-project1").addProjectFromDisk("expected-project2");

        const actual = testObj.getProjectFiles();

        expect(actual.getPaths()).toEqual(["/target/tsconfig.json", "/target/src/index.ts", "/target/src/one.ts", "/target/src/two.ts"]);
        expect(actual.getContents()).toEqual([
            '{"compilerOptions":{"outDir":"/target/dist","target":"ESNext","module":"ESNext","esModuleInterop":true},"include":["/target/src/**/*.ts","/target/src/**/*.tsx"],"exclude":["node_modules","/target/dist"]}',
            `export * from "./two";`,
            `export class One {}`,
            `export class Two {}`,
        ]);
    });

    it("should yield project with single project in custom projects path", () => {
        const testObj = compilationEnv("/target");
        testObj.getSystem().writeFile("/custom-projects/expected-project/src/index.ts", `export * from "./target";`);
        testObj.getSystem().writeFile("/custom-projects/expected-project/src/target.ts", `export class Target {}`);
        testObj.getSystem().writeFile("/custom-projects/expected-project/tsconfig.json", `{}`);

        testObj.addProjectFromDisk("expected-project", "../custom-projects/");

        const actual = testObj.getProjectFiles().getPaths();

        expect(actual).toEqual(["/target/tsconfig.json", "/target/src/index.ts", "/target/src/target.ts"]);
    });

    it("should yield project and add files with file name", () => {
        const testObj = compilationEnv("/target")
            .addSourceFile("index.ts", `export * from "./target";`)
            .addSourceFile("target.ts", `export class Target {}`);

        const actual = testObj.getProjectFiles();

        expect(actual.getPaths()).toEqual(["/target/tsconfig.json", "/target/src/index.ts", "/target/src/target.ts"]);
        expect(actual.getContents()).toEqual([
            '{"compilerOptions":{"outDir":"/target/dist","target":"ESNext","module":"ESNext","esModuleInterop":true},"include":["/target/src/**/*.ts","/target/src/**/*.tsx"],"exclude":["node_modules","/target/dist"]}',
            `export * from "./target";`,
            `export class Target {}`,
        ]);
    });

    it("should yield project and add files with relative paths", () => {
        const testObj = compilationEnv("/target")
            .addSourceFile("./expected-dir/index.ts", `export * from "./target";`)
            .addSourceFile("./expected-dir/target.ts", `export class Target {}`);

        const actual = testObj.getProjectFiles();

        expect(actual.getPaths()).toEqual(["/target/tsconfig.json", "/target/src/expected-dir/index.ts", "/target/src/expected-dir/target.ts"]);
    });

    it("should yield project and add files with relative src paths", () => {
        const testObj = compilationEnv("/target")
            .addSourceFile("./src/index.ts", `export * from "./target";`)
            .addSourceFile("./src/target.ts", `export class Target {}`);

        const actual = testObj.getProjectFiles();

        expect(actual.getPaths()).toEqual(["/target/tsconfig.json", "/target/src/index.ts", "/target/src/target.ts"]);
    });

    it("should yield project and add files with absolute paths", () => {
        const testObj = compilationEnv("/target")
            .addSourceFile("/target/expected-project/index.ts", `export * from "./target";`)
            .addSourceFile("/target/expected-project/target.ts", `export class Target {}`);

        const actual = testObj.getProjectFiles();

        expect(actual.getPaths()).toEqual(["/target/tsconfig.json", "/target/expected-project/index.ts", "/target/expected-project/target.ts"]);
    });

    it("should yield empty project with invalid absolute paths added", () => {
        const testObj = compilationEnv("/target")
            .addSourceFile("/expected-project/index.ts", `export * from "./target";`)
            .addSourceFile("/expected-project/target.ts", `export class Target {}`);

        const actual = testObj.getProjectFiles();

        expect(actual.getPaths()).toEqual(["/target/tsconfig.json"]);
        expect(actual).toHaveLength(1);
        expect(testObj.getSystem().readDirectory("/")).toEqual([
            "/target/tsconfig.json",
            "/expected-project/index.ts",
            "/expected-project/target.ts",
        ]);
    });
});

describe("compilationEnv#compiled", () => {
    it("should yield no compiled files with empty project", () => {
        const testObj = compilationEnv("/target");

        const actual = testObj.getCompiledFiles();

        expect(actual).toHaveLength(0);
    });

    it("should yield no compiled files with existing project but no compile", () => {
        const testObj = compilationEnv("/target").addProjectFromSource({
            "index.ts": `export * from './target';`,
            "target.ts": `export class Target {}`,
        });

        const actual = testObj.getCompiledFiles();

        expect(actual).toHaveLength(0);
    });

    it("should yield no compiled files and empty result with empty project and compile", () => {
        const testObj = compilationEnv("/target").compile();

        expect(testObj.getCompiledFiles()).toHaveLength(0);
        expect(testObj.hasEmitSkipped()).toBe(false);
        expect(testObj.getEmittedFiles()).toEqual([]);
        expect(testObj.getDiagnostics()).toEqual([]);
    });

    it("should yield compiled files with existing project and compile", () => {
        const testObj = compilationEnv("/target")
            .addProjectFromSource({
                "index.ts": `export * from './target';`,
                "target.ts": `export class Target {}`,
            })
            .compile();

        expect(testObj.getCompiledFiles().getPaths()).toEqual([
            "/target/dist/index.js",
            "/target/dist/index.d.ts",
            "/target/dist/target.js",
            "/target/dist/target.d.ts",
        ]);
        expect(testObj.hasEmitSkipped()).toBe(false);
        expect(testObj.getEmittedFiles()).toEqual([
            "/target/dist/index.js",
            "/target/dist/index.d.ts",
            "/target/dist/target.js",
            "/target/dist/target.d.ts",
        ]);
        expect(testObj.getDiagnostics()).toEqual([]);
    });

    it("should yield compiled contents with existing project and compile", () => {
        const testObj = compilationEnv("/target")
            .addProjectFromSource({
                "index.ts": `export * from './target';`,
                "target.ts": `export class Target {}`,
            })
            .compile();

        expect(testObj.getCompiledFile("/target/dist/index.js")!.getContent()).toBe(`export * from './target';\n`);
        expect(testObj.getCompiledFile("/target/dist/target.js")!.getContent()).toBe(`export class Target {\n}\n`);
    });

    it("should yield compiled files with late project setup and compile", () => {
        const testObj = compilationEnv("/target")
            .addProjectFromSource({
                "index.ts": `export * from './target';`,
                "target.ts": `export class Target {}`,
            })
            .compile();

        const actual = testObj.getCompiledFiles();

        expect(actual.getPaths()).toEqual(["/target/dist/index.js", "/target/dist/index.d.ts", "/target/dist/target.js", "/target/dist/target.d.ts"]);
    });

    it("should yield compiled files with project", () => {
        const testObj = compilationEnv("/target")
            .addProjectFromSource({
                "index.ts": `export * from './target';`,
                "target.ts": `export class Target {}`,
            })
            .compile();

        expect(testObj.getCompiledFile("/target/dist/index.js")!.getContent()).toBe(`export * from './target';\n`);
        expect(testObj.getCompiledFile("/target/dist/target.js")!.getContent()).toBe(`export class Target {\n}\n`);
    });

    it("should yield compilation errors with illegal project files", () => {
        jest.spyOn(console, "error").mockImplementation(() => {});

        const testObj = compilationEnv("/target", {
            tsConfig: { noEmitOnError: true },
        })
            .addProjectFromSource({
                "index.ts": `export * from './target';`,
                "target.ts": `export ILLEGAL Target {};`,
            })
            .compile();

        expect(testObj.getFailureReport("target.ts")).toMatchInlineSnapshot(`
            "src/target.ts(1,1): error TS1128: Declaration or statement expected.
            src/target.ts(1,8): error TS1434: Unexpected keyword or identifier.
            src/target.ts(1,16): error TS1434: Unexpected keyword or identifier.
            src/target.ts(1,8): error TS2304: Cannot find name 'ILLEGAL'.
            src/target.ts(1,16): error TS2304: Cannot find name 'Target'."
        `);
        expect(testObj.getEmittedFiles()).toEqual([]);
    });
});
