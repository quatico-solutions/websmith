import {
    type BoundParameterValue,
    type FactorLookup,
    type ServiceParameter,
    type ServiceParameterGroup,
} from "../api";
import { Entity } from "../base/Entity";
import { type ResolvedParameterValue } from "../parameter-values";
import { ConfigurationParameterGroupEntity } from "./ConfigurationParameterGroupEntity";
import { ServiceParameterEntity } from "./ServiceParameterEntity";

/**
 * Represents a group of parameters in a service configuration.
 * Parameter groups are used to organize related parameters together
 * and can be marked as required or optional.
 */
export class ServiceParameterGroupEntity
    extends Entity<ServiceParameterGroup>
    implements ServiceParameterGroup
{
    readonly name: string;
    readonly required: boolean;
    readonly parameters: ServiceParameterEntity[];
    readonly description?: string;
    readonly priceFn?: (
        parameterValues: BoundParameterValue[],
        originalTotal: number,
        factorLookup?: FactorLookup
    ) => number;
    readonly createdAt?: Date;
    readonly updatedAt?: Date;

    /**
     * Creates a new service configuration parameter group.
     */
    constructor(props: ServiceParameterGroup) {
        super(props.id);
        this.name = props.name;
        this.required = props.required ?? false;
        this.parameters = props.parameters.map(it => ServiceParameterEntity.create(it));
        this.description = props.description;
        this.priceFn = props.priceFn;
        this.createdAt = props.createdAt;
        this.updatedAt = props.updatedAt;
    }

    /**
     * Gets the display name of the parameter group.
     *
     * @returns The display name of the parameter group
     */
    getName(): string {
        return this.name;
    }

    /**
     * Gets whether this parameter group must have at least one parameter with a value.
     *
     * @returns Whether this parameter group must have at least one parameter with a value
     */
    isRequired(): boolean {
        return this.required;
    }

    /**
     * Gets the description of the parameter group.
     *
     * @returns The description of the parameter group
     */
    getDescription(): string | undefined {
        return this.description;
    }

    /**
     * Gets a parameter by its ID.
     *
     * @param id The ID of the parameter to get
     * @returns The parameter with the specified ID, or undefined if it doesn't exist
     */
    getParameter(id: ServiceParameter.Id): ServiceParameterEntity | undefined {
        return this.parameters.find(it => it.getId() === id);
    }

    /**
     * Gets the parameters in this group.
     *
     * @returns The parameters in this group
     */
    getParameters(): ServiceParameterEntity[] {
        return this.parameters;
    }

    /**
     * Applies a configuration to the parameter group. This method is used to
     * create a configuration parameter group entity from the parameter group
     * and the selected parameter values.
     *
     * @param parameterValues The parameter values to apply.
     * @param factorLookup The factor lookup to use.
     * @returns The applied configuration.
     */
    applyConfiguration(
        parameterValues: ResolvedParameterValue[],
        factorLookup: FactorLookup
    ): ConfigurationParameterGroupEntity {
        return new ConfigurationParameterGroupEntity({
            id: this.id,
            name: this.name,
            description: this.description,
            subTotal: this.calculatePrice(parameterValues, factorLookup),
            parameters: this.parameters.map(it => it.applyConfiguration(parameterValues, factorLookup)),
        });
    }

    /**
     * Calculates the price of this parameter group based on the selected parameter values and the factor lookup.
     *
     * @param selectedParameterValues The array of selected parameter values.
     * @param factorLookup The factor lookup.
     * @returns The price of the parameter group.
     */
    calculatePrice(selectedParameterValues: ResolvedParameterValue[], factorLookup: FactorLookup): number {
        const originalTotal = this.getParameterValues().reduce((sum, parameter) => {
            try {
                const parameterValue = this.getParameterValue(
                    parameter.getParameterId(),
                    selectedParameterValues
                );
                return sum + parameter.getPrice()!.calculatePrice(parameterValue.getValue(), factorLookup);
            } catch (_ignored) {
                // TODO: If no parameter value is found, we simply add 0 to the total.
                // Is this the correct behavior?
                return sum;
            }
        }, 0);
        return this.priceFn
            ? this.priceFn(this.getParameterValues(), originalTotal, factorLookup)
            : originalTotal;
    }

    /**
     * Gets the values of all parameters in this group.
     *
     * @returns The values of all parameters in this group
     */
    getParameterValues(): ResolvedParameterValue[] {
        return this.parameters.map(parameter => parameter.getParameterValue());
    }

    /**
     * Retrieves the value of a parameter from the configuration.
     *
     * @param parameterId The ID of the parameter.
     * @param selectedParameterValues The array of selected parameter values.
     * @returns The value of the parameter.
     * @throws If the parameter is not found.
     */
    private getParameterValue<VALUE = string>(
        parameterId: ServiceParameter.Id,
        selectedParameterValues: ResolvedParameterValue<VALUE>[]
    ): ResolvedParameterValue<VALUE> {
        const result = selectedParameterValues.find(param => param.getParameterId() === parameterId);
        if (!result) {
            throw new Error(`Parameter value not found for parameter ID: '${parameterId}'.`);
        }
        return result;
    }

    /**
     * Creates a new service configuration parameter group with valid name.
     *
     * @param id The unique identifier for this parameter group
     * @param name The display name of the parameter group
     * @param required Whether this parameter group must have at least one parameter with a value
     * @param parameters Optional initial list of parameters in this group
     * @param description Optional description of the parameter group
     */
    static create(props: ServiceParameterGroup): ServiceParameterGroupEntity | never {
        if (!props.name || props.name.trim() === "") {
            throw new Error("ServiceParameterGroup: Property 'name' cannot be empty.");
        }

        return new ServiceParameterGroupEntity(props);
    }
}
