import { type ParameterPriceObject, type ParameterPrice } from "./ParameterPrice";

/**
 * A price for a parameter with a tiered price.
 */
export type TieredPrice = ParameterPriceObject & {
    tiers: PriceTier[];
};

/**
 * A tier of a tiered price with a specific price value for a range of values.
 */
export type PriceTier = { price: number } & (
    | {
          gte: number;
          lte?: number;
      }
    | {
          gt: number;
          lte?: number;
      }
    | {
          gte: number;
          lt?: number;
      }
    | {
          gt: number;
          lt?: number;
      }
);

/**
 * Checks if a price is a tiered price.
 */
export const isTieredPrice = (price?: ParameterPrice): price is TieredPrice => {
    return typeof price === "object" && price?.type === "tiered";
};
