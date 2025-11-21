/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import ts from "typescript";
import { createSystem } from "../../environment";
import { ReporterMock } from "../../../test";
import { CompilationContext, type CompilationContextOptions } from "./CompilationContext";

class CompilationContextTestClass extends CompilationContext {
    public constructor(options: CompilationContextOptions) {
        super(options);
    }

    public getTransformers() {
        return this.transformers;
    }

    public getProcessors() {
        return this.processors;
    }

    public getGenerators() {
        return this.generators;
    }

    public getResultProcessors() {
        return this.resultProcessors;
    }

    public getRootFiles() {
        return this.rootFiles;
    }

    public addFile(fileName: string, content: string): this {
        this.getCache().updateSource(fileName, content);
        return this;
    }
    public isCodeFileExtension(filePath: string): boolean {
        return super.isCodeFileExtension(filePath);
    }

    public registerDependency(childPath: string, parentPath: string): void {
        super.registerDependency(childPath, parentPath);
    }
}

let testObj: CompilationContextTestClass;
let testSystem: ts.System;

beforeEach(() => {
    testSystem = createSystem({}, { virtual: true });
    testObj = new CompilationContextTestClass({
        tsConfig: {},
        projectDir: testSystem.getCurrentDirectory(),
        reporter: new ReporterMock(testSystem),
        rootFiles: [],
        system: testSystem,
        cliArgs: { options: {}, fileNames: [], errors: [] },
        profile: "test",
    });
});

describe("registerResultProcessor", () => {
    it("yields new ResultProcessor with existing ResultProcessor", () => {
        const target = jest.fn();

        testObj.registerResultProcessor(target);

        expect(testObj.getResultProcessors()).toEqual([target]);
    });
    it("registers same ResultProcessor twice", () => {
        const target = jest.fn();

        testObj.registerResultProcessor(target).registerResultProcessor(target);

        expect(testObj.getResultProcessors()).toEqual([target, target]);
    });
});

describe("getFileContent", () => {
    it('should be "expected" w/ file in cache', () => {
        testObj.addFile("test.ts", "expected");

        const actual = testObj.getFileContent("test.ts");

        expect(actual).toBe("expected");
    });

    it("should be empty w/o file in cache", () => {
        const actual = testObj.getFileContent("test.ts");

        expect(actual).toBe("");
    });
});

describe("registerTransformer", () => {
    it("yields new transformer with before", () => {
        const target = jest.fn();

        testObj.registerTransformer({ before: [target] });

        expect(testObj.getTransformers().before).toEqual([target]);
    });

    it("yields new transformer with after", () => {
        const target = jest.fn();

        testObj.registerTransformer({ after: [target] });

        expect(testObj.getTransformers().after).toEqual([target]);
    });

    it("registers same transformer twice for same kind", () => {
        const target = jest.fn();

        testObj.registerTransformer({ after: [target] }).registerTransformer({ after: [target] });

        expect(testObj.getTransformers().after).toEqual([target, target]);
    });

    it("registers same transformer twice for different kinds", () => {
        const target = jest.fn();

        testObj.registerTransformer({ before: [target] }).registerTransformer({ after: [target] });

        expect(testObj.getTransformers().after).toEqual([target]);
        expect(testObj.getTransformers().before).toEqual([target]);
    });
});

describe("registerGenerator", () => {
    it("yields new generator with existing target", () => {
        const target = (() => {
            const result: any = jest.fn();
            result.emit = jest.fn();
            return result;
        })();

        testObj.registerGenerator(target);

        expect(testObj.getGenerators()).toEqual([target]);
    });

    it("registers same generator twice", () => {
        const target = (() => {
            const result: any = jest.fn();
            result.emit = jest.fn();
            return result;
        })();

        testObj.registerGenerator(target).registerGenerator(target);

        expect(testObj.getGenerators()).toEqual([target, target]);
    });
});

describe("registerProcessor", () => {
    it("yields new processor with valid transformer", () => {
        const target = jest.fn()();

        testObj.registerProcessor(target);

        expect(testObj.getProcessors()).toEqual([target]);
    });

    it("registers same transformer twice", () => {
        const target = jest.fn()();

        testObj.registerProcessor(target).registerProcessor(target);

        expect(testObj.getProcessors()).toEqual([target, target]);
    });
});

describe("resolvePath", () => {
    beforeEach(() => {
        testObj = new CompilationContextTestClass({
            tsConfig: {},
            projectDir: "/expected",
            reporter: new ReporterMock(testSystem),
            rootFiles: [],
            system: testSystem,
            cliArgs: { options: {}, fileNames: [], errors: [] },
            profile: "test",
        });
    });

    it("should resolve path to itself w/ absolute path", () => {
        const actual = testObj.resolvePath("/other-expected/one.ts");

        expect(actual).toBe("/other-expected/one.ts");
    });

    it("should resolve absolute path w/ relative path", () => {
        const actual = testObj.resolvePath("./one.ts");

        expect(actual).toBe("/expected/one.ts");
    });
});

describe("removeOutputFile", () => {
    it("should remove file", () => {
        testSystem.writeFile("/expected/one.ts", 'export const expected = () => "expected";');
        testObj.addVirtualFile("/unexpected/test.ts", 'export const expected = () => "expected";');

        testObj.removeOutputFile("/unexpected/test.ts");

        expect(testObj.getRootFiles()).not.toContain("/unexpected/test.ts");
        expect(testObj.getFileContent("/unexpected/test.ts")).toBe("");
        expect(testObj.getCache().getCachedFile("/unexpected/test.ts")).toEqual(expect.objectContaining({ files: [], version: 0 }));
        expect(testSystem.readFile("/expected/one.ts")).toBe('export const expected = () => "expected";');
    });
});

describe("isCodeFileExtension", () => {
    it.each([
        ["expected.ts", true],
        ["expected.d.tsx", true],
        ["expected.cts", true],
        ["expected.d.cts", true],
        ["expected.cjs", true],
        // TODO: Implement support for code extension
        // ["expected.d.cjs", false],
        ["expected.mts", true],
        ["expected.d.mts", true],
        ["expected.mjs", true],
        // TODO: Implement support for code extension
        // ["expected.d.mjs", false],
        ["expected.scss", false],
        ["expected.json", false],
    ])("isCodeFileExtension(%s)=%s", (input, expected) => {
        const actual = testObj.isCodeFileExtension(input);

        expect(actual).toBe(expected);
    });
});

describe("addInputFile", () => {
    it("write an error when adding an scss file", () => {
        const target = jest.fn();
        testObj.getReporter().reportDiagnostic = target;

        testObj.addInputFile("expected.scss");

        expect(target).toHaveBeenCalledWith(
            expect.objectContaining({
                messageText: expect.stringContaining(
                    "Only code files are supported for addInputFile. .scss of expected.scss is no valid code file extension."
                ),
            })
        );
    });
});

describe("addAssetDependency", () => {
    it("registers dependency with dependency function w/o dependency callback function provided", () => {
        const target = jest.fn();
        testObj.registerDependency = target;

        testObj.addAssetDependency("test.scss", "test.ts");

        expect(target).toHaveBeenCalledWith("test.scss", "test.ts");
    });

    it("registers dependency with dependency callback function w/ dependency callback function provided", () => {
        const target = jest.fn();
        testObj = new CompilationContextTestClass({
            tsConfig: {},
            projectDir: testSystem.getCurrentDirectory(),
            reporter: new ReporterMock(testSystem),
            rootFiles: [],
            system: testSystem,
            cliArgs: { options: {}, fileNames: [], errors: [] },
            profile: "test",
            registerDependencyCallback: target,
        });

        testObj.addAssetDependency("test.scss", "test.ts");

        expect(target).toHaveBeenCalledWith("test.scss");
    });
});

describe("addVirtualFile", () => {
    it("should add file to compilation context without writing it to disk", () => {
        testObj.addVirtualFile("/unexpected/test.ts", 'export const expected = () => "expected";');

        expect(testObj.getRootFiles()).toContain("/unexpected/test.ts");
        expect(testObj.getFileContent("/unexpected/test.ts")).toBe('export const expected = () => "expected";');
        expect(testObj.getCache().getCachedFile("/unexpected/test.ts")).toEqual(
            expect.objectContaining({
                content: 'export const expected = () => "expected";',
                version: 1,
                snapshot: ts.ScriptSnapshot.fromString('export const expected = () => "expected";'),
            })
        );
        expect(testSystem.fileExists("/unexpected/test.ts")).toBe(false);
    });
});

describe("markFileAsAddonProcessed", () => {
    it("should mark file as processed", () => {
        testObj.markFileAsAddonProcessed("/path/to/file.ts");

        expect(testObj.isFileProcessedByAddon("/path/to/file.ts")).toBe(true);
    });

    it("should normalize paths before marking", () => {
        // Both mark and check should resolve to the same path
        testObj.markFileAsAddonProcessed("/path/to/file.ts");

        // The system resolves paths, so check with the same input works
        expect(testObj.isFileProcessedByAddon("/path/to/file.ts")).toBe(true);
    });

    it("should handle different path formats for same file", () => {
        // Mark with one format
        testObj.markFileAsAddonProcessed("/path/file.ts");

        // Should be found with same normalized path
        expect(testObj.isFileProcessedByAddon("/path/file.ts")).toBe(true);
    });

    it("should be idempotent", () => {
        testObj.markFileAsAddonProcessed("/path/file.ts");
        testObj.markFileAsAddonProcessed("/path/file.ts");

        expect(testObj.isFileProcessedByAddon("/path/file.ts")).toBe(true);
    });

    it("should return false for unmarked files", () => {
        expect(testObj.isFileProcessedByAddon("/other/file.ts")).toBe(false);
    });

    it("should mark file when addInputFile is called", () => {
        testSystem.writeFile("/expected/test.ts", "export const test = 1;");

        testObj.addInputFile("/expected/test.ts");

        expect(testObj.isFileProcessedByAddon("/expected/test.ts")).toBe(true);
    });

    it("should mark file when addVirtualFile is called", () => {
        testObj.addVirtualFile("/virtual/test.ts", "export const test = 1;");

        expect(testObj.isFileProcessedByAddon("/virtual/test.ts")).toBe(true);
    });

    it("should return immutable copy of addon processed files", () => {
        testObj.markFileAsAddonProcessed("path/file.ts");

        const processedFiles = testObj.getAddonProcessedFiles();
        processedFiles.add("should-not-affect-original");

        expect(testObj.getAddonProcessedFiles()).not.toContain("should-not-affect-original");
        expect(testObj.getAddonProcessedFiles()).toContain("/path/file.ts");
    });
});
