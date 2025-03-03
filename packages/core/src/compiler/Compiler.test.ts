import { ReporterMock } from "../../test";
import { compileSystem, resolveCompilerOptions } from "../testing";
import { Compiler } from "./Compiler";

describe("end-2-end compile w/ websmith", () => {
    it("should yield compiled file", () => {
        const { fileSystem: target } = compileSystem({
            files: {
                "tsconfig.json": "{}",
                "src/one.ts": `whatever`,
                "src/two.ts": `whatever`,
            },
        });

        // TODO: Resolve compiler options
        const actual = new Compiler(
            resolveCompilerOptions(target, {
                reporter: new ReporterMock(target),
                tsConfig: { outDir: "./bin" },
            }),
            target
        ).compile();

        expect(actual.diagnostics).toEqual([]);
        expect(actual.emitSkipped).toBe(false);
        expect(target.fileExists("/bin/one.js")).toBe(true);
        expect(target.fileExists("/bin/two.js")).toBe(true);
    });
});
