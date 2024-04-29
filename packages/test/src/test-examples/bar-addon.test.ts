import { activeAddons, execute, fileContent, pathExists, setUp } from "../setup";

const { rootDir, cleanUp, compiler, addAddons, addProject, system } = setUp("__TEMP__");

beforeAll(() => {
    addAddons("foo-addon", "../test-data/addons/");
});

afterAll(() => {
    cleanUp(rootDir);
});

describe("test-project-foo", () => {
    let projectDir: string;
    beforeEach(() => {
        projectDir = addProject("test-project-foo", rootDir, "../test-data/projects/");
    });

    afterEach(() => {
        cleanUp(projectDir);
    });

    it("should install addon successfully", () => {
        expect(activeAddons(compiler)).toContain("foo-addon");
    });

    it("should contain source file", () => {
        const actual = fileContent(system, projectDir, "src/foo.ts");

        expect(actual).toMatchInlineSnapshot(`
            "export const foo = (): void => {
                console.log("foo");
            };
            "
        `);
    });

    it("should compile source file content", () => {
        execute("websmith compiler");

        expect(fileContent(system, "dist/foo.js")).toMatchInlineSnapshot(`
            "export const foo = () => {
                console.log("foo");
            };
            "
        `);
    });
});

describe("test-project-foobar", () => {
    beforeEach(() => {
        addProject("test-project-foobar");
    });

    afterEach(() => {
        cleanUp();
    });

    it("should contain source files", () => {
        expect(pathExists(system, "src/foobar.ts", "src/whatever.ts")).toBe(true);
    });

    it("should compile foobar.ts content", () => {
        execute("websmith compiler");

        expect(fileContent(system, "dist/foobar.js")).toMatchInlineSnapshot(`
            ""use strict";
            /* eslint-disable @typescript-eslint/no-unused-vars */
            function foobar() {
                console.log("foobar");
                return "foobar";
            }
            "
        `);
    });
});

describe("test-project-one", () => {
    let projectDir: string;
    beforeEach(() => {
        projectDir = addProject("test-project-one", rootDir, "../test-data/projects/");
    });

    afterEach(() => {
        cleanUp(projectDir);
    });

    it("should contain source file", () => {
        expect(pathExists(system, "src/one.ts", "src/two.ts", "src/three.ts")).toBe(true);
    });

    it("should compile one.ts content", () => {
        execute("websmith compiler");

        expect(fileContent(system, "dist/one.js")).toMatchInlineSnapshot(`
            "export const one = () => {
                console.log("one");
            };
            "
        `);
    });
});
