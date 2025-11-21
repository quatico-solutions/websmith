/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { compilationEnv, type CompilationEnv } from "@quatico/websmith-testing";
import path from "node:path";

describe("export-yaml-generator addon", () => {
    let testObj: CompilationEnv;

    beforeEach(() => {
        testObj = compilationEnv("./__TEST_YAML_GENERATOR__", {
            tsConfig: { outDir: "dist", skipLibCheck: true },
            virtual: false,
        }).addAddon("export-yaml-generator", path.join(__dirname, "../src"));
    });

    afterEach(() => {
        testObj.cleanUp();
    });

    it("should create additional input files and add them to compilation", () => {
        testObj
            .addProjectFromSource({
                "bar.ts": `console.log("Hello, Bar!");`,
                "foo.ts": `export class Foo {}`,
            })
            .compile();

        const actual = testObj.getCompiledFiles().getPaths("__TEST_YAML_GENERATOR__");

        expect(actual).toEqual(expect.arrayContaining([
            expect.stringContaining("dist/bar.js"),
            expect.stringContaining("dist/foo.js"),
            expect.stringContaining("dist/output.yaml")
        ]));
        expect(testObj.getCompiledFile("output.yaml")?.getContent()).toEqual(expect.stringContaining("exports: [Foo]"));
    }, 60000);
});
