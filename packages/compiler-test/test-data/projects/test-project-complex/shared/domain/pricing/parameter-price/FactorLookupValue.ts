import { isDiscrete, isFactorLookupPrice, type FactorLookup, type ServiceParameter } from "../../api";
import { type ServiceParameterEntity } from "../../configuration";
import { type ResolvedParameterValue } from "../../parameter-values";

/**
 * A dictionary of parameter IDs to their factor values.
 */
export class FactorLookupValue implements FactorLookup {
    readonly data: Record<string, number>;

    constructor(data: Record<string, number>) {
        this.data = data;
    }

    getValue(parameterId: ServiceParameter.Id): number | undefined {
        return this.data[parameterId];
    }

    contains(parameterId: ServiceParameter.Id): boolean {
        return this.data[parameterId] !== undefined;
    }

    static create(values: ResolvedParameterValue[], parameters: ServiceParameterEntity[]): FactorLookupValue {
        return createFactorLookup(values, parameters);
    }
}

/**
 * This is used to calculate prices based on the values of other parameters.
 *
 * Creates a dictionary parameterId to factor lookup value, where key is the ID of a discrete
 * parameter and value is a numeric factor.
 */
export const createFactorLookup = (
    values: ResolvedParameterValue[],
    parameters: ServiceParameterEntity[]
): FactorLookupValue => {
    const parameterIdValueMap = values.reduce(
        (acc: Record<ServiceParameter.Id, string>, paramValue: ResolvedParameterValue) => {
            const parameterId = paramValue.parameterId;
            if (isDiscrete(paramValue) && paramValue.value) {
                acc[parameterId] = paramValue.value;
            }
            return acc;
        },
        {}
    );

    const parameterIdFactorMap: Record<string, number> = {};
    for (const value of parameters) {
        const price = value.getParameterPrice();
        if (isFactorLookupPrice(price)) {
            const fieldId = price.reference;
            const parameterId = parameterIdValueMap[fieldId];
            if (parameterId) {
                const factorLookup = price.factors[parameterId] ?? 0;
                parameterIdFactorMap[fieldId] = factorLookup;
            }
        }
    }

    return new FactorLookupValue(parameterIdFactorMap);
};
