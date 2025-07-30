/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type CompilationEnv, compilationEnv } from "@quatico/websmith-testing";
import path from "node:path";

// FIXME: This test is failing because the foobar-replace-transformer addon is not being loaded
describe.skip("foobar-replace-transformer addon", () => {
    let testObj: CompilationEnv;
    beforeAll(() => {
        testObj = compilationEnv("./__TEST__", {
            tsConfig: { outDir: "dist", skipLibCheck: true },
            virtual: false,
        }).addAddon("foobar-replace-transformer", path.join(__dirname, "../src"));
    });

    afterEach(() => {
        testObj.cleanUp("project");
    });

    afterAll(() => {
        testObj.cleanUp();
    });

    it("should replace 'foobar' with 'barfoo'", () => {
        testObj
            .addProjectFromSource({
                "target.ts": `
                    function foobar(): void {
                        console.log("Hello, Foo!");
                    }
                `,
            })
            .compile();

        const actual = testObj.getCompiledFile("target.js")!.getContent();

        expect(actual).toMatchInlineSnapshot(`
            "function barfoo() {
                console.log("Hello, Foo!");
            }
            "
        `);
    });

    it("should replace 'foo' with 'bar' in the output files", () => {
        testObj
            .addProjectFromSource({
                "bar.ts": `console.log("Hello, Bar!");`,
                "foo.ts": `export class FooBar {}`,
            })
            .compile();

        const actual = testObj.getCompiledFiles().getPaths("/__TEST__");

        expect(actual).toEqual(["/__TEST__/dist/bar.js", "/__TEST__/dist/foo.js"]);
        expect(testObj.getCompiledFile("foo.js")?.getContent()).toEqual(expect.stringContaining("export class barfoo"));
    });
});
