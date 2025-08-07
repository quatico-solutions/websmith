import { type ParameterPrice, type ParameterPriceObject } from "./ParameterPrice";

/**
 * A price for a parameter with a constant value.
 */
export type ConstantPrice = ParameterPriceObject;

/**
 * Checks if a price is a constant price.
 */
export const isConstantPrice = (price?: ParameterPrice): price is ConstantPrice => {
    return typeof price === "object" && price?.type === "constant";
};
