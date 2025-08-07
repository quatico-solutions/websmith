/* eslint-disable @typescript-eslint/no-namespace */
import { type ProviderConfiguration } from "./ProviderConfiguration";
import { type ServiceParameterGroup } from "./ServiceParameterGroup";

/**
 * A configurable service is a digital representation of a service
 * that is offered by the service provider. It can be configured by
 * the user in the OrderConfigurator to request an individual quote
 * or to order the service.
 *
 * Configurable services are managed in the CPQ service repository.
 */
export interface ConfigurableService {
    /**
     * The id to identify the service.
     *
     * Must be a non-empty ID string.
     */
    id: ConfigurableService.Id;
    /**
     * The name presented to the user.
     *
     * Must be a non-empty string.
     */
    name: string;
    /**
     * The groups of parameters that are provided to the user to configure the service.
     */
    parameterGroups: ServiceParameterGroup[];

    /**
     * The provider of the configurable service.
     */
    provider: ProviderConfiguration;
    /**
     * An optional property to provide a comprehensive description of the service.
     */
    description?: string;

    /**
     * An optional property to provide a design theme to style the service in
     * the OrderConfigurator.
     */
    theme?: string;
}

export namespace ConfigurableService {
    /**
     * The id to identify the service.
     *
     * Must be a non-empty ID string.
     */
    export type Id = string;

    /**
     * Creates a new configurable service ID.
     *
     * @param value The value to create the ID from.
     * @returns The new configurable service ID.
     * @throws An error if the ID is empty.
     */
    export const Id = (_value: string) => {
        throw new Error("ConfigurableService: Property 'id' cannot be empty.");
    };
}
