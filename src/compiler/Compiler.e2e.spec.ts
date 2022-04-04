/* eslint-disable jest/no-mocks-import */
import ts from "typescript";
import { ReporterMock } from "../../test";
import { createBrowserSystem } from "../environment";
import { AddonRegistry } from "./addons";
import { Compiler } from "./Compiler";

describe("end-2-end compile", () => {
    it("should yield compiled file", () => {
        const options: ts.CompilerOptions = { outDir: "./bin" };
        const system = createBrowserSystem({
            "tsconfig.json": JSON.stringify({ compilerOptions: options }),
            "src/one.ts": `whatever`,
            "src/two.ts": `whatever`,
        });
        const testObj = createCompiler(system, options);

        const result = testObj.compile();

        expect(result.diagnostics).toEqual([]);
        expect(result.emitSkipped).toBe(false);
        expect(system.fileExists("/bin/one.js")).toBe(true);
        expect(system.fileExists("/bin/two.js")).toBe(true);
    });

    it.skip("should call transformer before emitting file", () => {
        const target = jest.fn().mockImplementation((fileName, content) => {
            return content;
        });
        const system = createBrowserSystem({
            "tsconfig.json": JSON.stringify({}),
            "src/one.ts": `whatever`,
        });
        const testObj = createCompiler(system);

        testObj.getContext()!.registerEmitTransformer({ before: [target] });
        testObj.compile();

        expect(target).toHaveBeenCalledWith(expect.objectContaining({ fileName: "src/one.ts" }));
        expect(target).toHaveBeenCalledTimes(1);
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
                        writeFile: true
                    }
                }
            },
            debug: false,
            project: options,
            reporter,
            sourceMap: false,
            targets: [],
            tsconfig: { options: options, fileNames: system.readDirectory("./src"), errors: [] },
            watch: false,
        },
        system
    );
    return result;
};
