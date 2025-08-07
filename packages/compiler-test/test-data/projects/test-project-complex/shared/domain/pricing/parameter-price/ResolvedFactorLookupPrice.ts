import { type FactorLookup, type FactorLookupPrice, type ServiceParameter } from "../../api";
import { ResolvedParameterPrice } from "./ResolvedParameterPrice";

export class ResolvedFactorLookupPrice extends ResolvedParameterPrice implements FactorLookupPrice {
    readonly reference: ServiceParameter.Id;
    readonly factors: Record<string, number>;

    constructor(price: Omit<FactorLookupPrice, "type">) {
        super({ ...price, amount: price.amount ?? 0, type: "factor-lookup" });

        this.reference = price.reference;
        this.factors = price.factors;
    }

    getReference(): ServiceParameter.Id {
        return this.reference;
    }

    getFactors(): Record<string, number> {
        return this.factors;
    }

    /**
     * This parameter price type uses a `reference` parameter ID from the price configuration to
     * look up a factor value within the price model. The reference parameter ID needs to exist in
     * the configuration, and thus in the provided factor lookup.
     *
     * The provided parameter value is then multiplied by the found factor value.
     *
     * @param parameterValue The value of the parameter to be multiplied by the factor value.
     * @param factorLookup The lookup for factor values for the current price model.
     * @returns The price for the parameter value.
     * @throws An error if the parameter value is not a number.
     * @throws An error if the reference parameter ID does not exist in the factor lookup.
     */
    defaultPriceFn(parameterValue: unknown, factorLookup: FactorLookup): number | never {
        if (typeof parameterValue !== "number") {
            throw new Error(`FactorLookupPrice: Selected value must be a number.`);
        }

        return (factorLookup.getValue(this.reference) ?? 0) * parameterValue;
    }

    static create(price: Omit<FactorLookupPrice, "type">): ResolvedFactorLookupPrice | never {
        const { reference, factors, amount, priceFn } = price;

        if (!reference || reference.trim() === "") {
            throw new Error("FactorLookupPrice: Property 'reference' cannot be empty.");
        }

        if (factors === undefined || Object.keys(factors).length === 0) {
            throw new Error("FactorLookupPrice: Property 'factors' must be provided.");
        }

        if (amount === undefined && typeof priceFn !== "function") {
            throw new Error("FactorLookupPrice: Property 'value' or 'priceFn' must be provided.");
        }

        return new ResolvedFactorLookupPrice(price);
    }
}
