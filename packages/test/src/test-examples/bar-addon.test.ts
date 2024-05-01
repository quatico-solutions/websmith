/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { compilationEnv } from "@quatico/websmith-testing";

describe("test-project-foo", () => {
    it("should install addon successfully", () => {
        const testObj = compilationEnv("__TEST__").addAddon("foo-addon", "../test-data/addons");

        const actual = testObj.getActiveAddons().map(it => it.name);

        expect(actual).toContain("foo-addon");
    });

    it("should contain source file", () => {
        const testObj = compilationEnv("__TEST__").addProjectFile(
            "src/foo.ts",
            `
                export const foo = () => {
                    console.log("foo");
                };
            `
        );

        const actual = testObj.getProjectFile("foo.ts");

        expect(actual).toMatchInlineSnapshot(
            `
                export const foo = () => {
                    console.log("foo");
                };
            `
        );
    });

    it("should compile source file content", () => {
        const testObj = compilationEnv("__TEST__").addProjectFile(
            "src/foo.ts",
            `
            export const foo = () => {
                console.log("foo");
            };
        `
        );

        const actual = testObj.compile();

        expect(actual.emittedFiles![0]).toMatchInlineSnapshot(`
            "export const foo = () => {
                console.log("foo");
            };
            "
        `);
    });
});
