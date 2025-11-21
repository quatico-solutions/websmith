/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { compilationEnv, type CompilationEnv } from "@quatico/websmith-testing";
import path from "node:path";

describe("foobar-export-processor addon", () => {
    let testObj: CompilationEnv;

    beforeEach(() => {
        testObj = compilationEnv("./__TEST_EXPORT_PROCESSOR__", { virtual: false, tsConfig: { skipLibCheck: true } }).addAddon(
            "foobar-export-processor",
            path.join(__dirname, "../src")
        );
    });

    afterEach(() => {
        testObj.cleanUp();
    });

    it("should add export to functions named 'foobar' with single function", () => {
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
            "export function foobar() {
                console.log("Hello, Foo!");
            }
            "
        `);
    }, 60000);

    it("should not export functions named differently", () => {
        testObj
            .addProjectFromSource({
                "target.ts": `
                    function whatever(): void {
                        console.log("Hello, Foo!");
                    }
                `,
            })
            .compile();

        const actual = testObj.getCompiledFile("target.js")!.getContent();

        expect(actual).toMatchInlineSnapshot(`
            "function whatever() {
                console.log("Hello, Foo!");
            }
            "
        `);
    }, 60000);

    it("should not export arrow functions with name 'foobar'", () => {
        testObj
            .addProjectFromSource({
                "target.ts": `const foobar = (): void => console.log("Hello, Foo!");`,
            })
            .compile();

        const actual = testObj.getCompiledFile("target.js")!.getContent();

        expect(actual).toMatchInlineSnapshot(`
            "const foobar = () => console.log("Hello, Foo!");
            "
        `);
    }, 60000);
});
