import { CompilationEnv, compilationEnv } from "@quatico/websmith-testing";
import { join } from "path";

describe("foobar-replace-transformer", () => {
    let testObj: CompilationEnv;
    beforeAll(() => {
        testObj = compilationEnv("./__TEST__", { compilerOptions: { project: { outDir: "dist" } }, virtual: false }).addAddon(
            "foobar-replace-transformer",
            join(__dirname, "../addons")
        );
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

        const actual = testObj
            .getCompiledFiles()
            .getPaths()
            .map(it => it.substring(it.indexOf("/__TEST__")));

        expect(actual).toEqual(["/__TEST__/dist/bar.js", "/__TEST__/dist/foo.js"]);
        expect(testObj.getCompiledFile("foo.js")?.getContent()).toEqual(expect.stringContaining("export class barfoo"));
    });
});
