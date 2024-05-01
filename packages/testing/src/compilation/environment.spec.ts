/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import ts from "typescript";
import { compilationEnv } from "./environment";
import { resolve } from "path";

describe("compilationEnv", () => {
    it("should yield default configuration with defaults", () => {
        const testObj = compilationEnv("/expected");

        expect(testObj.isVirtual()).toBe(true);
        expect(testObj.getRootDir()).toBe("/expected");
        expect(testObj.getAddonsDir()).toBe("/expected/addons");
        expect(testObj.getCompiler()).toBeDefined();
        expect(testObj.getSystem()).toBeDefined();
        expect(testObj.getSystem().useCaseSensitiveFileNames).toBe(false);
    });

    it("should yield configuration with non-virtual system", () => {
        const testObj = compilationEnv("./expected", { virtual: false });

        expect(testObj.isVirtual()).toBe(false);
        expect(testObj.getRootDir()).toBe(resolve("./expected"));
        expect(testObj.getAddonsDir()).toBe(resolve(testObj.getRootDir(), "./addons"));
        expect(testObj.getCompiler()).toBeDefined();
        expect(testObj.getSystem()).toEqual(ts.sys);
        expect(testObj.getSystem().useCaseSensitiveFileNames).toBe(ts.sys.useCaseSensitiveFileNames);

        testObj.cleanUp();
    });

    it("should yield default compiler options with defaults", () => {
        const testObj = compilationEnv("/target");

        const actual = testObj.getCompilerOptions();

        expect(actual).toMatchObject({
            buildDir: "/target/src",
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

    it("should yield custom compiler options with custom overrides", () => {
        const testObj = compilationEnv("/target", { compilerOptions: { buildDir: "./expected-src", project: { outDir: "./expected-out" } } });

        const actual = testObj.getCompilerOptions();

        expect(actual).toMatchObject({
            buildDir: "./expected-src",
            project: {
                configFilePath: "./tsconfig.json",
                module: ts.ModuleKind.ESNext,
                target: ts.ScriptTarget.ESNext,
                outDir: "./expected-out",
            },
        });
    });
});

describe("compilationEnv#addons", () => {
    it("should yields no addons with defaults", () => {
        const testObj = compilationEnv("/target");

        expect(testObj.getAddonsDir()).toBe("/target/addons");
        expect(testObj.getActiveAddons()).toEqual([]);
    });

    it("should yield addon with valid addon source", () => {
        const testObj = compilationEnv("/target").addAddon("expected-addon", { "addon.ts": `export const activate = () => {};` });

        const actual = testObj.getActiveAddons().map(it => it?.name);

        expect(actual).toEqual(["expected-addon"]);
    });

    it("should yield no addons with invalid addon source", () => {
        const testObj = compilationEnv("/target").addAddon("invalid-addon", { "addon.ts": `export const NO_ACTIVATE_FUNCTION = true;` });

        const actual = testObj.getActiveAddons();

        expect(actual).toHaveLength(0);
    });

    it("should yield addon with single addon in default addons path", () => {
        const testObj = compilationEnv("/target");
        testObj.getSystem().writeFile("/addons/expected-addon/addon.ts", `export const activate = () => {};`);

        testObj.addAddon("expected-addon");

        const actual = testObj.getActiveAddons().map(it => it?.name);

        expect(actual).toEqual(["expected-addon"]);
    });

    it("should yield addons with multiple addons in default addons path", () => {
        const testObj = compilationEnv("/target");
        testObj.getSystem().writeFile("/addons/expected-addon1/addon.ts", `export const activate = () => {};`);
        testObj.getSystem().writeFile("/addons/expected-addon2/addon.ts", `export const activate = () => {};`);

        testObj.addAddons(["expected-addon1", "expected-addon2"]);

        const actual = testObj.getActiveAddons().map(it => it?.name);

        expect(actual).toEqual(["expected-addon1", "expected-addon2"]);
    });

    it("should yield addons with multiple addons in custom addons path", () => {
        const testObj = compilationEnv("/target");
        testObj.getSystem().writeFile("/target/custom-addons-folder/expected-addon1/addon.ts", `export const activate = () => {};`);
        testObj.getSystem().writeFile("/target/custom-addons-folder/expected-addon2/addon.ts", `export const activate = () => {};`);

        testObj.addAddons(["expected-addon1", "expected-addon2"], "./custom-addons-folder/");

        const actual = testObj.getActiveAddons().map(it => it?.name);

        expect(actual).toEqual(["expected-addon1", "expected-addon2"]);
    });
});

describe("compilationEnv#projects", () => {
    it("should yield empty project with non-existing path", () => {
        const testObj = compilationEnv("/target").setupProjectFromDisk("/does-not-exist");

        const actual = testObj.getProjectFiles();

        expect(actual).toEqual([]);
    });

    it("should yield project with project source and file names", () => {
        const testObj = compilationEnv("/target").setupProjectFromSource({
            "index.ts": `export * from "./target";`,
            "target.ts": `export class Target {}`,
        });

        const actual = testObj.getProjectFiles();

        expect(actual.map(it => it.getPath())).toEqual(["/target/src/index.ts", "/target/src/target.ts"]);
        expect(actual.map(it => it.getContent())).toEqual([`export * from "./target";`, `export class Target {}`]);
    });

    it("should yield project with project source and relative paths", () => {
        const testObj = compilationEnv("/target").setupProjectFromSource({
            "./expected/index.ts": `export * from "./target";`,
            "./expected/target.ts": `export class Target {}`,
        });

        const actual = testObj.getProjectFiles();

        expect(actual.map(it => it.getPath())).toEqual(["/target/src/expected/index.ts", "/target/src/expected/target.ts"]);
    });

    it("should yield project with project source and relative src paths", () => {
        const testObj = compilationEnv("/target").setupProjectFromSource({
            "./src/index.ts": `export * from "./target";`,
            "./src/target.ts": `export class Target {}`,
        });

        const actual = testObj.getProjectFiles();

        expect(actual.map(it => it.getPath())).toEqual(["/target/src/index.ts", "/target/src/target.ts"]);
    });

    it("should yield project with project source and absolute paths", () => {
        const testObj = compilationEnv("/target").setupProjectFromSource({
            "/target/src/index.ts": `export * from "./target";`,
            "/target/src/target.ts": `export class Target {}`,
        });

        const actual = testObj.getProjectFiles();

        expect(actual.map(it => it.getPath())).toEqual(["/target/src/index.ts", "/target/src/target.ts"]);
    });

    it("should yield empty project with invalid absolute paths", () => {
        const testObj = compilationEnv("/target").setupProjectFromSource({
            // buildDir is missing in absolute paths
            "/whatever-path/index.ts": `export * from "./target";`,
            "/whatever-path/target.ts": `export class Target {}`,
        });

        const actual = testObj.getProjectFiles();

        expect(actual).toEqual([]);
        expect(testObj.getSystem().readFile("/whatever-path/index.ts")).toBe(`export * from "./target";`);
        expect(testObj.getSystem().readFile("/whatever-path/target.ts")).toBe(`export class Target {}`);
    });

    it("should yield project with single project in default projects path", () => {
        const testObj = compilationEnv("/target");
        testObj.getSystem().writeFile("/test-projects/expected-project/src/index.ts", `export * from "./target";`);
        testObj.getSystem().writeFile("/test-projects/expected-project/src/target.ts", `export class Target {}`);
        testObj.getSystem().writeFile("/test-projects/expected-project/tsconfig.json", `{}`);

        testObj.setupProjectFromDisk("expected-project");

        const actual = testObj.getProjectFiles();

        expect(actual.map(it => it.getPath())).toEqual(["/target/src/index.ts", "/target/src/target.ts", "/target/tsconfig.json"]);
    });

    it("should yield projects with multiple projects in default projects path", () => {
        const testObj = compilationEnv("/target");
        testObj.getSystem().writeFile("/test-projects/expected-project1/src/index.ts", `export * from "./one";`);
        testObj.getSystem().writeFile("/test-projects/expected-project1/src/one.ts", `export class One {}`);
        testObj.getSystem().writeFile("/test-projects/expected-project2/src/index.ts", `export * from "./two";`);
        testObj.getSystem().writeFile("/test-projects/expected-project2/src/two.ts", `export class Two {}`);

        testObj.setupProjectFromDisk("expected-project1").setupProjectFromDisk("expected-project2");

        const actual = testObj.getProjectFiles();

        expect(actual.map(it => it.getPath())).toEqual(["/target/src/index.ts", "/target/src/one.ts", "/target/src/two.ts"]);
        expect(actual.map(it => it.getContent())).toEqual([`export * from "./two";`, `export class One {}`, `export class Two {}`]);
    });

    it("should yield project with single project in custom projects path", () => {
        const testObj = compilationEnv("/target");
        testObj.getSystem().writeFile("/custom-projects/expected-project/src/index.ts", `export * from "./target";`);
        testObj.getSystem().writeFile("/custom-projects/expected-project/src/target.ts", `export class Target {}`);
        testObj.getSystem().writeFile("/custom-projects/expected-project/tsconfig.json", `{}`);

        testObj.setupProjectFromDisk("expected-project", "../custom-projects/");

        const actual = testObj.getProjectFiles();

        expect(actual.map(it => it.getPath())).toEqual(["/target/src/index.ts", "/target/src/target.ts", "/target/tsconfig.json"]);
    });

    it("should yield project and add file with file name", () => {
        const testObj = compilationEnv("/target")
            .setupProjectFromDisk("expected-project")
            .addProjectFile("index.ts", `export * from "./target";`)
            .addProjectFile("target.ts", `export class Target {}`);

        const actual = testObj.getProjectFiles();

        expect(actual.map(it => it.getPath())).toEqual(["/target/src/index.ts", "/target/src/target.ts"]);
        expect(actual.map(it => it.getContent())).toEqual([`export * from "./target";`, `export class Target {}`]);
    });

    it("should yield project and add files with relative paths", () => {
        const testObj = compilationEnv("/target")
            .setupProjectFromDisk("expected-project")
            .addProjectFile("./expected-dir/index.ts", `export * from "./target";`)
            .addProjectFile("./expected-dir/target.ts", `export class Target {}`);

        const actual = testObj.getProjectFiles();

        expect(actual.map(it => it.getPath())).toEqual(["/target/src/expected-dir/index.ts", "/target/src/expected-dir/target.ts"]);
    });

    it("should yield project and add files with relative src paths", () => {
        const testObj = compilationEnv("/target")
            .setupProjectFromDisk("expected-project")
            .addProjectFile("./src/index.ts", `export * from "./target";`)
            .addProjectFile("./src/target.ts", `export class Target {}`);

        const actual = testObj.getProjectFiles();

        expect(actual.map(it => it.getPath())).toEqual(["/target/src/index.ts", "/target/src/target.ts"]);
    });

    it("should yield project and add files with absolute paths", () => {
        const testObj = compilationEnv("/target")
            .setupProjectFromDisk("expected-project")
            .addProjectFile("/target/expected-project/index.ts", `export * from "./target";`)
            .addProjectFile("/target/expected-project/target.ts", `export class Target {}`);

        const actual = testObj.getProjectFiles();

        expect(actual.map(it => it.getPath())).toEqual(["/target/expected-project/index.ts", "/target/expected-project/target.ts"]);
    });

    it("should yield empty project with invalid absolute paths added", () => {
        const testObj = compilationEnv("/target")
            .setupProjectFromDisk("expected-project")
            .addProjectFile("/expected-project/index.ts", `export * from "./target";`)
            .addProjectFile("/expected-project/target.ts", `export class Target {}`);

        const actual = testObj.getProjectFiles();

        expect(actual).toEqual([]);
        expect(testObj.getSystem().readDirectory("/")).toEqual(["/expected-project/index.ts", "/expected-project/target.ts"]);
    });
});
