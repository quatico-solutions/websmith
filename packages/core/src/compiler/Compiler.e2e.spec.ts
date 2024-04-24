import ts from "typescript";
import { ReporterMock, compileSystem } from "../../test";
import { Compiler } from "./Compiler";
import { AddonRegistry } from "./addons";

describe("end-2-end compile", () => {
    it("should yield compiled file", () => {
        const { fileSystem: target } = compileSystem({
            "tsconfig.json": JSON.stringify({}),
            "src/one.ts": `whatever`,
            "src/two.ts": `whatever`,
        });

        const actual = createCompiler(target, { outDir: "./bin" }).compile();

        expect(actual.diagnostics).toEqual([]);
        expect(actual.emitSkipped).toBe(false);
        expect(target.fileExists("/bin/one.js")).toBe(true);
        expect(target.fileExists("/bin/two.js")).toBe(true);
    });
});

const createCompiler = (system: ts.System, options: ts.CompilerOptions = {}) => {
    const reporter = new ReporterMock(system);
    const result = new Compiler(
        {
            addons: new AddonRegistry({ addonsDir: "./addons", reporter, system }),
            buildDir: "./src",
            config: {
                configFilePath: "",
                targets: {
                    "*": {
                        writeFile: true,
                    },
                },
            },
            debug: false,
            project: options,
            reporter,
            sourceMap: false,
            targets: [],
            transpileOnly: false,
            tsconfig: { options: options, fileNames: system.readDirectory("./src"), errors: [] },
            watch: false,
        },
        system
    );
    return result;
};
