/* eslint-disable @typescript-eslint/no-namespace */
import { type BoundParameterValue } from "../parameter-values";
import { type FactorLookup } from "../pricing";
import { type ServiceParameter } from "./ServiceParameter";

/**
 * A group of service parameters that are provided to the service provider to configure the service.
 *
 * Service parameter groups are managed in the CPQ service repository as part of a configurable service.
 */
export interface ServiceParameterGroup {
    /**
     * The id of the service configuration parameter group.
     *
     * Must be a non-empty string.
     */
    id: ServiceParameterGroup.Id;
    /**
     * The name of the service configuration parameter group.
     *
     * Must be a non-empty string.
     */
    name: string;
    /**
     * The parameters of the service configuration parameter group.
     *
     * Must be an array of at least one service configuration parameter.
     */
    parameters: ServiceParameter[];
    /**
     * The description of the service configuration parameter group.
     *
     * Defaults to "".
     */
    description?: string;
    /**
     * Whether the service configuration parameter group is required.
     *
     * Defaults to false.
     */
    required?: boolean;
    /**
     * The price function of the service parameter group.
     * By default, the price is the sum of the prices of the parameters.
     */
    priceFn?: (
        parameterValues: BoundParameterValue[],
        originalTotal: number,
        factorLookup?: FactorLookup
    ) => number;
    /**
     * The date and time the service configuration parameter group was created.
     */
    createdAt?: Date;
    /**
     * The date and time the service configuration parameter group was last updated.
     */
    updatedAt?: Date;
}

export namespace ServiceParameterGroup {
    /**
     * The id of the service configuration parameter group.
     *
     * Must be a non-empty ID string.
     */
    export type Id = string;

    /**
     * Creates a new service configuration parameter group ID.
     *
     * @param value The value to create the ID from.
     * @returns The new service configuration parameter group ID.
     * @throws An error if the ID is empty.
     */
    export const Id = (_value: string) => {
        throw new Error("ServiceParameterGroup: Property 'id' cannot be empty.");
    };
}
