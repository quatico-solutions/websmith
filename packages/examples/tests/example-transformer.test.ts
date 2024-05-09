import { compilationEnv, type CompilationEnv } from "@quatico/websmith-testing";
import { join } from "path";

describe("example-transformer", () => {
    let testObj: CompilationEnv;
    beforeAll(() => {
        testObj = compilationEnv("./__TEST__/example-transformer", { virtual: false }).addAddon("example-transformer", join(__dirname, "../addons"));
    });

    afterEach(() => {
        testObj.cleanUp("project");
    });

    afterAll(() => {
        testObj.cleanUp();
    });

    it("should replace 'foobar' with 'barfoo'", () => {
        testObj
            .addProjectFromSource({
                "target.ts": `
                    function foobar(): void {
                        console.log("Hello, Foo!");
                    }
                `,
            })
            .compile();

        const actual = testObj.getCompiledFile("target.js")!.getContent();

        expect(actual).toMatchInlineSnapshot(`
            "function barfoo() {
                console.log("Hello, Foo!");
            }
            "
        `);
    });
});
