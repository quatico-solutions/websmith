import { type Context, type Serialization } from "./magellan-shared";
import { type ConfigurableService, ConfigurableServiceEntity } from "./shared";

// @service({"namespace":"cds-cpq-no-auth"})
export const getConfigurableServiceFn = async (
    input: {
        serviceId: ConfigurableService.Id;
        configurations?: Record<string, unknown>;
    },
    _context?: Context,
    _serialization?: Serialization
): Promise<ConfigurableService | undefined> => {
    const { serviceId, configurations } = input;
    return await ConfigurableServiceEntity.loadOrFind(serviceId, configurations);
};
