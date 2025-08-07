import { type ServiceParameter } from "../configuration";

/**
 * The price for the values of a parameter in a service configuration.
 */
export type ServiceConfigurationParameterPrice = {
    /**
     * The id of the service parameter associated with the price.
     */
    parameterId: ServiceParameter.Id;
    /**
     * The value of the parameter.
     */
    parameterValue: unknown;
};
