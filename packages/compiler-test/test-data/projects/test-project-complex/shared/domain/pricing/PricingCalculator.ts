import { type ServiceParameter } from "../api/configuration/ServiceParameter";
import { type ServiceParameterEntity } from "../configuration/ServiceParameterEntity";
import { type ResolvedParameterValue } from "../parameter-values";
import { FactorLookupValue } from "./parameter-price/FactorLookupValue";
import { type PriceModelValue } from "./PriceModelValue";
import { ResolvedServiceConfigurationPrice } from "./ResolvedServiceConfigurationPrice";

/**
 * A service that calculates the price for a given service configuration and price model.
 */
export class PricingCalculator {
    constructor(private readonly priceModel: PriceModelValue) {}

    calculatePrice(parameterValues: ResolvedParameterValue[]): ResolvedServiceConfigurationPrice {
        const factorLookup = this.calculateFactorLookup(
            parameterValues,
            this.priceModel.getParameterGroups().getParameters()
        );
        // TODO: Contribute parameterPriceFn, parameterGroupPriceFn, totalPriceFn to the PriceModel interface
        // TODO: Default implementation for parameterPriceFn, parameterGroupPriceFn, totalPriceFn are sum function

        // calculate Total Price = Service Configuration Price ==> use servicePriceFn if provided
        // get all parameter groups, calculate price for each parameter group ==> use groupPriceFn if provided
        // get all parameters, calculate price for each parameter ==> priceFn for each parameter if provided
        const configuration = this.priceModel.applyUserInput(parameterValues, factorLookup);
        return new ResolvedServiceConfigurationPrice({}, configuration);
    }
    /**
     * Calculates a map of parameter IDs to their factor lookup values based on the selected parameter values.
     *
     * @returns A map of parameter IDs to their calculated factor lookup values
     */
    calculateFactorLookup(
        values: ResolvedParameterValue[],
        parameters: ServiceParameterEntity[]
    ): FactorLookupValue {
        return FactorLookupValue.create(values, parameters);
    }

    /**
     * Retrieves the value of a parameter from the configuration.
     *
     * @param parameterId The ID of the parameter.
     * @param selectedParameterValues The array of selected parameter values.
     * @returns The value of the parameter.
     * @throws If the parameter is not found.
     */
    protected getParameterValue<VALUE = string>(
        parameterId: ServiceParameter.Id,
        selectedParameterValues: ResolvedParameterValue<VALUE>[]
    ): ResolvedParameterValue<VALUE> {
        const result = selectedParameterValues.find(param => param.getParameterId() === parameterId);
        if (!result) {
            throw new Error(`Parameter value not found for parameter ID: '${parameterId}'.`);
        }
        return result;
    }
}
