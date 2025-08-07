import {
    ServiceParameter,
    type BoundParameterValue,
    type FactorLookupPrice,
    type MultiConstantPrice,
    type ParameterValueKind,
    type TieredPrice,
} from "../api";
import { ResolvedParameterValue } from "./ResolvedParameterValue";

class ResolvedParameterValueTestClass extends ResolvedParameterValue<string> {
    constructor(options: BoundParameterValue<string>) {
        super(options);
    }

    getKind(): ParameterValueKind {
        return "text";
    }
}

describe("ResolvedParameterValue", () => {
    describe("constructor", () => {
        it("should create a new parameter value with defaults", () => {
            const testObj = new ResolvedParameterValueTestClass({
                value: "expected",
                kind: "text",
                parameterId: ServiceParameter.Id("expected"),
            });

            expect(testObj.getParameterId()).toBe("expected");
        });
    });

    describe("getParameterId", () => {
        it("should yield parameter id with provided value", () => {
            const testObj = new ResolvedParameterValueTestClass({
                value: "expected",
                kind: "text",
                parameterId: ServiceParameter.Id("expected"),
            });

            expect(testObj.getParameterId()).toEqual("expected");
        });
    });

    describe("equals", () => {
        it("should return true with same parameter values", () => {
            const testObj = new ResolvedParameterValueTestClass({
                value: "expected",
                kind: "text",
                parameterId: ServiceParameter.Id("expected"),
            });
            const other = new ResolvedParameterValueTestClass({
                value: "expected",
                kind: "text",
                parameterId: ServiceParameter.Id("expected"),
            });

            expect(testObj.equals(other)).toBe(true);
        });

        it("should return false with different parameterId", () => {
            const testObj = new ResolvedParameterValueTestClass({
                value: "same",
                kind: "text",
                parameterId: ServiceParameter.Id("other"),
            });

            const other = new ResolvedParameterValueTestClass({
                value: "same",
                kind: "text",
                parameterId: ServiceParameter.Id("different"),
            });

            expect(testObj.equals(other)).toBe(false);
        });

        it("should return false with different value", () => {
            const testObj = new ResolvedParameterValueTestClass({
                value: "other",
                kind: "text",
                parameterId: ServiceParameter.Id("same"),
            });

            const other = new ResolvedParameterValueTestClass({
                value: "different",
                kind: "text",
                parameterId: ServiceParameter.Id("same"),
            });

            expect(testObj.equals(other)).toBe(false);
        });

        it("should return false with different kind", () => {
            const testObj = new ResolvedParameterValueTestClass({
                value: "same",
                kind: "text",
                parameterId: ServiceParameter.Id("same"),
            });

            const other = new ResolvedParameterValueTestClass({
                value: "same",
                kind: "boolean",
                parameterId: ServiceParameter.Id("same"),
            });

            expect(testObj.equals(other)).toBe(false);
        });

        it("should return false with null other", () => {
            const testObj = new ResolvedParameterValueTestClass({
                value: "expected",
                kind: "text",
                parameterId: ServiceParameter.Id("expected"),
            });

            expect(testObj.equals(null as unknown as ResolvedParameterValue<string>)).toBe(false);
        });
    });

    describe("getPrice", () => {
        it("should return price with provided constant price", () => {
            const testObj = new ResolvedParameterValueTestClass({
                value: "expected",
                kind: "text",
                parameterId: ServiceParameter.Id("expected"),
                price: 100,
            });

            expect(testObj.getPrice()).toEqual({
                type: "constant",
                amount: 100,
            });
        });

        it("should return price with provided lookup factor price", () => {
            const testObj = new ResolvedParameterValueTestClass({
                value: "expected",
                kind: "text",
                parameterId: ServiceParameter.Id("expected"),
                price: {
                    type: "factor-lookup",
                    amount: 100,
                    reference: ServiceParameter.Id("other"),
                    factors: {
                        other: 1,
                    },
                } as FactorLookupPrice,
            });

            expect(testObj.getPrice()).toEqual({
                type: "factor-lookup",
                amount: 100,
                reference: ServiceParameter.Id("other"),
                factors: {
                    other: 1,
                },
            });
        });

        it("should return price with provided multi-constant price", () => {
            const testObj = new ResolvedParameterValueTestClass({
                value: "expected",
                kind: "text",
                parameterId: ServiceParameter.Id("expected"),
                price: {
                    type: "multi-constant",
                    valueMap: {
                        one: 1,
                        two: 2,
                    },
                } as MultiConstantPrice,
            });

            expect(testObj.getPrice()).toEqual({
                type: "multi-constant",
                amount: 0,
                valueMap: { one: 1, two: 2 },
            });
        });

        it("should return price with provided tiered price", () => {
            const testObj = new ResolvedParameterValueTestClass({
                value: "expected",
                kind: "text",
                parameterId: ServiceParameter.Id("expected"),
                price: {
                    type: "tiered",
                    amount: 100,
                    tiers: [
                        {
                            gt: 0,
                            price: 100,
                        },
                    ],
                } as TieredPrice,
            });

            expect(testObj.getPrice()).toEqual({
                type: "tiered",
                amount: 100,
                tiers: [
                    {
                        gt: 0,
                        lte: Infinity,
                        price: 100,
                    },
                ],
            });
        });
    });

    describe("getValue", () => {
        it("should return value with provided value", () => {
            const testObj = new ResolvedParameterValueTestClass({
                value: "expected",
                kind: "text",
                parameterId: ServiceParameter.Id("expected"),
            });

            expect(testObj.getValue()).toEqual("expected");
        });

        it("should return undefined with no value", () => {
            const testObj = new ResolvedParameterValueTestClass({
                kind: "text",
                parameterId: ServiceParameter.Id("expected"),
            });

            expect(testObj.getValue()).toBeUndefined();
        });

        it("should return updated value with setValue", () => {
            const testObj = new ResolvedParameterValueTestClass({
                value: "whatever",
                kind: "text",
                parameterId: ServiceParameter.Id("expected"),
            });

            testObj.setValue("expected");

            expect(testObj.getValue()).toEqual("expected");
        });
    });
});
