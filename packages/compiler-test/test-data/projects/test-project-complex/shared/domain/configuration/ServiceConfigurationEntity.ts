import {
    type ConfigurableService,
    type ServiceConfiguration,
    type ServiceConfigurationPrice,
    type ServiceConfigurationRepository,
    type ServiceParameter,
} from "../api";
import { Entity } from "../base";
import { ResolvedServiceConfigurationPrice } from "../pricing";
import { ConfigurationParameterGroupEntity } from "./ConfigurationParameterGroupEntity";
import { type ConfigurationParameterValueEntity } from "./ConfigurationParameterValueEntity";

/**
 * A service configuration entity represents a configured instance of a
 * configurable service. A service configuration contains the values
 * selected by the user for the parameters of a configurable service.
 *
 * @see ConfigurableServiceEntity
 * @see ConfigurationParameterGroupEntity
 * @see ConfigurationParameterValueEntity
 */
export class ServiceConfigurationEntity extends Entity<ServiceConfiguration> implements ServiceConfiguration {
    readonly serviceId: ConfigurableService.Id;
    readonly serviceName: string;
    readonly parameterGroups: ConfigurationParameterGroupEntity[];
    readonly remarks?: string;
    readonly attachments?: ServiceConfiguration.Attachment[];
    readonly price?: ServiceConfigurationPrice;
    readonly #defaultValidityPeriod = 30 * 24 * 60 * 60 * 1000; // 30 days

    constructor(props: ServiceConfiguration) {
        super(props.id);
        this.serviceId = props.serviceId;
        this.serviceName = props.serviceName;
        this.parameterGroups = props.parameterGroups.map(it => ConfigurationParameterGroupEntity.create(it));
        this.remarks = props.remarks;
        this.attachments = props.attachments;
        this.price = props.price;
    }

    getServiceId(): ConfigurableService.Id {
        return this.serviceId;
    }

    getServiceName(): string {
        return this.serviceName;
    }

    getServicePrice(): ResolvedServiceConfigurationPrice {
        return new ResolvedServiceConfigurationPrice(this.price ?? {}, this.parameterGroups);
    }

    getValidThrough(startDate: Date, validityPeriod = this.#defaultValidityPeriod): Date {
        return new Date(startDate.getTime() + validityPeriod);
    }

    getParameter(parameterId: ServiceParameter.Id): ConfigurationParameterValueEntity | undefined {
        for (const group of this.parameterGroups) {
            const parameter = group.getParameter(parameterId);
            if (parameter) {
                return parameter;
            }
        }
        return undefined;
    }

    getParameters(): ConfigurationParameterValueEntity[] {
        return this.parameterGroups.flatMap(group => group.getParameters());
    }

    getParameterGroups(): ConfigurationParameterGroupEntity[] {
        return [...this.parameterGroups];
    }

    /**
     * Gets the parameter values of the service configuration.
     *
     * @returns An object containing parameter ids (technical) as keys and their corresponding values as values.
     */
    getParameterValues(): Record<string, string> {
        return {
            ...this.parameterGroups
                .flatMap(group => group.getParameters())
                .reduce((acc: Record<string, string>, { id, value }) => {
                    acc[id] = String(value);
                    return acc;
                }, {}),
        };
    }

    /**
     * Gets the parameter names and values of the service configuration.
     *
     * @returns An object containing parameter names (human-readable) as keys and their corresponding values as values.
     */
    getParameterNamesAndValues(): Record<string, string> {
        const parameters = {
            ...this.parameterGroups
                .flatMap(group => group.getParameters())
                .reduce((acc: Record<string, string>, { name, value }) => {
                    acc[name] = String(value);
                    return acc;
                }, {}),
        };
        return this.remarks ? { ...parameters, Kommentar: this.remarks } : parameters;
    }

    getSummary(): string {
        return generateSummary(this.serviceName, this.parameterGroups);
    }

    addRemarks(remarks?: string): ServiceConfigurationEntity {
        if (!remarks) {
            return this;
        }
        return new ServiceConfigurationEntity({
            ...this,
            remarks,
        });
    }

    getRemarks(): string | undefined {
        return this.remarks;
    }

    getAttachments(): ServiceConfiguration.Attachment[] | undefined {
        return this.attachments;
    }

    addAttachments(attachments?: ServiceConfiguration.Attachment[]): ServiceConfigurationEntity {
        if (!attachments) {
            return this;
        }
        return new ServiceConfigurationEntity({ ...this, attachments });
    }

    /**
     * Stores the service configuration in the repository.
     *
     * @returns The stored service configuration.
     * @throws An error if no repository is registered.
     */
    async store(): Promise<ServiceConfigurationEntity> {
        const repository = ServiceConfigurationEntity.getRepository("store");
        return ServiceConfigurationEntity.create(await repository.store(this));
    }

    /**
     * Updates the service configuration in the repository.
     *
     * @param props The properties to update the service configuration with.
     * @returns The updated service configuration.
     * @throws An error if no repository is registered.
     */
    async update(props: Partial<ServiceConfiguration>): Promise<ServiceConfigurationEntity> {
        const repository = ServiceConfigurationEntity.getRepository("update");
        return ServiceConfigurationEntity.create(await repository.store({ ...this, ...props, id: this.id }));
    }

    // Method overloading to allow for undefined values
    static create(props: ServiceConfiguration): ServiceConfigurationEntity;
    static create(props?: ServiceConfiguration): ServiceConfigurationEntity | undefined;

    /**
     * Creates a new service configuration with valid configurable service ID.
     *
     * @param props The service configuration properties
     * @returns A new service configuration
     * @throws An error if the service name is empty.
     */
    static create(props?: ServiceConfiguration): ServiceConfigurationEntity | undefined {
        if (!props) {
            return undefined;
        }

        if (!props.serviceName || props.serviceName.trim() === "") {
            throw new Error("ServiceConfiguration: Property 'serviceName' cannot be empty.");
        }

        return new ServiceConfigurationEntity(props);
    }

    /**
     * Loads a service configuration from the repository.
     *
     * @param id The ID of the service configuration to load.
     * @returns The loaded service configuration.
     * @throws An error if no repository is registered.
     * @throws An error if the service configuration is not found.
     */
    static async load(id: ServiceConfiguration.Id): Promise<ServiceConfigurationEntity | undefined> {
        const repository = ServiceConfigurationEntity.getRepository("load");
        const configuration = await repository.load(id);
        if (!configuration) {
            return undefined;
        }
        return ServiceConfigurationEntity.create(configuration);
    }

    private static getRepository(methodName: string): ServiceConfigurationRepository {
        throw new Error(`ServiceConfigurationEntity: Cannot call "${methodName}" without a repository.`);
    }
}

/**
 * Generates a readable summary of the offer, e.g
 * "PV-Anlagenreinigung: Solaranlage [Anlagengrösse: "200m", Dachtyp: "Flachdach", Absturzsicherung: "Seil"]"
 */
export const generateSummary = (serviceName: string, groups: ConfigurationParameterGroupEntity[]): string =>
    `${serviceName}: ${
        groups.length
            ? groups
                  .map(
                      group =>
                          `${group.getName()} [${group
                              .getParameters()
                              .map(param => `${param.getName()}: ${String(param.getValue())}`)
                              .join(", ")}]`
                  )
                  .join(", ")
            : "[]"
    }`;
