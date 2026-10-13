/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type CompilationEnv, compilationEnv } from "@quatico/websmith-testing";
import path from "node:path";

// TypeScript 6 emits "use strict" for every script (5.x only under strict); the subject here is the addon's output, not the prologue
const withoutUseStrict = (content: string): string => content.replace(/^"use strict";\n/, "");

describe("foobar-replace-transformer addon", () => {
    let testObj: CompilationEnv;

    beforeEach(() => {
        testObj = compilationEnv("./__TEST_TRANSFORMER__", {
            tsConfig: { outDir: "dist", skipLibCheck: true },
            virtual: false,
        }).addAddon("foobar-replace-transformer", path.join(__dirname, "../src"));
    });

    afterEach(() => {
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

        const actual = withoutUseStrict(testObj.getCompiledFile("target.js")!.getContent());

        expect(actual).toMatchInlineSnapshot(`
            "function barfoo() {
                console.log("Hello, Foo!");
            }
            "
        `);
    }, 60000);

    it("should replace 'foo' with 'bar' in the output files", () => {
        testObj
            .addProjectFromSource({
                "bar.ts": `console.log("Hello, Bar!");`,
                "foo.ts": `export class FooBar {}`,
            })
            .compile();

        const actual = testObj.getCompiledFiles().getPaths("__TEST_TRANSFORMER__");

        expect(actual).toEqual(expect.arrayContaining([expect.stringContaining("dist/bar.js"), expect.stringContaining("dist/foo.js")]));
        expect(testObj.getCompiledFile("foo.js")?.getContent()).toEqual(expect.stringContaining("export class barfoo"));
    }, 60000);
});
