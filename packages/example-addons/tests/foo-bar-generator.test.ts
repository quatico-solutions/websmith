/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { compilationEnv, type CompilationEnv } from "@quatico/websmith-testing";
import path from "node:path";

describe("foo-added-generator addon", () => {
    let testObj: CompilationEnv;

    beforeEach(() => {
        testObj = compilationEnv("./__TEST_GENERATOR__", { virtual: false, tsConfig: { skipLibCheck: true } }).addAddon(
            "foo-added-generator",
            path.join(__dirname, "../src")
        );
    });

    afterEach(() => {
        testObj.cleanUp();
    });

    it("should create additional input files and add them to compilation", () => {
        testObj
            .addProjectFromSource({
                "bar.ts": `console.log("Hello, Bar!");`,
                "foo.ts": `export class Foo<T> {
                    constructor(public value: T) {
                        console.log("Hello, Foo!", JSON.stringify(value));
                    }
                }`,
            })
            .compile();

        expect(testObj.getCompiledFiles().getPaths("__TEST_GENERATOR__")).toEqual(
            expect.arrayContaining([
                expect.stringContaining("dist/bar.js"),
                expect.stringContaining("dist/foo-added.js"),
                expect.stringContaining("dist/foo.js"),
            ])
        );

        expect(testObj.getCompiledFile("foo.js")?.getContent()).toMatchInlineSnapshot(`
            "export class Foo {
                value;
                constructor(value) {
                    this.value = value;
                    console.log("Hello, Foo!", JSON.stringify(value));
                }
            }
            "
        `);
    }, 60000);
});
