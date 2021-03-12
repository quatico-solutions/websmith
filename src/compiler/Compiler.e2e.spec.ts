// tslint:disable: object-literal-sort-keys
import { ReporterMock } from "../__mocks__";
import { createBrowserSystem } from "../environment";
import { Compiler } from "./Compiler";

describe("end-2-end compile", () => {
    it("should yield compiled file", () => {
        const system = createBrowserSystem({
            "tsconfig.json": JSON.stringify({ compilerOptions: { outDir: "./bin" } }),
            "src/one.ts": ``,
            "src/two.ts": ``,
        });
        const testObj = new Compiler({
            configPath: "tsconfig.json",
            reporter: new ReporterMock(system),
            system,
        });

        const result = testObj.compile();

        expect(result.diagnostics).toEqual([]);
        expect(result.emitSkipped).toBe(false);
        expect(system.fileExists("/bin/one.js")).toBe(true);
        expect(system.fileExists("/bin/two.js")).toBe(true);
    });

    it("should call transformer before emitting file", () => {
        const target = jest.fn().mockReturnValue({
            transformSourceFile: (sf: any) => {
                throw new Error("XXX");
            },
        });
        const system = createBrowserSystem({
            "tsconfig.json": JSON.stringify({}),
            "src/one.ts": ``,
        });
        const testObj = new Compiler({
            configPath: "tsconfig.json",
            reporter: new ReporterMock(system),
            system,
        });

        testObj.getAddonRegistry().registerTransformer("before", target);
        testObj.compile();

        expect(target).toHaveBeenCalled();
    });
});
