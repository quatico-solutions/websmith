/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { compilationEnv } from "@quatico/websmith-testing";
import { join } from "node:path";

describe("compile test-project-foo w/ compilationEnv", () => {
    it("should install addon successfully", () => {
        const testObj = compilationEnv("__TEST__").addAddon("foo-addon", join(__dirname, "../test-data/addons"));

        const actual = testObj.getActiveAddons("*").getNames();

        expect(actual).toContain("foo-addon");
    });

    it("should contain source file", () => {
        const testObj = compilationEnv("__TEST__").addSourceFile(
            "foo.ts",
            `
                export const foo = () => {
                    console.log("foo");
                };p
            `
        );

        const actual = testObj.getProjectFile("foo.ts")!.getContent();

        expect(actual).toMatchInlineSnapshot(`
        "
                        export const foo = () => {
                            console.log("foo");
                        };p
                    "
        `);
    });

    it("should compile source project from disk", () => {
        const actual = compilationEnv("__TEST__").addProjectFromDisk("test-project-foo", join(__dirname, "../test-data/projects")).compile();

        expect(actual.getCompiledFile("foo.js")!.getContent()).toMatchInlineSnapshot(`
            "export const foo = () => {
                console.log("foo");
            };
            "
        `);
    });

    it("should compile source file content", () => {
        const testObj = compilationEnv("__TEST__").addSourceFile(
            "foo.ts",
            `
            export const foo = () => {
                console.log("foo");
            };
        `
        );

        const actual = testObj.compile();

        expect(actual.getCompiledFile("foo.js")!.getContent()).toMatchInlineSnapshot(`
            "export const foo = () => {
                console.log("foo");
            };
            "
        `);
    });
});
