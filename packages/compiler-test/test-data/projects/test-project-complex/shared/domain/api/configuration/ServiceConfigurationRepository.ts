import { type ServiceConfiguration } from "./ServiceConfiguration";

/**
 * A repository to manage service configurations provided by the user
 * in the OrderConfigurator to order a service.
 */
export interface ServiceConfigurationRepository {
    /**
     * Loads a service configuration from the repository.
     *
     * @param id The ID of the service configuration to load.
     * @returns The loaded service configuration.
     */
    load(id: ServiceConfiguration.Id): Promise<ServiceConfiguration | undefined>;
    /**
     * Stores a service configuration in the repository.
     *
     * @param serviceConfiguration The service configuration to store.
     * @returns The stored service configuration.
     */
    store(serviceConfiguration: ServiceConfiguration): Promise<ServiceConfiguration>;
}

/**
 * The token to identify the service configuration repository for dependency injection.
 */
export const ServiceConfigurationRepositoryToken = "ServiceConfigurationRepository";
