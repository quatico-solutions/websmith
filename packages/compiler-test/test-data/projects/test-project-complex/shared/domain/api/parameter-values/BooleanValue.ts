import { type BoundParameterValue, type ParameterValue } from "./ParameterValue";

/**
 * A parameter value that is used to represent binary choices.
 * It has a true label and a false label.
 */
export type BooleanValue = ParameterValue<boolean> & {
    /**
     * The label for the true value.
     *
     * Must be a non-empty string.
     */
    trueLabel: string;
    /**
     * The label for the false value.
     *
     * Must be a non-empty string.
     */
    falseLabel: string;
};

/**
 * A boolean value that is bound to a service configuration parameter.
 */
export type BoundBooleanValue = BooleanValue & BoundParameterValue<boolean>;
