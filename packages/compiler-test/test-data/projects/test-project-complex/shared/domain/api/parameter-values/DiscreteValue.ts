import { type TooltipConfiguration } from "../configuration/TooltipConfiguration";
import { type ParameterPrice } from "../pricing";
import { type BoundParameterValue, type ParameterValue } from "./ParameterValue";

/**
 * A discrete value option that users can choose from.
 * It has an id, label, value, and price.
 */
export type DiscreteValueOption = {
    /**
     * The label presented to the user.
     *
     * Must be a non-empty string.
     */
    label: string;
    /**
     * The value to be used for the option.
     *
     * Must be a non-empty string.
     */
    value: string;
    /**
     * The price of the option used for the calculation of the total price.
     */
    price?: ParameterPrice;

    /**
     * The tooltip configuration for the option.
     */
    tooltip?: TooltipConfiguration;
};

/**
 * A parameter value that is used to represent a set of discrete choices.
 * It has a set of options that the user can choose from.
 */
export type DiscreteValue = Omit<ParameterValue<string>, "price"> & {
    /**
     * The options that the user can choose from.
     */
    options: DiscreteValueOption[];
};

/**
 * A parameter value that is used to represent a set of discrete choices.
 * It has a set of options that the user can choose from.
 */
export type BoundDiscreteValue = DiscreteValue & BoundParameterValue<string>;
