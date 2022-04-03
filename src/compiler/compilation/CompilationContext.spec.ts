import { ReporterMock } from "../../../test";
import { createBrowserSystem } from "../../environment";
import { CompilationContext, CompilationContextOptions } from "./CompilationContext";

class CompilationContextTestClass extends CompilationContext {
    public constructor(options: CompilationContextOptions) {
        super(options);
    }

    public getEmitTransformers() {
        return super.emitTransformers;
    }

    public getPreEmitTransformers() {
        return super.preEmitTransformers;
    }

    public getGenerators() {
        return super.generators;
    }
}

let testObj: CompilationContextTestClass;

beforeEach(() => {
    const testSystem = createBrowserSystem({});
    testObj = new CompilationContextTestClass({
        buildDir: "",
        project: {},
        reporter: new ReporterMock(testSystem),
        rootFiles: [],
        system: testSystem,
        tsconfig: { options: {}, fileNames: [], errors: [] },
    });
});

describe("registerEmitTransformer", () => {
    it("yields new transformer with before", () => {
        const target = jest.fn();

        testObj.registerEmitTransformer({ before: [target] });

        expect(testObj.getEmitTransformers().before).toEqual([target]);
    });

    it("yields new transformer with after", () => {
        const target = jest.fn();

        testObj.registerEmitTransformer({ after: [target] });

        expect(testObj.getEmitTransformers().after).toEqual([target]);
    });

    it("registers same transformer twice for same kind", () => {
        const target = jest.fn();

        testObj.registerEmitTransformer({ after: [target] }).registerEmitTransformer({ after: [target] });

        expect(testObj.getEmitTransformers().after).toEqual([target, target]);
    });

    it("registers same transformer twice for different kinds", () => {
        const target = jest.fn();

        testObj.registerEmitTransformer({ before: [target] }).registerEmitTransformer({ after: [target] });

        expect(testObj.getEmitTransformers().after).toEqual([target]);
        expect(testObj.getEmitTransformers().before).toEqual([target]);
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

describe("registerPreEmitTransformer", () => {
    it("yields new processor with valid transformer", () => {
        const target = jest.fn()();

        testObj.registerPreEmitTransformer(target);

        expect(testObj.getPreEmitTransformers()).toEqual([target]);
    });

    it("registers same transformer twice", () => {
        const target = jest.fn()();

        testObj.registerPreEmitTransformer(target).registerPreEmitTransformer(target);

        expect(testObj.getPreEmitTransformers()).toEqual([target, target]);
    });
});
