import { compilationEnv, type CompilationEnv } from "@quatico/websmith-testing";
import { join } from "path";

describe("example-result-processor", () => {
    let testObj: CompilationEnv;
    beforeAll(() => {
        testObj = compilationEnv("./__TEST__/example-result-processor", { virtual: false }).addAddon(
            "example-result-processor",
            join(__dirname, "../addons")
        );
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
