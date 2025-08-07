import { ServiceParameter } from "../../api/configuration";
import { ServiceParameterEntity } from "../../configuration";
import { ResolvedDiscreteValue, ResolvedRangeValue } from "../../parameter-values";
import { FactorLookupValue } from "./FactorLookupValue";
import { ResolvedFactorLookupPrice } from "./ResolvedFactorLookupPrice";

describe("FactorLookupValue", () => {
    describe("constructor", () => {
        it("should create a new factor lookup with empty data", () => {
            const actual = new FactorLookupValue({});

            expect(actual).toBeDefined();
        });

        it("should create a new factor lookup with data", () => {
            const actual = new FactorLookupValue({
                "123": 1,
                "456": 2,
            });

            expect(actual.data).toEqual({
                "123": 1,
                "456": 2,
            });
        });
    });

    describe("getValue", () => {
        it("should return the value for a given parameter id", () => {
            const actual = new FactorLookupValue({
                "123": 1,
            });

            expect(actual.getValue(ServiceParameter.Id("123"))).toEqual(1);
        });

        it("should return undefined if the parameter id is not in the data", () => {
            const actual = new FactorLookupValue({});

            expect(actual.getValue(ServiceParameter.Id("123"))).toBeUndefined();
        });
    });

    describe("contains", () => {
        it("should return true if the parameter id is in the data", () => {
            const actual = new FactorLookupValue({
                "123": 1,
            });

            expect(actual.contains(ServiceParameter.Id("123"))).toBe(true);
        });

        it("should return false if the parameter id is not in the data", () => {
            const actual = new FactorLookupValue({});

            expect(actual.contains(ServiceParameter.Id("123"))).toBe(false);
        });
    });

    describe("create", () => {
        it("should create a new factor lookup", () => {
            const actual = FactorLookupValue.create([], []);

            expect(actual).toEqual({
                data: {},
            });
        });

        it("should create a new factor lookup with single factor lookup price", () => {
            const expectedId = ServiceParameter.Id("expected-parameter");
            const target = [
                new ResolvedRangeValue({
                    parameterId: ServiceParameter.Id("test-parameter"),
                    price: new ResolvedFactorLookupPrice({
                        reference: expectedId,
                        factors: {
                            "expected-value": 100,
                        },
                    }),
                }),
                ResolvedDiscreteValue.create({
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
            const actual = FactorLookupValue.create(target, [
                new ServiceParameterEntity({
                    id: ServiceParameter.Id("test-parameter"),
                    name: "test-parameter",
                    value: target[0] as ResolvedRangeValue,
                }),
                new ServiceParameterEntity({
                    id: expectedId,
                    name: "expected-parameter",
                    value: target[1] as ResolvedDiscreteValue,
                }),
            ]);

            expect(actual).toEqual({
                data: {
                    "expected-parameter": 100,
                },
            });
        });

        it("should create a new factor lookup with multiple factor lookup prices", () => {
            const expectedId = ServiceParameter.Id("expected-parameter");
            const target = [
                new ResolvedRangeValue({
                    parameterId: ServiceParameter.Id("test-parameter"),
                    price: new ResolvedFactorLookupPrice({
                        reference: expectedId,
                        factors: {
                            "expected-value": 111,
                            "other-value": 666,
                        },
                    }),
                }),
                ResolvedDiscreteValue.create({
                    parameterId: expectedId,
                    options: [
                        {
                            label: "Expected Value",
                            value: "expected-value",
                        },
                        {
                            label: "Other Value",
                            value: "other-value",
                        },
                    ],
                    value: "expected-value",
                }),
            ];
            const actual = FactorLookupValue.create(target, [
                new ServiceParameterEntity({
                    id: ServiceParameter.Id("test-parameter"),
                    name: "test-parameter",
                    value: target[0] as ResolvedRangeValue,
                }),
                new ServiceParameterEntity({
                    id: expectedId,
                    name: "expected-parameter",
                    value: target[1] as ResolvedDiscreteValue,
                }),
            ]);

            expect(actual).toEqual({
                data: {
                    "expected-parameter": 111,
                },
            });
        });
    });
});
