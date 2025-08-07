import { type FactorLookup, type PriceModel, type ServiceParameter } from "../api";
import { ValueObject } from "../base";
import {
    type ConfigurationParameterGroupEntity,
    ServiceParameterGroupEntity,
    ServiceParameterGroups,
} from "../configuration";
import { type ResolvedParameterValue } from "../parameter-values";
import { type ResolvedParameterPrice } from "./parameter-price";

/**
 * Represents a pricing model for a configurable service.
 * A price model defines how the price of a service configuration is calculated
 * based on the selected parameter values.
 */
export class PriceModelValue
    extends ValueObject(
        class {
            readonly parameterGroups: ServiceParameterGroups;

            constructor(props: PriceModel) {
                this.parameterGroups = new ServiceParameterGroups(
                    props.parameterGroups?.map(group => ServiceParameterGroupEntity.create(group)) ?? []
                );
            }
        }
    )
    implements PriceModel
{
    getParameterGroups(): ServiceParameterGroups {
        return this.parameterGroups;
    }

    /**
     * Gets the pricing rules for all parameter values.
     * Returns a copy of the array to maintain immutability.
     *
     * @returns An array of parameter value prices
     */
    getParameterPrices(): ResolvedParameterPrice[] {
        return this.parameterGroups.getParameterPrices();
    }

    /**
     * Gets the price for a specific parameter value.
     *
     * @param parameterId The ID of the parameter
     * @returns The price for the parameter value, or undefined if not found
     */
    getParameterPrice(parameterId: ServiceParameter.Id): ResolvedParameterPrice | undefined {
        return this.parameterGroups.getParameterPrice(parameterId);
    }

    applyUserInput(
        parameterValues: ResolvedParameterValue[],
        factorLookup: FactorLookup
    ): ConfigurationParameterGroupEntity[] {
        return this.parameterGroups.map(group => group.applyConfiguration(parameterValues, factorLookup));
    }

    /**
     * Creates a new price model with valid configurable service ID.
     */
    static create(props: PriceModel): PriceModelValue | never {
        return new PriceModelValue(props);
    }
}
