/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { compilationEnv, type CompilationEnv } from "@quatico/websmith-testing";
import { join } from "node:path";

describe("export-yaml-generator addon", () => {
    let testObj: CompilationEnv;
    beforeAll(() => {
        testObj = compilationEnv("./__TEST__/export-yaml-generator", {
            compilerOptions: { tsConfig: { outDir: "dist" } },
            virtual: false,
        }).addAddon("export-yaml-generator", join(__dirname, "../src"));
    });

    afterEach(() => {
        testObj.cleanUp("project");
    });

    afterAll(() => {
        testObj.cleanUp();
    });

    // TODO: BUG in addon? The test fails as the addon does not report on exported classes.
    it.skip("should create additional input files and add them to compilation", () => {
        testObj
            .addProjectFromSource({
                "bar.ts": `console.log("Hello, Bar!");`,
                "foo.ts": `export class Foo {}`,
            })
            .compile();

        const actual = testObj
            .getCompiledFiles()
            .getPaths()
            .map(it => it.substring(it.indexOf("/__TEST__")));

        expect(actual).toEqual([
            "/__TEST__/export-yaml-generator/dist/bar.js",
            "/__TEST__/export-yaml-generator/dist/foo.js",
            "/__TEST__/export-yaml-generator/dist/output.yaml",
        ]);
        expect(testObj.getCompiledFile("output.yaml")?.getContent()).toEqual(expect.stringContaining("exports: [Foo]"));
    });
});
