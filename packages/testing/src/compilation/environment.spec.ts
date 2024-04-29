/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import ts from "typescript";
import { compilationEnv, type CompilationEnv } from "./environment";

let testObj: CompilationEnv;

describe("compilationEnv", () => {
    afterEach(() => {
        testObj.cleanUp();
    });

    it("should yield default configuration with defaults", () => {
        testObj = compilationEnv("expected");

        expect(testObj.getRootDir().endsWith("/expected")).toBe(true);
        expect(testObj.getCompiler()).toBeDefined();
        expect(testObj.isVirtual()).toBe(true);
        expect(testObj.getSystem()).toBeDefined();
        expect(testObj.getSystem().useCaseSensitiveFileNames).toBe(false);
    });

    it("should yield default compiler options with defaults", () => {
        testObj = compilationEnv("/target");

        const actual = testObj.getCompilerOptions();

        expect(actual).toMatchObject({
            buildDir: "/target",
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
});

describe("compilationEnv#addons", () => {
    afterEach(() => {
        testObj.cleanUp();
    });

    it("should yields no addons with defaults", () => {
        testObj = compilationEnv("/target");

        const actual = testObj.getAddons();

        expect(actual.getAddonDir()).toBe("/target/addons");
        expect(actual.getAvailableAddons()).toEqual([]);
    });

    it("should yield addon with valid addon source", () => {
        testObj = compilationEnv("/target").addAddon("expected-addon", `export const activate = () => {};`);

        const actual = testObj
            .getAddons()
            .getAvailableAddons()
            .map(it => it?.name);

        expect(actual).toEqual(["expected-addon"]);
    });

    it("should yield no addons with invalid addon source", () => {
        testObj = compilationEnv("/target").addAddon("invalid-addon", `export const NO_ACTIVATE_FUNCTION = true;`);

        const actual = testObj.getAddons().getAvailableAddons();

        expect(actual).toHaveLength(0);
    });

    it("should yield addon with single addon in default addons path", () => {
        testObj = compilationEnv("/target");
        testObj.getSystem().writeFile("/test-data/addons/expected-addon/addon.ts", `export const activate = () => {};`);

        testObj.addAddons(["expected-addon"]);

        const actual = testObj
            .getAddons()
            .getAvailableAddons()
            .map(it => it?.name);

        expect(actual).toEqual(["expected-addon"]);
    });

    it("should yield addons with multiple addons in default addons path", () => {
        testObj = compilationEnv("/target");
        testObj.getSystem().writeFile("/test-data/addons/expected-addon1/addon.ts", `export const activate = () => {};`);
        testObj.getSystem().writeFile("/test-data/addons/expected-addon2/addon.ts", `export const activate = () => {};`);

        testObj.addAddons(["expected-addon1", "expected-addon2"]);

        const actual = testObj
            .getAddons()
            .getAvailableAddons()
            .map(it => it?.name);

        expect(actual).toEqual(["expected-addon1", "expected-addon2"]);
    });

    it("should yield addons with multiple addons in custom addons path", () => {
        testObj = compilationEnv("/target");
        testObj.getSystem().writeFile("/target/custom-addons-folder/expected-addon1/addon.ts", `export const activate = () => {};`);
        testObj.getSystem().writeFile("/target/custom-addons-folder/expected-addon2/addon.ts", `export const activate = () => {};`);

        testObj.addAddons(["expected-addon1", "expected-addon2"], "./custom-addons-folder/");

        const actual = testObj
            .getAddons()
            .getAvailableAddons()
            .map(it => it?.name);

        expect(actual).toEqual(["expected-addon1", "expected-addon2"]);
    });
});

describe("compilationEnv#projects", () => {
    afterEach(() => {
        testObj.cleanUp();
    });

    it("should yield empty project with defaults", () => {
        testObj = compilationEnv("/target").addProject("expected-project");

        const actual = testObj.getProjects();

        expect(actual).toHaveLength(1);
        expect(actual[0].getPath()).toBe("/target/expected-project");
        expect(actual[0].getFiles()).toHaveLength(0);
    });

    it("should yield project with project files and file names", () => {
        testObj = compilationEnv("/target");
        testObj.addProject("expected-project", { "index.ts": `export * from "./target";`, "target.ts": `export class Target {}` });

        const actual = testObj.getProjects();

        expect(actual).toHaveLength(1);
        expect(actual[0].getPath()).toBe("/target/expected-project");
        expect(actual[0].getFiles()).toEqual(["/target/expected-project/index.ts", "/target/expected-project/target.ts"]);
    });

    it("should yield project with project files and relative paths", () => {
        testObj = compilationEnv("/target");
        testObj.addProject("expected-project", {
            "./foo-bar/index.ts": `export * from "./target";`,
            "./foo-bar/target.ts": `export class Target {}`,
        });

        const actual = testObj.getProjects();

        expect(actual).toHaveLength(1);
        expect(actual[0].getPath()).toBe("/target/expected-project");
        expect(actual[0].getFiles()).toEqual(["/target/expected-project/foo-bar/index.ts", "/target/expected-project/foo-bar/target.ts"]);
    });

    it("should yield project with project files and relative project paths", () => {
        testObj = compilationEnv("/target");
        testObj.addProject("expected-project", {
            "./expected-project/index.ts": `export * from "./target";`,
            "./expected-project/target.ts": `export class Target {}`,
        });

        const actual = testObj.getProjects();

        expect(actual).toHaveLength(1);
        expect(actual[0].getPath()).toBe("/target/expected-project");
        expect(actual[0].getFiles()).toEqual(["/target/expected-project/index.ts", "/target/expected-project/target.ts"]);
    });

    it("should yield project with project files and absolute paths", () => {
        testObj = compilationEnv("/target");
        testObj.addProject("expected-project", {
            "/target/expected-project/index.ts": `export * from "./target";`,
            "/target/expected-project/target.ts": `export class Target {}`,
        });

        const actual = testObj.getProjects();

        expect(actual).toHaveLength(1);
        expect(actual[0].getPath()).toBe("/target/expected-project");
        expect(actual[0].getFiles()).toEqual(["/target/expected-project/index.ts", "/target/expected-project/target.ts"]);
    });

    it("should yield empty project with invalid absolute paths", () => {
        testObj = compilationEnv("/target");
        testObj.addProject("expected-project", {
            // buildDir is missing in absolute paths
            "/expected-project/index.ts": `export * from "./target";`,
            "/expected-project/target.ts": `export class Target {}`,
        });

        const actual = testObj.getProjects();

        expect(actual).toHaveLength(1);
        expect(actual[0].getPath()).toBe("/target/expected-project");
        expect(actual[0].getFiles()).toHaveLength(0);
    });

    it("should yield project with single project in default projects path", () => {
        testObj = compilationEnv("/target");
        testObj.getSystem().writeFile("/test-data/projects/expected-project/index.ts", `export * from "./target";`);
        testObj.getSystem().writeFile("/test-data/projects/expected-project/target.ts", `export class Target {}`);

        testObj.addProject("expected-project");

        const actual = testObj.getProjects();

        expect(actual).toHaveLength(1);
        expect(actual[0].getPath()).toBe("/target/expected-project");
        expect(actual[0].getFiles()).toEqual(["/target/expected-project/index.ts", "/target/expected-project/target.ts"]);
    });

    it("should yield projects with multiple projects in default projects path", () => {
        testObj = compilationEnv("/target");
        testObj.getSystem().writeFile("/test-data/projects/expected-project1/index.ts", `export * from "./one";`);
        testObj.getSystem().writeFile("/test-data/projects/expected-project1/one.ts", `export class One {}`);
        testObj.getSystem().writeFile("/test-data/projects/expected-project2/index.ts", `export * from "./two";`);
        testObj.getSystem().writeFile("/test-data/projects/expected-project2/two.ts", `export class Two {}`);

        testObj.addProject("expected-project1").addProject("expected-project2");

        const actual = testObj.getProjects();

        expect(actual).toHaveLength(2);
        expect(actual[0].getPath()).toBe("/target/expected-project1");
        expect(actual[0].getFiles()).toEqual(["/target/expected-project1/index.ts", "/target/expected-project1/one.ts"]);
        expect(actual[1].getPath()).toBe("/target/expected-project2");
        expect(actual[1].getFiles()).toEqual(["/target/expected-project2/index.ts", "/target/expected-project2/two.ts"]);
    });

    it("should yield project with single project in custom projects path", () => {
        testObj = compilationEnv("/target");
        testObj.getSystem().writeFile("/custom-projects/expected-project/index.ts", `export * from "./target";`);
        testObj.getSystem().writeFile("/custom-projects/expected-project/target.ts", `export class Target {}`);

        testObj.addProject("expected-project", "../custom-projects/");

        const actual = testObj.getProjects();

        expect(actual).toHaveLength(1);
        expect(actual[0].getPath()).toBe("/target/expected-project");
        expect(actual[0].getFiles()).toEqual(["/target/expected-project/index.ts", "/target/expected-project/target.ts"]);
    });

    it("should yield project and add file with file name", () => {
        testObj = compilationEnv("/target").addProject("expected-project");

        testObj.getProject("expected-project")!.addFile("index.ts", `export * from "./target";`).addFile("target.ts", `export class Target {}`);

        const actual = testObj.getProjects();

        expect(actual).toHaveLength(1);
        expect(actual[0].getPath()).toBe("/target/expected-project");
        expect(actual[0].getFiles()).toEqual(["/target/expected-project/index.ts", "/target/expected-project/target.ts"]);
    });

    it("should yield project and add files with relative paths", () => {
        testObj = compilationEnv("/target").addProject("expected-project");

        testObj
            .getProject("expected-project")!
            .addFile("./foo-bar/index.ts", `export * from "./target";`)
            .addFile("./foo-bar/target.ts", `export class Target {}`);

        const actual = testObj.getProjects();

        expect(actual).toHaveLength(1);
        expect(actual[0].getPath()).toBe("/target/expected-project");
        expect(actual[0].getFiles()).toEqual(["/target/expected-project/foo-bar/index.ts", "/target/expected-project/foo-bar/target.ts"]);
    });

    it("should yield project and add files with relative project paths", () => {
        testObj = compilationEnv("/target").addProject("expected-project");

        testObj
            .getProject("expected-project")!
            .addFile("./expected-project/index.ts", `export * from "./target";`)
            .addFile("./expected-project/target.ts", `export class Target {}`);

        const actual = testObj.getProjects();

        expect(actual).toHaveLength(1);
        expect(actual[0].getPath()).toBe("/target/expected-project");
        expect(actual[0].getFiles()).toEqual(["/target/expected-project/index.ts", "/target/expected-project/target.ts"]);
    });

    it("should yield project and add files with absolute paths", () => {
        testObj = compilationEnv("/target").addProject("expected-project");

        testObj
            .getProject("expected-project")!
            .addFile("/target/expected-project/index.ts", `export * from "./target";`)
            .addFile("/target/expected-project/target.ts", `export class Target {}`);

        const actual = testObj.getProjects();

        expect(actual).toHaveLength(1);
        expect(actual[0].getPath()).toBe("/target/expected-project");
        expect(actual[0].getFiles()).toEqual(["/target/expected-project/index.ts", "/target/expected-project/target.ts"]);
    });

    it("should yield empty project with invalid absolute paths added", () => {
        testObj = compilationEnv("/target").addProject("expected-project");

        testObj
            .getProject("expected-project")!
            .addFile("/expected-project/index.ts", `export * from "./target";`)
            .addFile("/expected-project/target.ts", `export class Target {}`);

        const actual = testObj.getProjects();

        expect(actual).toHaveLength(1);
        expect(actual[0].getPath()).toBe("/target/expected-project");
        expect(actual[0].getFiles()).toHaveLength(0);
    });
});
