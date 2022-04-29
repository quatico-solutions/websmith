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
import { ReporterMock } from "../../../test";
import { createBrowserSystem } from "../../environment";
import { CompilationContext, CompilationContextOptions } from "./CompilationContext";
import ts from "typescript";

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

    public addFile(fileName: string, content: string): this {
        this.getCache().updateSource(fileName, content);
        return this;
    }
}

let testObj: CompilationContextTestClass;

beforeEach(() => {
    const testSystem = createBrowserSystem({});
    const testProgram = ts.createProgram({ options: {}, rootNames: [] });
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
