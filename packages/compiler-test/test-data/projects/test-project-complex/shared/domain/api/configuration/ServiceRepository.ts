import { type ConfigurableService } from "./ConfigurableService";

/**
 * A repository to manage configurable services provided by the service provider.
 */
export interface ServiceRepository {
    /**
     * Loads a configurable service from the repository.
     *
     * @param id The ID of the configurable service to load.
     * @returns The loaded configurable service.
     */
    load(id: ConfigurableService.Id): Promise<ConfigurableService | undefined>;
}

/**
 * The token to identify the service repository for dependency injection.
 */
export const ServiceRepositoryToken = "ServiceRepository";
