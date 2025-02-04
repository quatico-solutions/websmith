/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type CompilationEnv, compilationEnv } from "@quatico/websmith-testing";
import { join } from "node:path";

describe("foobar-replace-processor", () => {
    let testObj: CompilationEnv;
    beforeAll(() => {
        testObj = compilationEnv("./__TEST__/foobar-replace-processor", {
            compilerOptions: { tsConfig: { outDir: "dist" } },
            virtual: false,
        }).addAddon("foobar-replace-processor", join(__dirname, "../src"));
    });

    afterEach(() => {
        testObj.cleanUp("project");
    });

    afterAll(() => {
        testObj.cleanUp();
    });

    it("should replace 'foo' with 'bar' in the output files", () => {
        testObj
            .addProjectFromSource({
                "bar.ts": `console.log("Hello, Bar!");`,
                "foo.ts": `export class FooBar {}`,
            })
            .compile();

        const actual = testObj
            .getCompiledFiles()
            .getPaths()
            .map(it => it.substring(it.indexOf("/__TEST__")));

        expect(actual).toEqual(["/__TEST__/foobar-replace-processor/dist/bar.js", "/__TEST__/foobar-replace-processor/dist/foo.js"]);
        expect(testObj.getCompiledFile("foo.js")?.getContent()).toEqual(expect.stringContaining("export class barfoo {"));
    });
});
