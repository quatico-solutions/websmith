/* eslint-disable jest/no-mocks-import */
import ts from "typescript";
import { ReporterMock } from "../__mocks__";
import { createBrowserSystem } from "../environment";
import { Compiler } from "./Compiler";

describe("end-2-end compile", () => {
    it("should yield compiled file", () => {
        const system = createBrowserSystem({
            "tsconfig.json": JSON.stringify({ compilerOptions: { outDir: "./bin" } }),
            "src/one.ts": `whatever`,
            "src/two.ts": `whatever`,
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
        const target = jest.fn().mockImplementation((sf: ts.SourceFile) => {
            return sf;
        });

        const system = createBrowserSystem({
            "tsconfig.json": JSON.stringify({}),
            "src/one.ts": `whatever`,
        });
        const testObj = new Compiler({
            configPath: "tsconfig.json",
            reporter: new ReporterMock(system),
            system,
        });

        testObj.getAddonRegistry().registerTransformer("before", () => target);
        testObj.compile();

        expect(target).toHaveBeenCalledWith(expect.objectContaining({ fileName: "src/one.ts" }));
        expect(target).toHaveBeenCalledTimes(1);
    });
});
