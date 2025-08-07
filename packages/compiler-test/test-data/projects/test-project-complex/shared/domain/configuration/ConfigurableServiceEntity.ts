/* eslint-disable @typescript-eslint/no-namespace */
import { ConfigurableService, ServiceConfiguration, type ServiceParameter, type ServiceParameterGroup, type ServiceRepository } from "../api";
import { Entity } from "../base";
import { type ResolvedParameterValue } from "../parameter-values";
import { PriceModelValue, PricingCalculator, type ResolvedServiceConfigurationPrice } from "../pricing";
import { ProviderConfigurationEntity } from "./ProviderConfigurationEntity";
import { ServiceConfigurationEntity } from "./ServiceConfigurationEntity";
import { type ServiceParameterEntity } from "./ServiceParameterEntity";
import { ServiceParameterGroupEntity } from "./ServiceParameterGroupEntity";
import { ServiceParameterGroups } from "./ServiceParameterGroups";

/**
 * Represents a service that can be configured by users.
 * A configurable service defines the structure of its configuration through
 * parameter groups, which contain the actual parameters that users can configure.
 */
export class ConfigurableServiceEntity extends Entity<ConfigurableService> implements ConfigurableService {
    readonly name: string;
    readonly description?: string;
    readonly parameterGroups: ServiceParameterGroups;
    readonly provider: ProviderConfigurationEntity;
    readonly theme?: string;
    readonly #priceModel: PriceModelValue;

    constructor(props: ConfigurableService) {
        super(props.id);

        this.name = props.name;
        this.parameterGroups = new ServiceParameterGroups(props.parameterGroups?.map(it => ServiceParameterGroupEntity.create(it)) ?? []);
        this.description = props.description;
        this.theme = props.theme;
        this.provider = ProviderConfigurationEntity.create(props.provider);
        this.#priceModel = PriceModelValue.create({ parameterGroups: this.parameterGroups });
    }

    /**
     * Gets the name of the configurable service.
     *
     * @returns The name of the configurable service
     */
    getName(): string {
        return this.name;
    }

    /**
     * Gets the description of the configurable service.
     *
     * @returns The description of the configurable service
     */
    getDescription(): string | undefined {
        return this.description;
    }

    /**
     * Gets a parameter group by its ID.
     *
     * @param id The ID of the parameter group to get
     * @returns The parameter group with the specified ID, or undefined if it doesn't exist
     */
    getParameterGroup(id: ServiceParameterGroup.Id): ServiceParameterGroupEntity | undefined {
        return this.parameterGroups.getGroup(id);
    }

    /**
     * Gets the parameter groups for this configurable service.
     *
     * @returns The parameter groups for this configurable service
     */
    getParameterGroups(): ServiceParameterGroups {
        return this.parameterGroups;
    }

    /**
     * Gets the theme name for this configurable service.
     *
     * @returns The theme name for this configurable service
     */
    getTheme(): string | undefined {
        return this.theme;
    }

    /**
     * Gets the provider for this configurable service.
     *
     * @returns The provicer for this configurable service
     */
    getProvider(): ProviderConfigurationEntity | undefined {
        return this.provider;
    }

    /**
     * Gets the parameter groups for this configurable service.
     *
     * @returns The parameter groups for this configurable service
     */
    getParameter(id: ServiceParameter.Id, groupId?: ServiceParameterGroup.Id): ServiceParameterEntity | undefined {
        if (groupId) {
            return this.parameterGroups.getParameter(id, groupId);
        }
        return this.parameterGroups.getParameter(id);
    }

    /**
     * Gets the parameters for this configurable service.
     *
     * @returns The parameters for this configurable service
     */
    getParameters(): ServiceParameterEntity[] {
        return this.parameterGroups.getParameters();
    }

    /**
     * Gets the parameters for this configurable service.
     *
     * @returns The parameters for this configurable service
     */
    getParameterValue<VALUE = string>(
        parameterId: ServiceParameter.Id,
        groupId?: ServiceParameterGroup.Id
    ): ResolvedParameterValue<VALUE> | undefined {
        return this.parameterGroups.getParameterValue<VALUE>(parameterId, groupId);
    }

    applyConfiguration(parameterValues: ResolvedParameterValue[]): ServiceConfigurationEntity {
        const calculator = new PricingCalculator(this.#priceModel);
        return new ServiceConfigurationEntity({
            id: ServiceConfiguration.Id(crypto.randomUUID()),
            serviceId: this.getId(),
            serviceName: this.getName(),
            parameterGroups: this.parameterGroups.map(it =>
                it.applyConfiguration(parameterValues, calculator.calculateFactorLookup(parameterValues, this.getParameters()))
            ),
        });
    }

    calculatePrice(selectedParameterValues: ResolvedParameterValue[]): ResolvedServiceConfigurationPrice {
        return new PricingCalculator(this.#priceModel).calculatePrice(selectedParameterValues);
    }

    static async loadOrFind(id: ConfigurableService.Id, configurations?: Record<string, unknown>): Promise<ConfigurableServiceEntity | undefined> {
        if (configurations) {
            const configuration = configurations[id];
            if (configuration && Object.keys(configuration).length) {
                return ConfigurableServiceEntity.create({ id } as ConfigurableService);
            }
            return Promise.reject(new Error(`ConfigurableService: Cannot load entity. No configuration found for id "${id}".`));
        }

        const repository = ConfigurableServiceEntity.getRepository("loadOrFind");
        const service = await repository.load(id);
        return service ? ConfigurableServiceEntity.create(service) : undefined;
    }

    static create(props: ConfigurableService): ConfigurableServiceEntity | never {
        if (!props.name || props.name.trim() === "") {
            throw new Error("ConfigurableService: Property 'name' cannot be empty.");
        }
        return new ConfigurableServiceEntity(props);
    }

    private static getRepository(methodName: string): ServiceRepository {
        throw new Error(`ConfigurableServiceEntity: Cannot call "${methodName}" without a repository.`);
    }
}

export namespace ConfigurableServiceEntity {
    export const Id = ConfigurableService.Id;
}
