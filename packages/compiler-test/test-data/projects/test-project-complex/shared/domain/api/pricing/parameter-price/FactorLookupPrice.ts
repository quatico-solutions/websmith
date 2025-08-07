import { type ServiceParameter } from "../../configuration";
import { type ParameterPrice, type ParameterPriceObject } from "./ParameterPrice";

/**
 * A price for a parameter with a factor lookup table.
 */
export type FactorLookupPrice = ParameterPriceObject & {
    /**
     * The reference ID to lookup the price in the factor lookup table.
     */
    reference: ServiceParameter.Id;
    /**
     * The factors lookup table to be used for the calculation of the price.
     */
    factors: Record<string, number>;
};

/**
 * Checks if a price is a factor lookup price.
 */
export const isFactorLookupPrice = (price?: ParameterPrice): price is FactorLookupPrice => {
    return typeof price === "object" && price?.type === "factor-lookup";
};
