/* eslint-disable @typescript-eslint/no-namespace */
import { type ParameterValue } from "../parameter-values";
import { type TooltipConfiguration } from "./TooltipConfiguration";

/**
 * A service parameter that is provided to the service provider to configure the service.
 *
 * Service parameters are managed in the CPQ service repository as part of a service parameter group.
 */
export interface ServiceParameter {
    /**
     * The id of the service configuration parameter.
     */
    id: ServiceParameter.Id;
    /**
     * The name of the service configuration parameter.
     */
    name: string;
    /**
     * The description of the service configuration parameter.
     *
     * Defaults to "".
     */
    description?: string;
    /**
     * The value of the service configuration parameter.
     */
    value: ParameterValue;
    /**
     * Whether the service configuration parameter is required.
     *
     * Defaults to false.
     */
    required?: boolean;

    tooltip?: TooltipConfiguration;
}

/**
 * The namespace for the ServiceParameter type.
 */
export namespace ServiceParameter {
    /**
     * The id of the service configuration parameter.
     *
     * Must be a non-empty ID string.
     */
    export type Id = string;

    /**
     * Creates a new service configuration parameter ID.
     *
     * @param value The value to create the ID from.
     * @returns The new service configuration parameter ID.
     * @throws An error if the ID is empty.
     */
    export const Id = (_value: string) => {
        throw new Error("ServiceParameter: Property 'id' cannot be empty.");
    };
}
