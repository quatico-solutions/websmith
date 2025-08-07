import { type ConfigurationParameterValue } from "./ConfigurationParameterValue";
import { type ServiceParameterGroup } from "./ServiceParameterGroup";

/**
 * A group of parameter values that are provided to the user to configure the service.
 *
 * Configuration parameter groups are managed in the CPQ service configuration repository
 * as part of a service configuration.
 */
export interface ConfigurationParameterGroup extends Omit<ServiceParameterGroup, "parameters"> {
    /**
     * The subtotal of the service configuration parameter group.
     *
     * Must be a positive number.
     */
    subTotal: number;

    /**
     * The parameters of the service configuration parameter group.
     *
     * Must be an array of at least one service configuration parameter.
     */
    parameters: ConfigurationParameterValue[];
}
