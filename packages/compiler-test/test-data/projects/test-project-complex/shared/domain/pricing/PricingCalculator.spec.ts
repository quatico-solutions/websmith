import {
    type BoundBooleanValue,
    type BoundDiscreteValue,
    type BoundRangeValue,
    type ConstantPrice,
    ServiceParameter,
    ServiceParameterGroup,
} from "../api";
import { ServiceParameterEntity, ServiceParameterGroupEntity } from "../configuration";
import {
    ResolvedDiscreteValue,
    type ResolvedParameterValue,
    ResolvedRangeValue,
    ResolvedTextValue,
    resolveParameterValue,
} from "../parameter-values";
import { FactorLookupValue, ResolvedFactorLookupPrice } from "./parameter-price";
import { PriceModelValue } from "./PriceModelValue";
import { PricingCalculator } from "./PricingCalculator";

describe("PricingCalculator", () => {
    describe("getParameterValue", () => {
        class PricingCalculatorTestClass extends PricingCalculator {
            public getParameterValue<VALUE>(
                parameterId: ServiceParameter.Id,
                selectedParameterValues: ResolvedParameterValue<VALUE>[]
            ): ResolvedParameterValue<VALUE> {
                return super.getParameterValue<VALUE>(parameterId, selectedParameterValues);
            }
        }

        it("should return parameter value with single parameter value", () => {
            const expected = new ResolvedTextValue({
                value: "Option 1",
                parameterId: ServiceParameter.Id("target-parameter-id"),
            });

            const actual = new PricingCalculatorTestClass(
                new PriceModelValue({
                    parameterGroups: [
                        ServiceParameterGroupEntity.create({
                            id: ServiceParameterGroup.Id("whatever"),
                            name: "whatever",
                            parameters: [
                                ServiceParameterEntity.create({
                                    id: ServiceParameter.Id("target-parameter-id"),
                                    name: "target-parameter-id",
                                    value: expected,
                                }),
                            ],
                        }),
                    ],
                })
            ).getParameterValue(expected.getParameterId(), [expected]);

            expect(actual).toEqual(expected);
        });

        it("should throw an error with no parameter values", () => {
            expect(() =>
                new PricingCalculatorTestClass(
                    new PriceModelValue({
                        parameterGroups: [],
                    })
                ).getParameterValue(ServiceParameter.Id("target-parameter-id"), [])
            ).toThrow("Parameter value not found for parameter ID: 'target-parameter-id'");
        });
    });

    describe("calculatePrice", () => {
        it("should return price with price model, constant price value and parameter value", () => {
            const target: ConstantPrice = { type: "constant", amount: 10 };
            const parameterValue: BoundRangeValue = {
                parameterId: ServiceParameter.Id("target-parameter-id"),
                kind: "range",
                price: target,
            };

            const testObj = new PricingCalculator(
                new PriceModelValue({
                    parameterGroups: [
                        ServiceParameterGroupEntity.create({
                            id: ServiceParameterGroup.Id("whatever"),
                            name: "whatever",
                            parameters: [
                                ServiceParameterEntity.create({
                                    id: ServiceParameter.Id("target-parameter-id"),
                                    name: "target-parameter-id",
                                    value: parameterValue,
                                }),
                            ],
                        }),
                    ],
                })
            );

            const actual = testObj.calculatePrice([resolveParameterValue(parameterValue)]);

            expect(actual.getSubTotal()).toBe(10);
        });

        it("should return price with price model, constant price function and parameter value", () => {
            const target: ConstantPrice = {
                type: "constant",
                priceFn: value => (typeof value === "number" ? value * 10 : 0),
            };
            const parameterValue: BoundRangeValue = {
                parameterId: ServiceParameter.Id("target-parameter-id"),
                kind: "range",
                value: 100, // Used as input for the price function
                price: target,
            };

            const testObj = new PricingCalculator(
                new PriceModelValue({
                    parameterGroups: [
                        ServiceParameterGroupEntity.create({
                            id: ServiceParameterGroup.Id("whatever"),
                            name: "whatever",
                            parameters: [
                                ServiceParameterEntity.create({
                                    id: ServiceParameter.Id("target-parameter-id"),
                                    name: "target-parameter-id",
                                    value: parameterValue,
                                }),
                            ],
                        }),
                    ],
                })
            );

            const actual = testObj.calculatePrice([resolveParameterValue(parameterValue)]);

            expect(actual.getSubTotal()).toBe(1000);
        });

        it("should return price with service configuration, price model and boolean parameter value", () => {
            const target: ConstantPrice = {
                type: "constant",
                priceFn: value => (typeof value === "boolean" ? (value ? 10 : 0) : 0),
            };

            const parameterValue: BoundBooleanValue = {
                parameterId: ServiceParameter.Id("target-parameter-id"),
                kind: "boolean",
                value: true,
                price: target,
                trueLabel: "true",
                falseLabel: "false",
            };

            const testObj = new PricingCalculator(
                new PriceModelValue({
                    parameterGroups: [
                        ServiceParameterGroupEntity.create({
                            id: ServiceParameterGroup.Id("whatever"),
                            name: "whatever",
                            parameters: [
                                ServiceParameterEntity.create({
                                    id: ServiceParameter.Id("target-parameter-id"),
                                    name: "target-parameter-id",
                                    value: parameterValue,
                                }),
                            ],
                        }),
                    ],
                })
            );

            expect(
                testObj
                    .calculatePrice([resolveParameterValue({ ...parameterValue, value: true })])
                    .getSubTotal()
            ).toBe(10);

            expect(
                testObj
                    .calculatePrice([resolveParameterValue({ ...parameterValue, value: false })])
                    .getSubTotal()
            ).toBe(0);
        });

        it("should return price with service configuration, price model and discrete parameter value", () => {
            const target: ConstantPrice = {
                type: "constant",
                priceFn: value => (value === "option-1" ? 10 : value === "option-2" ? 20 : 30),
            };

            const parameterValue: BoundDiscreteValue = {
                parameterId: ServiceParameter.Id("target-parameter-id"),
                kind: "discrete",
                value: "option-1",
                options: [
                    { label: "Option 1", value: "option-1" },
                    { label: "Option 2", value: "option-2" },
                    { label: "Option 3", value: "option-3" },
                ],
                price: target,
            };

            const testObj = new PricingCalculator(
                new PriceModelValue({
                    parameterGroups: [
                        ServiceParameterGroupEntity.create({
                            id: ServiceParameterGroup.Id("whatever"),
                            name: "whatever",
                            parameters: [
                                ServiceParameterEntity.create({
                                    id: ServiceParameter.Id("target-parameter-id"),
                                    name: "target-parameter-id",
                                    value: parameterValue,
                                }),
                            ],
                        }),
                    ],
                })
            );

            expect(
                testObj
                    .calculatePrice([resolveParameterValue({ ...parameterValue, value: "option-1" })])
                    .getSubTotal()
            ).toBe(10);

            expect(
                testObj
                    .calculatePrice([resolveParameterValue({ ...parameterValue, value: "option-2" })])
                    .getSubTotal()
            ).toBe(20);

            expect(
                testObj
                    .calculatePrice([resolveParameterValue({ ...parameterValue, value: "option-3" })])
                    .getSubTotal()
            ).toBe(30);
        });

        it("should return price with service configuration, price model and range parameter value", () => {
            const target: ConstantPrice = {
                type: "constant",
                priceFn: value => (typeof value === "number" ? value * 10 : 0),
            };

            const parameterValue: BoundRangeValue = {
                parameterId: ServiceParameter.Id("target-parameter-id"),
                kind: "range",
                value: 10, // Used as input for the price function
                price: target,
            };

            const testObj = new PricingCalculator(
                new PriceModelValue({
                    parameterGroups: [
                        ServiceParameterGroupEntity.create({
                            id: ServiceParameterGroup.Id("whatever"),
                            name: "whatever",
                            parameters: [
                                ServiceParameterEntity.create({
                                    id: ServiceParameter.Id("target-parameter-id"),
                                    name: "target-parameter-id",
                                    value: parameterValue,
                                }),
                            ],
                        }),
                    ],
                })
            );

            const actual = testObj.calculatePrice([resolveParameterValue(parameterValue)]);

            expect(actual.getSubTotal()).toBe(100);
        });
    });

    describe("calculateFactorLookup", () => {
        it("should return empty object with no parameter values are provided", () => {
            const testObj = new PricingCalculator(
                new PriceModelValue({
                    parameterGroups: [],
                })
            );
            expect(testObj.calculateFactorLookup([], [])).toEqual(new FactorLookupValue({}));
        });

        it("should return price map with parameter values are provided", () => {
            const expectedId = ServiceParameter.Id("expected-parameter");
            const target: ResolvedParameterValue[] = [
                new ResolvedRangeValue({
                    parameterId: ServiceParameter.Id("test-parameter"),
                    price: new ResolvedFactorLookupPrice({
                        reference: expectedId,
                        factors: {
                            "expected-value": 100,
                        },
                    }),
                }),
                new ResolvedDiscreteValue({
                    parameterId: expectedId,
                    options: [
                        {
                            label: "Expected Value",
                            value: "expected-value",
                        },
                    ],
                    value: "expected-value",
                }),
            ];
            const priceModel = new PriceModelValue({
                parameterGroups: [
                    ServiceParameterGroupEntity.create({
                        id: ServiceParameterGroup.Id("whatever"),
                        name: "whatever",
                        parameters: [
                            ServiceParameterEntity.create({
                                id: ServiceParameter.Id("test-parameter"),
                                name: "test-parameter",
                                value: target[0] as ResolvedRangeValue,
                            }),
                            ServiceParameterEntity.create({
                                id: expectedId,
                                name: "expected-parameter",
                                value: target[1] as ResolvedDiscreteValue,
                            }),
                        ],
                    }),
                ],
            });
            const testObj = new PricingCalculator(priceModel);

            expect(
                testObj.calculateFactorLookup(target, priceModel.getParameterGroups().getParameters())
            ).toEqual({
                data: {
                    "expected-parameter": 100,
                },
            });
        });
    });
});
