/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { compilationEnv, type CompilationEnv } from "@quatico/websmith-testing";
import path from "node:path";

// FIXME: This test is failing because the function-json-result-processor addon is not being loaded
describe.skip("function-json-result-processor addon", () => {
    let testObj: CompilationEnv;
    beforeAll(() => {
        testObj = compilationEnv("./__TEST__", {
            virtual: false,
            tsConfig: { skipLibCheck: true },
        }).addAddon("function-json-result-processor", path.join(__dirname, "../src"));
    });

    afterEach(() => {
        testObj.cleanUp("project");
    });

    afterAll(() => {
        testObj.cleanUp();
    });

    it("should create a JSON file with single function names", () => {
        testObj
            .addProjectFromSource({
                "target.ts": `
                    function expected(): void {
                        console.log("Hello, Foo!");
                    }
                `,
            })
            .compile();

        const actual = testObj.getCompiledFile("named-functions.json")!.getContent()!;

        expect(JSON.parse(actual)).toMatchObject({ target: ["expected"] });
    });

    it("should create a JSON file without function names for arrow functions", () => {
        testObj
            .addProjectFromSource({
                "target.ts": `
                    const baz = (): void => console.log("Hello, Baz!");
                `,
            })
            .compile();

        const actual = testObj.getCompiledFile("named-functions.json")!.getContent()!;

        expect(JSON.parse(actual)).toMatchObject({ target: [] });
    });

    it("should create a JSON file with multiple function names", () => {
        testObj
            .addProjectFromSource({
                "target.ts": `
                    function foobar(): void {
                        console.log("Hello, Foo!");
                    }
                    function barfoo(): void {
                        console.log("Hello, Bar!");
                    }
                    const baz = (): void => console.log("Hello, Baz!");
                `,
                "other.ts": `const zip = () => console.log("Hello, World!");`,
            })
            .compile();

        const actual = testObj.getCompiledFile("named-functions.json")!.getContent()!;

        expect(JSON.parse(actual)).toMatchObject({ target: ["foobar", "barfoo"], other: [] });
    });
});
