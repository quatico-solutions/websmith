import { type ServiceParameterGroup } from "../configuration/ServiceParameterGroup";
import { type ServiceConfigurationParameterPrice } from "./ServiceConfigurationParameterPrice";

/**
 * The price of a parameter group in a service configuration.
 *
 * The price of a parameter group is the sum of the prices of the parameters
 * in the group.
 */
export type ServiceConfigurationParameterGroupPrice = {
    /**
     * The id of the service parameter group associated with the price.
     */
    groupId: ServiceParameterGroup.Id;
    /**
     * The subtotal of the parameter group.
     */
    subTotal: number;
    /**
     * The price items of the parameter group.
     */
    priceItems: ServiceConfigurationParameterPrice[];
};
