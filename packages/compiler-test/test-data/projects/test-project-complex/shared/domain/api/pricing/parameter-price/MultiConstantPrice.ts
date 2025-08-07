import { type ParameterPrice, type ParameterPriceObject } from "./ParameterPrice";

/**
 * A price for a parameter with multiple constant values.
 *
 * Use this price for parameters with multiple options that have a constant price.
 */
export type MultiConstantPrice = ParameterPriceObject;

/**
/**
 * Checks if a price is a constant price.
 */
export const isMultiConstantPrice = (price?: ParameterPrice): price is MultiConstantPrice => {
    return typeof price === "object" && price?.type === "multi-constant";
};
