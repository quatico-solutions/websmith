/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type CompilationEnv, compilationEnv } from "@quatico/websmith-testing";
import path from "node:path";

describe("foobar-replace-processor addon", () => {
    let testObj: CompilationEnv;

    beforeEach(() => {
        testObj = compilationEnv("./__TEST_PROCESSOR__", {
            tsConfig: { outDir: "dist", skipLibCheck: true },
            virtual: false,
        });
        testObj.addAddons(["foobar-replace-transformer", "foobar-replace-processor"], path.join(__dirname, "../src"));
    });

    afterEach(() => {
        testObj.cleanUp();
    });

    it("should replace 'foo' with 'bar' in the output files", () => {
        testObj
            .addProjectFromSource({
                "bar.ts": `console.log("Hello, Bar!");`,
                "foo.ts": `export class FooBar {}`,
            })
            .compile();

        expect(testObj.getCompiledFiles().getPaths("__TEST_PROCESSOR__")).toEqual(expect.arrayContaining([
            expect.stringContaining("dist/bar.js"),
            expect.stringContaining("dist/foo.js")
        ]));
        expect(testObj.getCompiledFile("foo.js")?.getContent()).toEqual(expect.stringContaining("export class barfoo {"));
    }, 60000);
});
