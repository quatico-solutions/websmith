/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { join } from "path";
import { compilationEnv, type CompilationEnv } from "@quatico/websmith-testing";

describe("example-generator", () => {
    let testObj: CompilationEnv;
    beforeAll(() => {
        testObj = compilationEnv("./__TEST__").addAddon("example-generator", join(__dirname, "../addons"));
    });

    afterEach(() => {
        testObj.cleanUp("project");
    });

    it("should create additional input files and add them to compilation", () => {
        testObj
            .addProjectFromSource({
                "bar.ts": `console.log("Hello, Bar!");`,
                "foo.ts": `export class Foo<T> {
                    constructor(public value: T) {
                        console.log("Hello, Foo!", JSON.stringify(value));
                    }
                }`,
            })
            .compile();

        const actual = testObj.getCompiledFiles().getPaths();

        expect(actual).toEqual(["/__TEST__/dist/bar.js", "/__TEST__/dist/foo.js", "/__TEST__/dist/foo-added.js"]);
        expect(testObj.getCompiledFile("foo.js")?.getContent()).toMatchInlineSnapshot(`
            "export class Foo {
                value;
                constructor(value) {
                    this.value = value;
                    console.log("Hello, Foo!", JSON.stringify(value));
                }
            }
            "
        `);
    });
});
