/*
 * @license
 *
 * Copyright (c) 2017-2022 Quatico Solutions AG
 * Förrlibuckstrasse 220, 8005 Zurich, Switzerland
 *
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Quatico Solutions AG, ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Quatico.
 */
/* eslint-disable jest/no-mocks-import */
import ts from "typescript";
import { GeneratorMock, ReporterMock } from "../__mocks__";
import { createBrowserSystem, createSystem } from "../environment";
import { CompilerOptions } from "../model";
import { CustomGenerators } from "./addon-registry";
import { Compiler } from "./Compiler";
import { Project } from "./Parser";

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
});

class CompilerTestClass extends Compiler {
    public project?: Project;

    constructor(options: CompilerOptions) {
        options.system = testSystem;
        super(options);
    }
    public parse(fileNames?: string[]): Project {
        this.project = super.parse(fileNames ?? []);
        return this.project!;
    }
    public emit(program: ts.Program): ts.EmitResult {
        return super.emit(program);
    }
    public report(program: ts.Program, result: ts.EmitResult): ts.EmitResult {
        return super.report(program, result);
    }
    public getTransformers(program: ts.Program): ts.CustomTransformers {
        return super.getTransformers(program);
    }
    public getGenerators(): CustomGenerators {
        return super.getGenerators();
    }
}

class CompilerMockClass extends CompilerTestClass {}

let testObj: CompilerTestClass;

beforeEach(() => {
    testObj = new CompilerTestClass({ configPath: "tsconfig.json", reporter: new ReporterMock(testSystem) });
});

describe("Constructor", () => {
    it("parses tsconfig.json and yields options", () => {
        expect(testObj.getOptions()).toEqual({
            configFilePath: "/tsconfig.json",
            outDir: "/.build",
            target: 99,
        });
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
            react: 1,
        });

        expect(testObj.getOptions()).toEqual({ react: 1 });
    });
});

describe("parse", () => {
    it("yields filePaths matching tsconfig.json constraints without '.json' and '.js'", () => {
        const { filePaths } = testObj.parse();

        expect(filePaths).toEqual([
            "src/two.ts",
            "src/three.tsx",
            "src/seven.ts",
            "src/_four.css",
            "src/_five.scss",
            "src/six.scss",
            "src/seven.scss",
        ]);
    });

    it("yields program w/ root file names matching tsconfig.json constraints", () => {
        const { program } = testObj.parse();

        expect(program.getRootFileNames()).toEqual([
            "src/two.ts",
            "src/three.tsx",
            "src/seven.ts",
            "src/_four.css",
            "src/_five.scss",
            "src/six.scss",
            "src/seven.scss",
        ]);
    });

    it("yields program w/ source files matching tsconfig.json constraints", () => {
        const { program } = testObj.parse();

        expect(
            program
                .getSourceFiles()
                .filter(cur => !cur.fileName.endsWith(".d.ts")) // ignore library files
                .map(cur => cur.fileName)
        ).toEqual(["src/two.ts", "src/three.tsx", "src/seven.ts"]);
    });
});

describe("compile", () => {
    beforeEach(() => {
        testObj = new CompilerMockClass({ configPath: "tsconfig.json" });
        CompilerMockClass.prototype.parse = jest.fn().mockReturnValue({ program: {}, stylePaths: [] });
        CompilerMockClass.prototype.emit = jest.fn();
        CompilerMockClass.prototype.report = jest.fn();
    });

    it("calls parse with no files once", () => {
        const target = jest.fn().mockReturnValue({ program: {}, stylePaths: [] });
        CompilerMockClass.prototype.parse = target;

        testObj.compile();

        expect(target).toHaveBeenCalledTimes(1);
    });

    it("calls parse with files from arguments", () => {
        const target = jest.fn().mockReturnValue({ program: {}, stylePaths: [] });
        CompilerMockClass.prototype.parse = target;

        testObj.compile("one.ts", "two.ts");

        expect(target).toHaveBeenCalledWith(["one.ts", "two.ts"]);
    });

    it("calls emit", () => {
        const target = jest.fn();
        CompilerMockClass.prototype.emit = target;

        testObj.compile();

        expect(target).toHaveBeenCalled();
    });

    it("calls report", () => {
        const target = jest.fn();
        CompilerMockClass.prototype.report = target;

        testObj.compile();

        expect(target).toHaveBeenCalled();
    });
});

describe("emit", () => {
    it("calls emit on program", () => {
        const target = jest.fn();
        const mockProgram = { emit: target } as any;

        testObj.emit(mockProgram);

        expect(target).toHaveBeenCalled();
    });

    it("calls emit on every generator", () => {
        const mockProgram = {
            emit: jest.fn().mockReturnValue({}),
        } as any;
        const target = jest.fn().mockReturnValue({});
        const generator = GeneratorMock({ emit: target });
        testObj.getAddonRegistry().registerGenerator("docs", generator);

        testObj.emit(mockProgram);

        expect(target).toHaveBeenCalled();
    });

    it("yields message from performed generators", () => {
        const mockProgram = {
            emit: jest.fn().mockReturnValue({}),
        } as any;
        const target = jest.fn().mockReturnValue({ diagnostics: [{ messageText: "Passed" }] });
        const generator = GeneratorMock({ emit: target });
        testObj.getAddonRegistry().registerGenerator("docs", generator);

        const actual = testObj.emit(mockProgram);

        expect(actual.diagnostics.reduce((res, cur) => (res += cur.messageText), "")).toBe("Passed");
        expect(actual.emitSkipped).toBe(false);
        expect(actual.emittedFiles).toEqual([]);
    });

    it("yields error message from generators that throws error", () => {
        const mockProgram = {
            emit: jest.fn().mockReturnValue({}),
        } as any;
        const target = jest.fn().mockImplementation(() => {
            throw new Error("Expected");
        });
        const generator = GeneratorMock({ emit: target });
        testObj.getAddonRegistry().registerGenerator("docs", generator);

        const actual = testObj.emit(mockProgram);

        expect(actual.diagnostics.reduce((res, cur) => (res += cur.messageText), "")).toBe("Expected");
        expect(actual.emitSkipped).toBe(true);
        expect(actual.emittedFiles).toEqual([]);
    });

    it("yields error message from generators that throws error with one failing generators", () => {
        const mockProgram = {
            emit: jest.fn().mockReturnValue({}),
        } as any;
        const target = jest.fn().mockImplementation(() => {
            throw new Error("Expected");
        });
        const generator = GeneratorMock({ emit: target });
        testObj
            .getAddonRegistry()
            .registerGenerator("docs", generator)
            .registerGenerator(
                "docs",
                (() => {
                    const result: any = jest.fn();
                    result.emit = jest.fn().mockReturnValue({});
                    return result;
                })()
            );

        const actual = testObj.emit(mockProgram);

        expect(actual.diagnostics.reduce((res, cur) => (res += cur.messageText), "")).toBe("Expected");
        expect(actual.emitSkipped).toBe(true);
        expect(actual.emittedFiles).toEqual([]);
    });
});

describe("report", () => {
    let reporter: ReporterMock;
    beforeEach(() => {
        reporter = new ReporterMock(createSystem());
        testObj = new CompilerTestClass({ configPath: "tsconfig.json", reporter });
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

describe("getGenerators", () => {
    it("returns transformer from registered generators", () => {
        const target = GeneratorMock();
        testObj.getAddonRegistry().registerGenerator("docs", target);

        expect(testObj.getGenerators()).toEqual({ docs: [target] });
    });

    it("returns transformer from two registered generators", () => {
        const target = GeneratorMock();
        testObj
            .getAddonRegistry()
            .registerGenerator("docs", target)
            .registerGenerator("docs", target);

        expect(testObj.getGenerators()).toEqual({ docs: [target, target] });
    });

    it("returns transformers with registered transformer and generators", () => {
        const generator = GeneratorMock();
        const transformer = jest.fn();
        testObj
            .getAddonRegistry()
            .registerGenerator("docs", generator)
            .registerTransformer("before", transformer);

        expect(testObj.getGenerators()).toEqual({ docs: [generator] });
    });
});

describe("getTransformers", () => {
    it("returns transformers with registered transformer", () => {
        const mockProgram = { emit: jest.fn() } as any;
        const target = jest.fn();
        testObj.getAddonRegistry().registerTransformer("before", target);

        expect(testObj.getTransformers(mockProgram).before).toContain(target);
    });

    it("returns transformers and generator transformers with registered transformer and generators", () => {
        const mockProgram = { emit: jest.fn() } as any;
        const generator = GeneratorMock();
        const transformer = jest.fn();
        testObj
            .getAddonRegistry()
            .registerGenerator("docs", generator)
            .registerTransformer("before", transformer);

        const actual = testObj.getTransformers(mockProgram).before!;

        expect(actual).toHaveLength(4);
    });
});

// FIXME: Test watch mode
describe.skip("watch", () => {
    it("should", () => {
        testObj.watch();
    });
});
