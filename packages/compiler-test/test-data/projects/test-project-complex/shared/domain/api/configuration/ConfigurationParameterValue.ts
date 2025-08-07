import { type ServiceParameter } from "./ServiceParameter";

/**
 * A parameter value that is provided to the user to configure the service.
 *
 * Configuration parameter values are managed in the CPQ service configuration repository
 * as part of a service configuration.
 */
export type ConfigurationParameterValue<VALUE = unknown> = Omit<ServiceParameter, "value"> & {
    /**
     * The value of the parameter.
     */
    value: VALUE;

    /**
     * The price for the parameter value calculated by the CPQ service.
     */
    price: number;
};
