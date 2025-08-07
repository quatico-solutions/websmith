import { ResolvedMultiConstantPrice } from "./ResolvedMultiConstantPrice";

describe("ResolvedMultiConstantPrice", () => {
    describe("constructor", () => {
        it("should create a new resolved multi constant price", () => {
            const testObj = new ResolvedMultiConstantPrice({
                valueMap: { expected: 123 },
            });

            expect(testObj).toEqual({
                type: "multi-constant",
                amount: 0,
                valueMap: { expected: 123 },
            });
        });

        it("should create a new resolved multi constant price with priceFn", () => {
            const testObj = new ResolvedMultiConstantPrice({
                valueMap: { expected: 123 },
                priceFn: jest.fn(),
            });

            expect(testObj).toEqual({
                type: "multi-constant",
                amount: 0,
                valueMap: { expected: 123 },
                priceFn: expect.any(Function),
            });
        });
    });

    describe("defaultPriceFn", () => {
        it("should return price with single value", () => {
            const testObj = new ResolvedMultiConstantPrice({
                valueMap: { expected: 123 },
            });

            expect(testObj.defaultPriceFn("expected")).toBe(123);
        });

        it("should return price with multiple values", () => {
            const testObj = new ResolvedMultiConstantPrice({
                valueMap: { expected: 123, other: 456 },
            });

            expect(testObj.defaultPriceFn("expected")).toBe(123);
            expect(testObj.defaultPriceFn("other")).toBe(456);
        });

        it("should return 0 with unknown value", () => {
            const testObj = new ResolvedMultiConstantPrice({
                valueMap: { expected: 123 },
            });

            const actual = testObj.defaultPriceFn("unknown");

            expect(actual).toBe(0);
        });

        it("should throw error with no string value", () => {
            const testObj = new ResolvedMultiConstantPrice({
                valueMap: { expected: 123 },
            });

            expect(() => testObj.defaultPriceFn(123)).toThrow(
                "MultiConstantPrice: Parameter value must be a string."
            );
        });
    });
});
