import { type ParameterPriceObject, type FactorLookup, type ParameterPriceType } from "../../api";
import { ValueObject } from "../../base/ValueObject";

class BaseParameterPrice {
    readonly amount?: number;
    readonly type: ParameterPriceType;
    readonly priceFn?: (
        parameterValue: unknown,
        originalPrice: number,
        factorLookup?: FactorLookup
    ) => number;

    constructor(price: ParameterPriceObject) {
        this.amount = price.amount;
        this.type = price.type;
        this.priceFn = price.priceFn;
    }
}

export abstract class ResolvedParameterPrice
    extends ValueObject(BaseParameterPrice)
    implements ParameterPriceObject
{
    constructor(price: ParameterPriceObject) {
        super(price);
    }

    declare value: number;

    getType(): ParameterPriceType {
        return this.type;
    }

    calculatePrice(parameterValue: unknown, factorLookup: FactorLookup): number {
        const originalPrice = this.defaultPriceFn(parameterValue, factorLookup);

        if (this.priceFn) {
            return this.priceFn(parameterValue, originalPrice, factorLookup);
        }
        return originalPrice;
    }

    /**
     * Calculates the price for the parameter value using the current parameter configuration
     * and the factor lookup.
     *
     * This method is implemented by each price type with a default calculation.
     *
     * @param parameterValue The value of the parameter.
     * @param factorLookup The lookup for factor values for the current price model..
     * @returns The price for the parameter value.
     * @throws An error if the parameter value is not valid for the price type.
     */
    abstract defaultPriceFn(parameterValue: unknown, factorLookup?: FactorLookup): number | never;
}
