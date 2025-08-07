import { ServiceParameter } from "../../api";
import { FactorLookupValue } from "./FactorLookupValue";
import { ResolvedFactorLookupPrice } from "./ResolvedFactorLookupPrice";

describe("ResolvedFactorLookupPrice", () => {
    describe("constructor", () => {
        it("should create a new resolved factor lookup price with parameterId, reference and factors", () => {
            const actual = new ResolvedFactorLookupPrice({
                reference: ServiceParameter.Id("other"),
                factors: {
                    factor1: 1,
                    factor2: 2,
                },
            });

            expect(actual).toEqual({
                type: "factor-lookup",
                reference: ServiceParameter.Id("other"),
                factors: {
                    factor1: 1,
                    factor2: 2,
                },
                amount: 0,
            });
        });

        it("should create a new resolved factor lookup price without parameterId", () => {
            const actual = new ResolvedFactorLookupPrice({
                reference: ServiceParameter.Id("other"),
                factors: { factor1: 1, factor2: 2 },
            });

            expect(actual).toEqual({
                type: "factor-lookup",
                reference: ServiceParameter.Id("other"),
                factors: { factor1: 1, factor2: 2 },
                amount: 0,
            });
        });

        it("should create a new resolved factor lookup price without reference", () => {
            const actual = new ResolvedFactorLookupPrice({
                reference: "" as any,
                factors: { factor1: 1, factor2: 2 },
            });

            expect(actual).toEqual({
                type: "factor-lookup",
                reference: "" as any,
                factors: { factor1: 1, factor2: 2 },
                amount: 0,
            });
        });

        it("should create a new resolved factor lookup price without factors", () => {
            const actual = new ResolvedFactorLookupPrice({
                reference: ServiceParameter.Id("other"),
                factors: {},
            });

            expect(actual).toEqual({
                type: "factor-lookup",
                reference: ServiceParameter.Id("other"),
                factors: {},
                amount: 0,
            });
        });
    });

    describe("create", () => {
        it("should create a new resolved factor lookup price with parameterId, value, reference and factors", () => {
            const actual = ResolvedFactorLookupPrice.create({
                reference: ServiceParameter.Id("other"),
                factors: { factor1: 1, factor2: 2 },
                amount: 10,
            });

            expect(actual).toEqual({
                type: "factor-lookup",
                reference: ServiceParameter.Id("other"),
                factors: { factor1: 1, factor2: 2 },
                amount: 10,
            });
        });

        it("should throw an error with missing reference", () => {
            expect(() =>
                ResolvedFactorLookupPrice.create({
                    reference: "" as any,
                    factors: { factor1: 1, factor2: 2 },
                    amount: 10,
                })
            ).toThrow("FactorLookupPrice: Property 'reference' cannot be empty.");
        });

        it("should throw an error with missing factors", () => {
            expect(() =>
                ResolvedFactorLookupPrice.create({
                    reference: ServiceParameter.Id("other"),
                    factors: {},
                    amount: 10,
                })
            ).toThrow("FactorLookupPrice: Property 'factors' must be provided.");
        });

        it("should throw an error with missing value and priceFn", () => {
            expect(() =>
                ResolvedFactorLookupPrice.create({
                    reference: ServiceParameter.Id("other"),
                    factors: { factor1: 1, factor2: 2 },
                })
            ).toThrow("FactorLookupPrice: Property 'value' or 'priceFn' must be provided.");
        });
    });

    describe("defaultPriceFn", () => {
        it("should calculate the value of the factor lookup price with existing reference ID", () => {
            const actual = ResolvedFactorLookupPrice.create({
                reference: ServiceParameter.Id("target"),
                factors: { factor1: 1, factor2: 2 },
                amount: 10,
            });

            expect(actual.defaultPriceFn(5, new FactorLookupValue({ target: 50 }))).toEqual(250);
        });

        it("should return 0 with missing reference ID", () => {
            const testObj = ResolvedFactorLookupPrice.create({
                reference: ServiceParameter.Id("unknown"),
                factors: { factor1: 1, factor2: 2 },
                amount: 10,
            });

            const actual = testObj.defaultPriceFn(5, new FactorLookupValue({ target: 50 }));

            expect(actual).toEqual(0);
        });
    });

    describe("equals", () => {
        it("should return true with same factor lookup price", () => {
            const testObj = ResolvedFactorLookupPrice.create({
                reference: ServiceParameter.Id("same"),
                factors: { factor1: 1, factor2: 2 },
                amount: 10,
            });
            const other = ResolvedFactorLookupPrice.create({
                reference: ServiceParameter.Id("same"),
                factors: { factor1: 1, factor2: 2 },
                amount: 10,
            });

            expect(testObj.equals(other)).toBe(true);
        });

        it("should return false with different reference", () => {
            const testObj = ResolvedFactorLookupPrice.create({
                reference: ServiceParameter.Id("other"),
                factors: { factor1: 1 },
                amount: 10,
            });

            const other = ResolvedFactorLookupPrice.create({
                reference: ServiceParameter.Id("different"),
                factors: { factor1: 1 },
                amount: 10,
            });

            expect(testObj.equals(other)).toBe(false);
        });

        it("should return false with different factors", () => {
            const testObj = ResolvedFactorLookupPrice.create({
                reference: ServiceParameter.Id("same"),
                factors: { factor1: 111 },
                amount: 10,
            });

            const other = ResolvedFactorLookupPrice.create({
                reference: ServiceParameter.Id("same"),
                factors: { factor1: 666 },
                amount: 10,
            });

            expect(testObj.equals(other)).toBe(false);
        });

        it("should return false with different number of factors", () => {
            const testObj = ResolvedFactorLookupPrice.create({
                reference: ServiceParameter.Id("same"),
                factors: { factor1: 1 },
                amount: 10,
            });

            const other = ResolvedFactorLookupPrice.create({
                reference: ServiceParameter.Id("same"),
                factors: { factor1: 1, factor2: 2 },
                amount: 10,
            });

            expect(testObj.equals(other)).toBe(false);
        });

        it("should return false with different value", () => {
            const testObj = ResolvedFactorLookupPrice.create({
                reference: ServiceParameter.Id("same"),
                factors: { factor1: 1 },
                amount: 111,
            });

            const other = ResolvedFactorLookupPrice.create({
                reference: ServiceParameter.Id("same"),
                factors: { factor1: 1 },
                amount: 666,
            });

            expect(testObj.equals(other)).toBe(false);
        });
    });
});
