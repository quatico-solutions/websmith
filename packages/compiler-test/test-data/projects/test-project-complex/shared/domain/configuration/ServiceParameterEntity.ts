import { type FactorLookup, type ParameterPrice, type ServiceParameter } from "../api";
import { type TooltipConfiguration } from "../api/configuration/TooltipConfiguration";
import { Entity } from "../base/Entity";
import { type ResolvedDiscreteValue, type ResolvedParameterValue, resolveParameterValue } from "../parameter-values";
import { ConfigurationParameterValueEntity } from "./ConfigurationParameterValueEntity";

/**
 * Represents a parameter in a service configuration.
 * A parameter defines what kind of input is required from the user
 * and how that input should be validated and processed.
 */
export class ServiceParameterEntity extends Entity<ServiceParameter> implements ServiceParameter {
    readonly name: string;
    readonly required: boolean;
    readonly description?: string;
    readonly tooltip?: TooltipConfiguration;
    readonly value: ResolvedParameterValue;

    constructor(props: ServiceParameter) {
        super(props.id);
        this.name = props.name;
        this.required = props.required ?? false;
        this.value = resolveParameterValue({ ...props.value, parameterId: props.id });
        this.description = props.description;
        this.tooltip = props.tooltip;
    }

    /**
     * Gets the display name of the parameter.
     *
     * @returns The display name of the parameter
     */
    getName(): string {
        return this.name;
    }

    /**
     * Gets whether this parameter must have a value.
     *
     * @returns Whether this parameter must have a value
     */
    isRequired(): boolean {
        return this.required ?? false;
    }

    /**
     * Gets the description of the parameter.
     *
     * @returns The description of the parameter
     */
    getDescription(): string | undefined {
        return this.description;
    }

    /**
     * Applies a configuration to the parameter. This method is used to create a
     * configuration parameter value entity from the parameter and the selected
     * parameter values.
     *
     * @param parameterValues The parameter values to apply.
     * @param factorLookup The factor lookup to use.
     * @returns The applied configuration.
     */
    applyConfiguration(parameterValues: ResolvedParameterValue[], factorLookup: FactorLookup): ConfigurationParameterValueEntity {
        return new ConfigurationParameterValueEntity({
            id: this.id,
            name: this.name,
            description: this.description,
            value: resolveParameterValueWithValue(this, parameterValues).getValue(),
            price: this.value.getPrice()?.calculatePrice(this.value.getValue(), factorLookup) ?? 0,
        });
    }

    /**
     * Gets the type and configuration of the parameter's value.
     *
     * @returns The type and configuration of the parameter's value
     */
    getParameterValue<VALUE = string>(): ResolvedParameterValue<VALUE> {
        return this.value as unknown as ResolvedParameterValue<VALUE>;
    }

    getParameterPrice(): ParameterPrice | undefined {
        return this.value.getPrice();
    }

    /**
     * Gets the tooltip configuration of the parameter.
     *
     * @returns The tooltip configuration of the parameter or undefined
     */
    getTooltip(): TooltipConfiguration | undefined {
        return this.tooltip;
    }

    /**
     * Creates a new service configuration parameter with valid name and value type.
     *
     */
    static create(props: ServiceParameter): ServiceParameterEntity | never {
        if (!props.name || props.name.trim() === "") {
            throw new Error("ServiceParameter: Property 'name' cannot be empty.");
        }

        if (!props.value) {
            throw new Error("ServiceParameter: Property 'value' cannot be null.");
        }
        return new ServiceParameterEntity(props);
    }
}

const resolveParameterValueWithValue = (
    parameter: ServiceParameterEntity,
    selectedParameterValues: ResolvedParameterValue[]
): ResolvedParameterValue => {
    return parameter.getParameterValue().setValue(getParameterValue(parameter.id, selectedParameterValues));
};

const getParameterValue = (parameterId: ServiceParameter.Id, selectedParameterValues: ResolvedParameterValue[]): string => {
    const parameterValue = selectedParameterValues.find(value => value.getParameterId() === parameterId);

    if (parameterValue?.getKind() === "discrete") {
        return (parameterValue as ResolvedDiscreteValue).getOptions().find(opt => opt.value === parameterValue.getValue())?.label ?? "";
    }

    return (parameterValue?.getValue() as string) ?? "";
};
