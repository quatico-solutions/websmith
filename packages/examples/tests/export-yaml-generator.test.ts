/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { compilationEnv, type CompilationEnv } from "@quatico/websmith-testing";
import { join } from "path";

// FIXME: This test is failing because the virtual mock for this addon needs the actual sourceDir
describe.skip("export-yaml-generator", () => {
    let testObj: CompilationEnv;
    beforeAll(() => {
        testObj = compilationEnv("./__TEST__").addAddon("export-yaml-generator", join(__dirname, "../addons"));
    });

    afterEach(() => {
        testObj.cleanUp("project");
    });

    it("should create additional input files and add them to compilation", () => {
        testObj
            .addProjectFromSource({
                "bar.ts": `console.log("Hello, Bar!");`,
                "foo.ts": `export class Foo {}`,
            })
            .compile();

        const actual = testObj.getCompiledFiles().getPaths();

        expect(actual).toEqual(["/__TEST__/dist/bar.js", "/__TEST__/dist/foo.js", "/__TEST__/dist/foo-added.js"]);
    });
});
