/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
/* eslint-disable jest/no-mocks-import */
import { TargetConfig } from "@quatico/websmith-api/src";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import ts from "typescript";
import { ReporterMock } from "../../test";
import { createBrowserSystem, createSystem } from "../environment";
import { AddonRegistry } from "./addons";
import { CompileFragment, Compiler } from "./Compiler";
import { CompilerOptions } from "./CompilerOptions";
import { CompilationConfig } from "./config";

const testSystem = createBrowserSystem({
    "tsconfig.json": JSON.stringify({
        compilerOptions: {
            target: "ESNEXT",
            outDir: "./.build",
        },
    }),
    "src/one.js": `{
        export class One {}
    }`,
    "src/two.ts": `{
        export class Two {}
    }`,
    "src/three.tsx": `{
        export class Three {}
    }`,
    "src/_four.css": `{
        .four {
            display: none;
        }
    }`,
    "src/_five.scss": `{
        .five {
            display: none;
        }
    }`,
    "src/six.scss": `{
        .five {
            display: none;
        }
    }`,
    "src/seven.scss": `{
        .seven {
            display: none;
        }
    }`,
    "src/seven.ts": `{
        import "./seven.scss";
        @customElement("my-seven")
        export class Seven {}
    }`,
    "src/arrow.ts": `
        export const computeDate = async (): Promise<Date> => new Date();
    `,
});

class CompilerTestClass extends Compiler {
    constructor(options: CompilerOptions) {
        super(options, testSystem);
    }

    public report(program: ts.Program, result: ts.EmitResult): ts.EmitResult {
        return super.report(program, result);
    }

    public emitSourceFile(fileName: string, target: string, writeFile: boolean): CompileFragment {
        return super.emitSourceFile(fileName, target, writeFile);
    }

    public createTargetContextsIfNecessary(): this {
        return super.createTargetContextsIfNecessary();
    }
}

class CompilerMockClass extends CompilerTestClass {}

let testObj: CompilerTestClass;
const reporter = new ReporterMock(testSystem);

beforeEach(() => {
    testObj = new CompilerTestClass({
        addons: new AddonRegistry({ addonsDir: "./addons", reporter, system: testSystem }),
        buildDir: "./src",
        project: {},
        reporter,
        targets: [],
        tsconfig: { options: {}, fileNames: [], errors: [] },
        debug: false,
        sourceMap: false,
        watch: false,
    });
});

describe("getSystem", () => {
    it("returns the system passed to options", () => {
        expect(testObj.getSystem()).toBe(testSystem);
    });
});

describe("setOptions", () => {
    it("replaces compiler options", () => {
        testObj.setOptions({
            project: {
                react: 1,
            },
        } as any);

        expect(testObj.getOptions().project).toEqual({ react: 1 });
    });
});

describe("compile", () => {
    beforeEach(() => {
        testObj = new CompilerMockClass({
            addons: new AddonRegistry({ addonsDir: "./addons", reporter, system: testSystem }),
            buildDir: "./src",
            project: {},
            reporter,
            targets: [],
            tsconfig: { options: {}, fileNames: [], errors: [] },
            debug: false,
            sourceMap: false,
            watch: false,
        });
        CompilerMockClass.prototype.report = jest.fn();
    });

    it("calls report", () => {
        const target = jest.fn();
        CompilerMockClass.prototype.report = target;

        testObj.compile();

        expect(target).toHaveBeenCalled();
    });

    it("updates the CompilerOptions with the target specific overrides", () => {
        const config: CompilationConfig = testObj.getOptions().config ?? { configFilePath: "./websmith.config.json", targets: { "*": {} } };
        const targetConfig: TargetConfig = {
            ...config.targets?.["*"],
            options: { outDir: testObj.getSystem().resolvePath("./lib/expected") },
        };
        testObj.setOptions({
            ...testObj.getOptions(),
            config: {
                ...config,
                targets: { "*": targetConfig },
            },
        });

        testObj.compile();

        expect(testObj.getContext("*")?.getConfig()).toEqual(expect.objectContaining({ options: { outDir: "/lib/expected" } }));
    });
});

describe("emitSourceFile", () => {
    it("yields modified client function w/ annotated arrow function", () => {
        testObj = testObj = new CompilerTestClass({
            addons: new AddonRegistry({ addonsDir: "./addons", reporter, system: testSystem }),
            buildDir: "./src",
            project: { declaration: true, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.Latest },
            reporter,
            targets: [],
            tsconfig: { options: {}, fileNames: ["src/arrow.ts"], errors: [] },
            debug: false,
            sourceMap: false,
            watch: false,
        }).createTargetContextsIfNecessary();

        const actual = testObj.emitSourceFile("src/arrow.ts", "*", false);

        expect(actual.files.find(file => file.name.match(/\.js(x?)$/i))!.text).toMatchInlineSnapshot(`
            "export const computeDate = async () => new Date();
            "
        `);

        expect(actual.files.find(file => file.name.match(/\.d\.ts$/i))!.text).toMatchInlineSnapshot(`
            "export declare const computeDate: () => Promise<Date>;
            "
        `);
    });
});

/// TODO: Migrate emit() tests to use compile() or compileSourceFile()?
// describe("emit", () => {
//     it("calls emit on program", () => {
//         const target = jest.fn();
//         const mockProgram = { emit: target } as any;

//         testObj.emit(mockProgram);

//         expect(target).toHaveBeenCalled();
//     });

//     it("calls emit on every generator", () => {
//         const mockProgram = {
//             emit: jest.fn().mockReturnValue({}),
//         } as any;
//         const target = jest.fn().mockReturnValue({});
//         const generator = GeneratorMock({ emit: target });
//         testObj.getContext()!.registerGenerator("docs", generator);

//         testObj.emit(mockProgram);

//         expect(target).toHaveBeenCalled();
//     });

//     it("yields message from performed generators", () => {
//         const mockProgram = {
//             emit: jest.fn().mockReturnValue({}),
//         } as any;
//         const target = jest.fn().mockReturnValue({ diagnostics: [{ messageText: "Passed" }] });
//         const generator = GeneratorMock({ emit: target });
//         testObj.getContext()!.registerGenerator("docs", generator);

//         const actual = testObj.emit(mockProgram);

//         expect(actual.diagnostics.reduce((res, cur) => (res += cur.messageText), "")).toBe("Passed");
//         expect(actual.emitSkipped).toBe(false);
//         expect(actual.emittedFiles).toEqual([]);
//     });

//     it("yields error message from generators that throws error", () => {
//         const mockProgram = {
//             emit: jest.fn().mockReturnValue({}),
//         } as any;
//         const target = jest.fn().mockImplementation(() => {
//             throw new Error("Expected");
//         });
//         const generator = GeneratorMock({ emit: target });
//         testObj.getContext()!.registerGenerator("docs", generator);

//         const actual = testObj.emit(mockProgram);

//         expect(actual.diagnostics.reduce((res, cur) => (res += cur.messageText), "")).toBe("Expected");
//         expect(actual.emitSkipped).toBe(true);
//         expect(actual.emittedFiles).toEqual([]);
//     });

//     it("yields error message from generators that throws error with one failing generators", () => {
//         const mockProgram = {
//             emit: jest.fn().mockReturnValue({}),
//         } as any;
//         const target = jest.fn().mockImplementation(() => {
//             throw new Error("Expected");
//         });
//         const generator = GeneratorMock({ emit: target });
//         testObj
//             .getContext()!
//             .registerGenerator("docs", generator)
//             .registerGenerator(
//                 "docs",
//                 (() => {
//                     const result: any = jest.fn();
//                     result.emit = jest.fn().mockReturnValue({});
//                     return result;
//                 })()
//             );

//         const actual = testObj.emit(mockProgram);

//         expect(actual.diagnostics.reduce((res, cur) => (res += cur.messageText), "")).toBe("Expected");
//         expect(actual.emitSkipped).toBe(true);
//         expect(actual.emittedFiles).toEqual([]);
//     });
// });

describe("report", () => {
    let reporter: ReporterMock;
    beforeEach(() => {
        testSystem.createDirectory("./addons");
        reporter = new ReporterMock(createSystem());
        testObj = new CompilerTestClass({
            addons: new AddonRegistry({ addonsDir: "./addons", reporter, system: testSystem }),
            buildDir: "./src",
            project: {},
            reporter,
            targets: [],
            tsconfig: { options: {}, fileNames: [], errors: [] },
            debug: false,
            sourceMap: false,
            watch: false,
        });
    });

    it("yields result's messageText", () => {
        const mockProgram = {
            getCompilerOptions: () => ({}),
            getConfigFileParsingDiagnostics: () => [],
            getGlobalDiagnostics: () => [],
            getOptionsDiagnostics: () => [],
            getSemanticDiagnostics: () => [],
            getSyntacticDiagnostics: () => [],
        } as any;
        const mockResult = {
            diagnostics: [{ messageText: "expected message1" }],
        } as any;

        testObj.report(mockProgram, mockResult);

        expect(reporter.message).toBe("Error: expected message1\n");
    });

    it("yields program's messageText", () => {
        const mockProgram = {
            getCompilerOptions: () => ({}),
            getConfigFileParsingDiagnostics: () => [{ messageText: "expected message1" }],
            getGlobalDiagnostics: () => [{ messageText: "expected message2" }],
            getOptionsDiagnostics: () => [{ messageText: "expected message3" }],
            getSemanticDiagnostics: () => [{ messageText: "expected message4" }],
            getSyntacticDiagnostics: () => [{ messageText: "expected message5" }],
        } as any;
        const mockResult = {
            diagnostics: [],
        } as any;

        testObj.report(mockProgram, mockResult);

        expect(reporter.message).toBe(
            "Error: expected message1\nError: expected message2\nError: expected message3\nError: expected message4\nError: expected message5\n"
        );
    });

    it("yields emitSkipped true", () => {
        const mockProgram = {
            getCompilerOptions: () => ({}),
            getConfigFileParsingDiagnostics: () => [],
            getGlobalDiagnostics: () => [],
            getOptionsDiagnostics: () => [],
            getSemanticDiagnostics: () => [],
            getSyntacticDiagnostics: () => [],
        } as any;
        const mockResult = {
            diagnostics: [],
            emitSkipped: true,
        } as any;

        const actual = testObj.report(mockProgram, mockResult);

        expect(actual.emitSkipped).toBe(true);
    });
});

// FIXME: Update with BrowserSystem testSystem when BrowserSystem supports watch
describe("watch", () => {
    let testObj: Compiler;

    const buildDir = join(__dirname, "__test__", "src");
    const exportedFileName = join(buildDir, "arrow.ts");
    const outDir = join(__dirname, "__test__", "lib");

    beforeEach(() => {
        exportFile(testSystem, "src/arrow.ts", exportedFileName);
    });

    afterEach(() => {
        testObj.closeAllWatchers();
        rmSync(join(__dirname, "__test__"), { recursive: true, force: true });
    });

    it("should output to buildDir w/o outDir override", async () => {
        testObj = new Compiler(
            {
                addons: new AddonRegistry({ addonsDir: "./addons", reporter, system: testSystem }),
                buildDir,
                config: { configFilePath: join(__dirname, "websmith.config.json"), targets: { "*": { writeFile: true } } },
                project: { declaration: true, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.Latest },
                reporter,
                targets: [],
                tsconfig: { options: { outDir }, fileNames: [join(__dirname, "__test__", "src", "arrow.ts")], errors: [] },
                debug: false,
                sourceMap: false,
                watch: true,
            },
            ts.sys
        );

        testObj.watch();

        expect(readFileSync(join(buildDir, "arrow.js")).toString()).toMatchInlineSnapshot(`
            "export const computeDate = async () => new Date();
            "
        `);
        expect(readFileSync(join(buildDir, "arrow.d.ts")).toString()).toMatchInlineSnapshot(`
            "export declare const computeDate: () => Promise<Date>;
            "
        `);

        writeFileSync(exportedFileName, "");

        await new Promise(resolve => setTimeout(resolve, 100));
        expect(readFileSync(join(buildDir, "arrow.js")).toString()).toBe("");
        expect(readFileSync(join(buildDir, "arrow.d.ts")).toString()).toBe("");
    });

    it("should output to outDir w/ target outDir override", async () => {
        testObj = new Compiler(
            {
                addons: new AddonRegistry({ addonsDir: "./addons", reporter, system: testSystem }),
                buildDir: ts.sys.getCurrentDirectory(),
                config: { configFilePath: join(__dirname, "websmith.config.json"), targets: { "*": { writeFile: true, options: { outDir } } } },
                project: { declaration: true, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.Latest },
                reporter,
                targets: [],
                tsconfig: { options: { outDir }, fileNames: [join(__dirname, "__test__", "src", "arrow.ts")], errors: [] },
                debug: false,
                sourceMap: false,
                watch: true,
            },
            ts.sys
        );

        testObj.watch();

        expect(readFileSync(join(outDir, "arrow.js")).toString()).toMatchInlineSnapshot(`
            "export const computeDate = async () => new Date();
            "
        `);
        expect(readFileSync(join(outDir, "arrow.d.ts")).toString()).toMatchInlineSnapshot(`
            "export declare const computeDate: () => Promise<Date>;
            "
        `);

        writeFileSync(exportedFileName, "");

        await new Promise(resolve => setTimeout(resolve, 100));
        expect(readFileSync(join(outDir, "arrow.js")).toString()).toBe("");
        expect(readFileSync(join(outDir, "arrow.d.ts")).toString()).toBe("");
    });

    it("should output to multiple targets outDir w/ multiple targets and outDir override", async () => {
        testObj = new Compiler(
            {
                addons: new AddonRegistry({ addonsDir: "./addons", reporter, system: testSystem }),
                buildDir: ts.sys.getCurrentDirectory(),
                config: {
                    configFilePath: join(__dirname, "websmith.config.json"),
                    targets: {
                        target1: { writeFile: true, options: { outDir: join(outDir, "target1") } },
                        target2: { writeFile: true, options: { outDir: join(outDir, "target2"), declaration: false } },
                    },
                },
                project: { declaration: true, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.Latest },
                reporter,
                targets: ["target1", "target2"],
                tsconfig: { options: { outDir }, fileNames: [join(__dirname, "__test__", "src", "arrow.ts")], errors: [] },
                debug: false,
                sourceMap: false,
                watch: true,
            },
            ts.sys
        );

        testObj.watch();

        expect(readFileSync(join(outDir, "target1", "arrow.js")).toString()).toMatchInlineSnapshot(`
            "export const computeDate = async () => new Date();
            "
        `);
        expect(readFileSync(join(outDir, "target1", "arrow.d.ts")).toString()).toMatchInlineSnapshot(`
            "export declare const computeDate: () => Promise<Date>;
            "
        `);
        expect(readFileSync(join(outDir, "target2", "arrow.js")).toString()).toMatchInlineSnapshot(`
            "export const computeDate = async () => new Date();
            "
        `);
        expect(existsSync(join(outDir, "target2", "arrow.d.ts"))).toBe(false);

        writeFileSync(exportedFileName, "");

        await new Promise(resolve => setTimeout(resolve, 100));
        expect(readFileSync(join(outDir, "target1", "arrow.js")).toString()).toBe("");
        expect(readFileSync(join(outDir, "target1", "arrow.d.ts")).toString()).toBe("");
        expect(readFileSync(join(outDir, "target2", "arrow.js")).toString()).toBe("");
        expect(existsSync(join(outDir, "target2", "arrow.d.ts"))).toBe(false);
    });
});

const exportFile = (testSystem: ts.System, fileName: string, exportedFileName: string) => {
    if (!testSystem.fileExists(fileName)) {
        throw new Error(`File ${fileName} does not exist`);
    }

    mkdirSync(dirname(exportedFileName), { recursive: true });
    writeFileSync(exportedFileName, testSystem.readFile(fileName)!);
};
