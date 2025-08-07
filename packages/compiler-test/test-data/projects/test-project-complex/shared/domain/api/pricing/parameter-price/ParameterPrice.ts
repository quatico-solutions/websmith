import { isDiscrete, type BoundParameterValue, type DiscreteValueOption } from "../../parameter-values";
import { type FactorLookup } from "./FactorLookup";
import { type MultiConstantPrice } from "./MultiConstantPrice";

/**
 * A number of price with constant value for a parameter.
 */
export type ParameterPrice = number | ParameterPriceObject;

/**
 * A price for a parameter with a constant value or a function to calculate the price.
 */
export type ParameterPriceObject = {
    /**
     * The type of price to be used for the calculation.
     */
    type: ParameterPriceType;

    /**
     * The amount of the price. Required if no `priceFn` is provided.
     */
    amount?: number;
    /**
     * An optional function to provide a custom calculation of the price value.
     * The function will be called with the selected value of the parameter and
     * the factor lookup. The function should return a number.
     *
     * Required if `amount` is not provided.
     */
    priceFn?: (parameterValue: unknown, originalPrice: number, factorLookup?: FactorLookup) => number;
};

/**
 * The type of price to be used for the calculation.
 */
export type ParameterPriceType = "constant" | "multi-constant" | "factor-lookup" | "tiered";

/**
 * Creates a bound parameter price from a parameter price.
 */
export const createBoundParameterPrice = (
    parameterValue: BoundParameterValue
): ParameterPriceObject | undefined => {
    const { price } = parameterValue ?? {};
    if (price === undefined) {
        if (isDiscrete(parameterValue)) {
            const { options } = parameterValue;
            if (options && options.some(it => it.price !== undefined)) {
                return {
                    type: "multi-constant",
                    valueMap: options.reduce((res: Record<string, number>, cur: DiscreteValueOption) => {
                        res[cur.value] = getValue(cur.price);
                        return res;
                    }, {}),
                } as MultiConstantPrice;
            }
        }
        return undefined;
    }
    if (typeof price === "number") {
        return {
            type: "constant",
            amount: price,
        };
    }
    return price;
};

/**
 * Gets the value of a parameter price.
 *
 * @param price The parameter price to get the value of.
 * @returns The value of the parameter price.
 */
const getValue = (price?: ParameterPrice): number => {
    if (typeof price === "number") {
        return price;
    }
    return typeof price?.amount === "number" && price.amount !== undefined ? price.amount : 0;
};
