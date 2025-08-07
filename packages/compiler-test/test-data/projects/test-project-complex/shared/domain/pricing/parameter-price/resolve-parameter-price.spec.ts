import { type FactorLookupPrice, type TieredPrice, ServiceParameter } from "../../api";
import { resolveParameterPrice } from "./resolve-parameter-price";
import { ResolvedConstantPrice } from "./ResolvedConstantPrice";
import { ResolvedFactorLookupPrice } from "./ResolvedFactorLookupPrice";
import { ResolvedTieredPrice } from "./ResolvedTieredPrice";

describe("resolveParameterPrice", () => {
    it("should resolve a constant price with constant type, value and parameter id", () => {
        const actual = resolveParameterPrice({
            type: "constant",
            amount: 123,
        });

        expect(actual).toEqual(
            new ResolvedConstantPrice({
                amount: 123,
            })
        );
    });

    it("should resolve a constant price with factor-lookup type, value and parameter id", () => {
        const actual = resolveParameterPrice({
            parameterId: ServiceParameter.Id("123"),
            type: "factor-lookup",
            amount: 123,
            reference: ServiceParameter.Id("other"),
            factors: {
                "123": 1,
            },
        } as FactorLookupPrice);

        expect(actual).toEqual(
            new ResolvedFactorLookupPrice({
                reference: ServiceParameter.Id("other"),
                factors: {
                    "123": 1,
                },
                amount: 123,
            })
        );
    });

    it("should resolve a constant price with tiered type, value and parameter id", () => {
        const actual = resolveParameterPrice({
            parameterId: ServiceParameter.Id("123"),
            type: "tiered",
            amount: 123,
            tiers: [
                {
                    gte: 1,
                    price: 123,
                },
            ],
        } as TieredPrice);

        expect(actual).toEqual(
            new ResolvedTieredPrice({
                amount: 123,
                tiers: [
                    {
                        gte: 1,
                        price: 123,
                    },
                ],
            })
        );
    });

    it("should return undefined with undefined price", () => {
        expect(resolveParameterPrice(undefined)).toBeUndefined();
    });

    it("should throw an error with unknown price type", () => {
        expect(() =>
            resolveParameterPrice({
                type: "unknown" as any,
                amount: 123,
            })
        ).toThrow("Cannot resolve parameter price. Unsupported price type 'unknown'.");
    });
});
