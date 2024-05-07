import { compileOptions, compileSystem } from "../../test";
import { Compiler } from "./Compiler";

describe("end-2-end compile", () => {
    it("should yield compiled file", () => {
        const { fileSystem: target } = compileSystem({
            "tsconfig.json": "{}",
            "src/one.ts": `whatever`,
            "src/two.ts": `whatever`,
        });

        const actual = new Compiler(
            compileOptions(target, {
                project: { outDir: "./bin" },
            }),
            target
        ).compile();

        expect(actual.diagnostics).toEqual([]);
        expect(actual.emitSkipped).toBe(false);
        expect(target.fileExists("/bin/one.js")).toBe(true);
        expect(target.fileExists("/bin/two.js")).toBe(true);
    });
});
