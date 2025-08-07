import { ServiceParameter } from "../../configuration";
import {
    type BoundDiscreteValue,
    type BoundParameterValue,
    type BoundRangeValue,
    type BoundTextValue,
} from "../../parameter-values";
import { createBoundParameterPrice } from "./ParameterPrice";

describe("resolveParameterPrice", () => {
    describe("BooleanValue", () => {
        it("should return undefined with boolean value but no price", () => {
            const target: BoundParameterValue = {
                parameterId: ServiceParameter.Id("target"),
                kind: "boolean",
            };

            const actual = createBoundParameterPrice(target);

            expect(actual).toBeUndefined();
        });

        it("should return price with boolean value and price", () => {
            const target: BoundParameterValue = {
                parameterId: ServiceParameter.Id("target"),
                kind: "boolean",
                price: 100,
            };

            const actual = createBoundParameterPrice(target);

            expect(actual).toEqual({
                amount: 100,
                type: "constant",
            });
        });

        it("should return price with boolean value, price and value", () => {
            const target: BoundParameterValue = {
                parameterId: ServiceParameter.Id("target"),
                kind: "boolean",
                price: 100,
                value: true,
            };

            const actual = createBoundParameterPrice(target);

            expect(actual).toEqual({
                amount: 100,
                type: "constant",
            });
        });
    });

    describe("DiscreteValue", () => {
        it("should return undefined with discrete value but no price", () => {
            const target: BoundDiscreteValue = {
                parameterId: ServiceParameter.Id("target"),
                kind: "discrete",
                options: [],
            };

            const actual = createBoundParameterPrice(target);

            expect(actual).toBeUndefined();
        });

        it("should return undefined with discrete value and options without price", () => {
            const target: BoundDiscreteValue = {
                parameterId: ServiceParameter.Id("target"),
                kind: "discrete",
                options: [
                    {
                        label: "option1",
                        value: "option1",
                    },
                ],
            };

            const actual = createBoundParameterPrice(target);

            expect(actual).toBeUndefined();
        });

        it("should return price with discrete value and single option with price", () => {
            const target: BoundDiscreteValue = {
                parameterId: ServiceParameter.Id("target"),
                kind: "discrete",
                options: [
                    {
                        label: "option1",
                        value: "option1",
                        price: 100,
                    },
                ],
            };

            const actual = createBoundParameterPrice(target);

            expect(actual).toEqual({
                valueMap: {
                    option1: 100,
                },
                type: "multi-constant",
            });
        });

        it("should return price with discrete value and multiple options with price", () => {
            const target: BoundDiscreteValue = {
                parameterId: ServiceParameter.Id("target"),
                kind: "discrete",
                options: [
                    {
                        label: "option1",
                        value: "option1",
                        price: 100,
                    },
                    {
                        label: "option2",
                        value: "option2",
                        price: 200,
                    },
                ],
            };

            const actual = createBoundParameterPrice(target);

            expect(actual).toEqual({
                valueMap: {
                    option1: 100,
                    option2: 200,
                },
                type: "multi-constant",
            });
        });

        it("should return price with discrete value and multiple options with price and value", () => {
            const target: BoundDiscreteValue = {
                parameterId: ServiceParameter.Id("target"),
                kind: "discrete",
                options: [
                    {
                        label: "option1",
                        value: "option1",
                        price: 100,
                    },
                    {
                        label: "option2",
                        value: "option2",
                        price: 200,
                    },
                ],
                value: "option1",
            };

            const actual = createBoundParameterPrice(target);

            expect(actual).toEqual({
                valueMap: {
                    option1: 100,
                    option2: 200,
                },
                type: "multi-constant",
            });
        });
    });

    describe("RangeValue", () => {
        it("should return undefined with range value but no price", () => {
            const actual = createBoundParameterPrice({
                parameterId: ServiceParameter.Id("target"),
                kind: "range",
            });

            expect(actual).toBeUndefined();
        });

        it("should return price with range value and price", () => {
            const target: BoundRangeValue = {
                parameterId: ServiceParameter.Id("target"),
                kind: "range",
                price: 100,
            };

            const actual = createBoundParameterPrice(target);

            expect(actual).toEqual({
                amount: 100,
                type: "constant",
            });
        });

        it("should return price with range value and price and value", () => {
            const target: BoundRangeValue = {
                parameterId: ServiceParameter.Id("target"),
                kind: "range",
                price: 100,
            };

            const actual = createBoundParameterPrice(target);

            expect(actual).toEqual({
                amount: 100,
                type: "constant",
            });
        });
    });

    describe("TextValue", () => {
        it("should return undefined with text value but no price", () => {
            const actual = createBoundParameterPrice({
                parameterId: ServiceParameter.Id("target"),
                kind: "text",
            });

            expect(actual).toBeUndefined();
        });

        it("should return price with text value and price", () => {
            const target: BoundTextValue = {
                parameterId: ServiceParameter.Id("target"),
                kind: "text",
                price: 100,
            };

            const actual = createBoundParameterPrice(target);

            expect(actual).toEqual({
                amount: 100,
                type: "constant",
            });
        });

        it("should return price with text value and price and value", () => {
            const target: BoundTextValue = {
                parameterId: ServiceParameter.Id("target"),
                kind: "text",
                price: 100,
                value: "test",
            };

            const actual = createBoundParameterPrice(target);

            expect(actual).toEqual({
                amount: 100,
                type: "constant",
            });
        });
    });
});
