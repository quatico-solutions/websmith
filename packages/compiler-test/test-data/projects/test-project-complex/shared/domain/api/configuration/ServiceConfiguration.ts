/* eslint-disable @typescript-eslint/no-namespace */
import { type ServiceConfigurationPrice } from "../pricing";
import { type ConfigurableService } from "./ConfigurableService";
import { type ConfigurationParameterGroup } from "./ConfigurationParameterGroup";

/**
 * A service configuration is a configuration of a configurable service
 * that is created by the user in the OrderConfigurator to order a service.
 *
 * Service configurations are managed in the CPQ service configuration repository.
 */
export interface ServiceConfiguration {
    /**
     * The id to identify the service configuration.
     *
     * Must be a non-empty ID string.
     */
    id: ServiceConfiguration.Id;
    /**
     * The id of the configurable service.
     *
     * Must be a non-empty ID string.
     */
    serviceId: ConfigurableService.Id;
    /**
     * The name of the configurable service used to present the service associated
     * with the configuration to the user.
     */
    serviceName: string;
    /**
     * The groups of parameters that are provided to the user to configure the service.
     */
    parameterGroups: ConfigurationParameterGroup[];
    /**
     * An optional property to store additional information from the user about the service configuration.
     */
    remarks?: string;
    /**
     * The attachments for the service configuration.
     */
    attachments?: ServiceConfiguration.Attachment[];

    /**
     * The price for the service configuration that is calculated by the CPQ service.
     *
     * If the price is not provided, the CPQ service will calculate the price based on the
     * parameter values and the price function of the service configuration.
     */
    price?: ServiceConfigurationPrice;

    /**
     * The date and time the service configuration was created in the CPQ service.
     */
    createdAt?: Date;

    /**
     * The date and time the service configuration was last updated in the CPQ service.
     */
    updatedAt?: Date;
}

export namespace ServiceConfiguration {
    /**
     * The id of the service configuration.
     *
     * Must be a non-empty ID string.
     */
    export type Id = string;

    /**
     * The attachments for the service configuration.
     */
    export type Attachment = {
        name: string;
        mimeType: string;
        base64: string;
    };

    /**
     * Creates a new service configuration ID.
     *
     * @param value The value to create the ID from.
     * @returns The new service configuration ID.
     * @throws An error if the ID is empty.
     */
    export const Id = (_value: string) => {
        throw new Error("ServiceConfiguration: Property 'id' cannot be empty.");
    };
}
