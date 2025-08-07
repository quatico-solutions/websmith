import { FactorLookupValue } from "./FactorLookupValue";
import { ResolvedConstantPrice } from "./ResolvedConstantPrice";

describe("ResolvedConstantPrice", () => {
    describe("constructor", () => {
        it("should create a new resolved constant price", () => {
            const actual = new ResolvedConstantPrice({
                amount: 123,
            });

            expect(actual).toEqual({
                type: "constant",
                amount: 123,
            });
        });

        it("should create a new resolved constant price with priceFn", () => {
            const actual = new ResolvedConstantPrice({
                priceFn: jest.fn(),
            });

            expect(actual).toEqual({
                type: "constant",
                amount: 0,
                priceFn: expect.any(Function),
            });
        });

        it("should create a new resolved constant price without value and priceFn", () => {
            const actual = new ResolvedConstantPrice({});

            expect(actual).toEqual({
                type: "constant",
                amount: 0,
            });
        });
    });

    describe("create", () => {
        it("should create a new resolved constant price with value and priceFn", () => {
            const actual = ResolvedConstantPrice.create({
                amount: 123,
                priceFn: jest.fn(),
            });

            expect(actual).toEqual({
                type: "constant",
                amount: 123,
                priceFn: expect.any(Function),
            });
        });
    });

    describe("calculateValue", () => {
        it("should return value with value and no priceFn", () => {
            const actual = new ResolvedConstantPrice({
                amount: 123,
            }).calculatePrice(123, new FactorLookupValue({}));

            expect(actual).toEqual(123);
        });

        it("should return value with priceFn", () => {
            const actual = new ResolvedConstantPrice({
                priceFn: value => (value as number) * 100,
            }).calculatePrice(10, new FactorLookupValue({}));

            expect(actual).toEqual(1000);
        });

        it("should return value with value and priceFn", () => {
            const actual = new ResolvedConstantPrice({
                amount: 123,
                priceFn: value => (value as number) * 100,
            }).calculatePrice(10, new FactorLookupValue({}));

            expect(actual).toEqual(1000);
        });
    });

    describe("defaultPriceFn", () => {
        it("should return passed value with number value", () => {
            const testObj = new ResolvedConstantPrice({
                amount: 123,
            });

            const actual = testObj.defaultPriceFn(123);

            expect(actual).toEqual(123);
        });

        it("should return 0 with with number value but no parameter value", () => {
            const testObj = new ResolvedConstantPrice({});

            const actual = testObj.defaultPriceFn(123);

            expect(actual).toEqual(0);
        });

        it("should return 0 with false value", () => {
            const testObj = new ResolvedConstantPrice({
                amount: 100,
            });

            const actual = testObj.defaultPriceFn(false);

            expect(actual).toEqual(0);
        });

        it("should return parameter value with true value", () => {
            const testObj = new ResolvedConstantPrice({
                amount: 100,
            });

            const actual = testObj.defaultPriceFn(true);

            expect(actual).toEqual(100);
        });
    });
});
