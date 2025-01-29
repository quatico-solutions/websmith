/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { join } from "path";
import { compilationEnv, type CompilationEnv } from "@quatico/websmith-testing";

describe("example-generator", () => {
    let testObj: CompilationEnv;
    beforeAll(() => {
        testObj = compilationEnv("./__TEST__/example-generator", { virtual: false }).addAddon("example-generator", join(__dirname, "../src"));
    });

    afterEach(() => {
        testObj.cleanUp("project");
    });

    afterAll(() => {
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

        const actual = testObj.getCompiledFiles().getPaths();

        expect(actual.map(it => it.substring(it.indexOf("/__TEST__")))).toEqual([
            "/__TEST__/example-generator/dist/bar.js",
            "/__TEST__/example-generator/dist/foo-added.js",
            "/__TEST__/example-generator/dist/foo.js",
        ]);
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
    });
});
