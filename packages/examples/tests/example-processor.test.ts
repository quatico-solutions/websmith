/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { compilationEnv, type CompilationEnv } from "@quatico/websmith-testing";
import { join } from "path";

describe("example-processor", () => {
    let testObj: CompilationEnv;
    beforeAll(() => {
        testObj = compilationEnv("./__TEST__").addAddon("example-processor", join(__dirname, "../addons"));
    });

    afterEach(() => {
        testObj.cleanUp("project");
    });

    it("should add export to functions named 'foobar' with single function", () => {
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
            "export function foobar() {
                console.log("Hello, Foo!");
            }
            "
        `);
    });

    it("should not export functions named differently", () => {
        testObj
            .addProjectFromSource({
                "target.ts": `
                    function whatever(): void {
                        console.log("Hello, Foo!");
                    }
                `,
            })
            .compile();

        const actual = testObj.getCompiledFile("target.js")!.getContent();

        expect(actual).toMatchInlineSnapshot(`
            "function whatever() {
                console.log("Hello, Foo!");
            }
            "
        `);
    });

    it("should not export arrow functions with name 'foobar'", () => {
        testObj
            .addProjectFromSource({
                "target.ts": `const foobar = (): void => console.log("Hello, Foo!");`,
            })
            .compile();

        const actual = testObj.getCompiledFile("target.js")!.getContent();

        expect(actual).toMatchInlineSnapshot(`
            "const foobar = () => console.log("Hello, Foo!");
            "
        `);
    });
});
