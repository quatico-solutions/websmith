/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import ts from "typescript";
import { ReporterMock } from "../../../test";
import { createBrowserSystem } from "../../environment";
import { CompilationContext, CompilationContextOptions } from "./CompilationContext";

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
        return this.ResultProcessors;
    }

    public getRootFiles() {
        return this.rootFiles;
    }

    public addFile(fileName: string, content: string): this {
        this.getCache().updateSource(fileName, content);
        return this;
    }
}

let testObj: CompilationContextTestClass;
let testSystem: ts.System;
let testProgram: ts.Program;

beforeEach(() => {
    testSystem = createBrowserSystem({}, ts.sys.useCaseSensitiveFileNames);
    testProgram = ts.createProgram({ options: {}, rootNames: [] });
    testObj = new CompilationContextTestClass({
        buildDir: "",
        project: {},
        projectDir: testSystem.getCurrentDirectory(),
        reporter: new ReporterMock(testSystem),
        rootFiles: [],
        system: testSystem,
        program: testProgram,
        tsconfig: { options: {}, fileNames: [], errors: [] },
        target: "test",
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
            buildDir: "",
            project: {},
            projectDir: "/expected",
            reporter: new ReporterMock(testSystem),
            rootFiles: [],
            system: testSystem,
            program: testProgram,
            tsconfig: { options: {}, fileNames: [], errors: [] },
            target: "test",
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
        expect(testObj.getCache().getCachedFile("/unexpected/test.ts")).toEqual({ files: [], version: 0 });
        expect(testSystem.readFile("/expected/one.ts")).toBe('export const expected = () => "expected";');
    });
});

describe("addVirtualFile", () => {
    it("should add file to compilation context without writing it to disk", () => {
        testObj.addVirtualFile("/unexpected/test.ts", 'export const expected = () => "expected";');

        expect(testObj.getRootFiles()).toContain("/unexpected/test.ts");
        expect(testObj.getFileContent("/unexpected/test.ts")).toBe('export const expected = () => "expected";');
        expect(testObj.getCache().getCachedFile("/unexpected/test.ts")).toEqual(expect.objectContaining({
            content: 'export const expected = () => "expected";',
            version: 1,
            snapshot: ts.ScriptSnapshot.fromString('export const expected = () => "expected";'),
        }));
        expect(testSystem.fileExists("/unexpected/test.ts")).toBe(false);
    });
});
