import { FactorLookupValue } from "./FactorLookupValue";
import { ResolvedTieredPrice, resolveTiers } from "./ResolvedTieredPrice";

describe("ResolvedTieredPrice", () => {
    describe("constructor", () => {
        it("should create a new resolved tiered price with parameterId, tiers, value and priceFn", () => {
            const actual = new ResolvedTieredPrice({
                tiers: [{ gte: 0, lte: 10, price: 10 }],
                amount: 10,
                priceFn: jest.fn(),
            });

            expect(actual).toEqual({
                type: "tiered",
                tiers: [{ gte: 0, lte: 10, price: 10 }],
                amount: 10,
                priceFn: expect.any(Function),
            });
        });

        it("should create a new resolved tiered price without parameterId", () => {
            const actual = new ResolvedTieredPrice({
                tiers: [{ gte: 0, lte: 10, price: 10 }],
                amount: 10,
            });

            expect(actual).toEqual({
                type: "tiered",
                tiers: [{ gte: 0, lte: 10, price: 10 }],
                amount: 10,
            });
        });

        it("should create a new resolved tiered price without tiers", () => {
            const actual = new ResolvedTieredPrice({
                tiers: [],
                amount: 10,
            });

            expect(actual).toEqual({
                type: "tiered",
                tiers: [],
                amount: 10,
            });
        });

        it("should create a new resolved tiered price without value and priceFn", () => {
            const actual = new ResolvedTieredPrice({
                tiers: [{ gte: 0, price: 10 }],
            });

            expect(actual).toEqual({
                type: "tiered",
                tiers: [{ gte: 0, lte: Infinity, price: 10 }],
                amount: 0,
            });
        });
    });

    describe("create", () => {
        it("should create a new resolved tiered price with parameterId, tiers, value and priceFn", () => {
            const actual = ResolvedTieredPrice.create({
                tiers: [{ gte: 0, price: 10 }],
                amount: 10,
                priceFn: jest.fn(),
            });

            expect(actual).toEqual({
                type: "tiered",
                tiers: [{ gte: 0, lte: Infinity, price: 10 }],
                amount: 10,
                priceFn: expect.any(Function),
            });
        });

        it("should throw an error with missing tiers", () => {
            expect(() =>
                ResolvedTieredPrice.create({
                    amount: 10,
                    priceFn: jest.fn(),
                    tiers: [],
                })
            ).toThrow("TieredPrice: Property 'tiers' must be provided.");
        });

        it("should throw an error with missing value and priceFn", () => {
            expect(() =>
                ResolvedTieredPrice.create({
                    tiers: [{ gte: 0, price: 10 }],
                })
            ).toThrow("TieredPrice: Property 'value' or 'priceFn' must be provided.");
        });
    });

    describe("calculateValue", () => {
        it("should calculate the value of the tiered price with existing tier", () => {
            const actual = ResolvedTieredPrice.create({
                tiers: [{ gte: 0, price: 10 }],
                amount: 10,
            });

            expect(actual.calculatePrice(5, new FactorLookupValue({}))).toEqual(50);
        });

        it("should calculate the value of the tiered price with multiple tiers", () => {
            const actual = ResolvedTieredPrice.create({
                tiers: [
                    { gt: 0, lt: 10, price: 10 },
                    { gte: 10, lt: 20, price: 20 },
                    { gte: 20, lte: 30, price: 30 },
                ],
                amount: 10,
            });

            expect(actual.calculatePrice(0, new FactorLookupValue({}))).toEqual(0);
            expect(actual.calculatePrice(1, new FactorLookupValue({}))).toEqual(10);
            expect(actual.calculatePrice(10, new FactorLookupValue({}))).toEqual(200);
            expect(actual.calculatePrice(20, new FactorLookupValue({}))).toEqual(600);
            expect(actual.calculatePrice(30, new FactorLookupValue({}))).toEqual(900);
        });
    });

    describe("equals", () => {
        it("should return true with same tiered price", () => {
            const testObj = ResolvedTieredPrice.create({
                tiers: [{ gte: 0, price: 10 }],
                amount: 10,
            });
            const other = ResolvedTieredPrice.create({
                tiers: [{ gte: 0, price: 10 }],
                amount: 10,
            });

            expect(testObj.equals(other)).toBe(true);
        });

        it("should return false with different tiers", () => {
            const testObj = ResolvedTieredPrice.create({
                tiers: [{ gte: 0, price: 111 }],
                amount: 10,
            });

            const other = ResolvedTieredPrice.create({
                tiers: [{ gte: 0, price: 666 }],
                amount: 10,
            });

            expect(testObj.equals(other)).toBe(false);
        });

        it("should return false with different value", () => {
            const testObj = ResolvedTieredPrice.create({
                tiers: [{ gte: 0, price: 10 }],
                amount: 111,
            });

            const other = ResolvedTieredPrice.create({
                tiers: [{ gte: 0, price: 10 }],
                amount: 666,
            });

            expect(testObj.equals(other)).toBe(false);
        });
    });
});

describe("resolveTiers", () => {
    it("should return tiers with gte", () => {
        const actual = resolveTiers([{ gte: 0, price: 10 }]);

        expect(actual).toEqual([{ gte: 0, lte: Infinity, price: 10 }]);
    });

    it("should return tiers with gt", () => {
        const actual = resolveTiers([{ gt: 0, price: 10 }]);

        expect(actual).toEqual([{ gt: 0, lte: Infinity, price: 10 }]);
    });

    it("should return tiers with gte and lt", () => {
        const actual = resolveTiers([{ gte: 0, lt: 10, price: 10 }]);

        expect(actual).toEqual([{ gte: 0, lt: 10, price: 10 }]);
    });

    it("should return tiers with gte and lte", () => {
        const actual = resolveTiers([{ gte: 0, lte: 10, price: 10 }]);

        expect(actual).toEqual([{ gte: 0, lte: 10, price: 10 }]);
    });

    it("should return tiers with gt and lt", () => {
        const actual = resolveTiers([{ gt: 0, lt: 10, price: 10 }]);

        expect(actual).toEqual([{ gt: 0, lt: 10, price: 10 }]);
    });

    it("should resolve the tiers with multiple tiers", () => {
        const actual = resolveTiers([
            { gte: 0, price: 10 },
            { gte: 10, price: 20 },
        ]);
        expect(actual).toEqual([
            { gte: 0, lte: 9, price: 10 },
            { gte: 10, lte: Infinity, price: 20 },
        ]);
    });

    it("should resolve the tiers with multiple tiers and gte and lte", () => {
        const actual = resolveTiers([
            {
                price: 10,
                gte: 1,
            },
            {
                price: 20,
                gt: 10,
            },
            {
                price: 30,
                gt: 20,
            },
        ]);

        expect(actual).toEqual([
            { gte: 1, lte: 10, price: 10 },
            { gt: 10, lte: 20, price: 20 },
            { gt: 20, lte: Infinity, price: 30 },
        ]);
    });
});
