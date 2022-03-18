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
import { ReporterMock } from "../../__mocks__";
import { createBrowserSystem } from "../../environment";
import { AddonRegistry } from "./AddonRegistry";

let testObj: AddonRegistry;

beforeEach(() => {
    const testSystem = createBrowserSystem();
    testObj = new AddonRegistry({ configPath: "tsconfig.json" }, new ReporterMock(testSystem), testSystem);
});

describe("constructor", () => {
    it("returns empty generators and transformers by default", () => {
        expect(testObj.transformers).toEqual({});
        expect(testObj.generators).toEqual({});
    });
});

describe("registerTransformer", () => {
    it("yields new transformer with before", () => {
        const target = jest.fn();

        testObj.registerTransformer("before", target);

        expect(testObj.transformers.before).toEqual([target]);
    });

    it("yields new transformer with after", () => {
        const target = jest.fn();

        testObj.registerTransformer("after", target);

        expect(testObj.transformers.after).toEqual([target]);
    });

    it("registers same transformer twice for same kind", () => {
        const target = jest.fn();

        testObj.registerTransformer("after", target).registerTransformer("after", target);

        expect(testObj.transformers.after).toEqual([target, target]);
    });

    it("registers same transformer twice for different kinds", () => {
        const target = jest.fn();

        testObj.registerTransformer("before", target).registerTransformer("after", target);

        expect(testObj.transformers.after).toEqual([target]);
        expect(testObj.transformers.before).toEqual([target]);
    });
});

describe("registerGenerator", () => {
    it("yields new generator with docs", () => {
        const target = (() => {
            const result: any = jest.fn();
            result.emit = jest.fn();
            return result;
        })();

        testObj.registerGenerator("docs", target);

        expect(testObj.generators.docs).toEqual([target]);
    });

    it("yields new generator with source", () => {
        const target = (() => {
            const result: any = jest.fn();
            result.emit = jest.fn();
            return result;
        })();

        testObj.registerGenerator("source", target);

        expect(testObj.generators.source).toEqual([target]);
    });

    it("registers same generator twice for same kind", () => {
        const target = (() => {
            const result: any = jest.fn();
            result.emit = jest.fn();
            return result;
        })();

        testObj.registerGenerator("source", target).registerGenerator("source", target);

        expect(testObj.generators.source).toEqual([target, target]);
    });

    it("registers same generator twice for different kinds", () => {
        const target = (() => {
            const result: any = jest.fn();
            result.emit = jest.fn();
            return result;
        })();

        testObj.registerGenerator("docs", target).registerGenerator("source", target);

        expect(testObj.generators.docs).toEqual([target]);
        expect(testObj.generators.source).toEqual([target]);
    });
});

describe("registerProcessor", () => {
    it("yields new processor with element", () => {
        const target = jest.fn()();

        testObj.registerProcessor("element", target);

        expect(testObj.processors.element).toEqual([target]);
    });

    it("yields new transformer with styles", () => {
        const target = jest.fn()();

        testObj.registerProcessor("styles", target);

        expect(testObj.processors.styles).toEqual([target]);
    });

    it("registers same transformer twice for same kind", () => {
        const target = jest.fn()();

        testObj.registerProcessor("styles", target).registerProcessor("styles", target);

        expect(testObj.processors.styles).toEqual([target, target]);
    });

    it("registers same transformer twice for different kinds", () => {
        const target = jest.fn()();

        testObj.registerProcessor("element", target).registerProcessor("styles", target);

        expect(testObj.processors.element).toEqual([target]);
        expect(testObj.processors.styles).toEqual([target]);
    });
});
