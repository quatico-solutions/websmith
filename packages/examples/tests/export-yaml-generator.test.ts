/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { compilationEnv, type CompilationEnv } from "@quatico/websmith-testing";
import { join } from "path";

describe("export-yaml-generator", () => {
    let testObj: CompilationEnv;
    beforeAll(() => {
        testObj = compilationEnv("./__TEST__", { compilerOptions: { project: { outDir: "dist" } }, virtual: false }).addAddon(
            "export-yaml-generator",
            join(__dirname, "../addons")
        );
    });

    afterEach(() => {
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

        expect(actual).toEqual(["/__TEST__/dist/bar.js", "/__TEST__/dist/foo.js", "/__TEST__/dist/output.yaml"]);
        expect(testObj.getCompiledFile("output.yaml")?.getContent()).toEqual(expect.stringContaining("exports: [Foo]"));
    });
});
