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
import { ReporterMock } from "../../test";
import { createBrowserSystem, createSystem } from "../environment";
import { AddonRegistry } from "./addons";
import { Compiler } from "./Compiler";
import { CompilerOptions } from "./CompilerOptions";

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
    constructor(options: CompilerOptions) {
        super(options, testSystem);
    }

    public report(program: ts.Program, result: ts.EmitResult): ts.EmitResult {
        return super.report(program, result);
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

// FIXME: Test watch mode
describe.skip("watch", () => {
    it("should", () => {
        testObj.watch();
    });
});
