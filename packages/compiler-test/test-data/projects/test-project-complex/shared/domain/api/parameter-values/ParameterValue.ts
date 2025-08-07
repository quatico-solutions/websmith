import { type ServiceParameter } from "../configuration";
import type { ParameterPrice } from "../pricing";
import type { BooleanValue } from "./BooleanValue";
import type { DiscreteValue } from "./DiscreteValue";
import type { RangeValue } from "./RangeValue";
import type { TextValue } from "./TextValue";
/**
 * The base type of parameter values provides all command properties.
 * All parameter value types inherit from this type to allow users to specify
 * a price and a value.
 */
export type ParameterValue<VALUE = unknown> = {
    /**
     * The kind of parameter value used for serialization and deserialization.
     */
    kind: ParameterValueKind;

    /**
     * Optional price for the parameter value, e.g., a discrete value has no price, but its options do.
     *
     * Defaults to undefined.
     */
    price?: ParameterPrice;

    /**
     * Optional value property to specify the value of the parameter value.
     *
     * Defaults to undefined.
     */
    value?: VALUE;
    /**
     * The id of the parameter this value is for.
     */
    parameterId?: ServiceParameter.Id;
};

/**
 * The type of parameter values that are bound to a service configuration parameter.
 */
export type BoundParameterValue<VALUE = unknown> = ParameterValue<VALUE> & {
    /**
     * The parameter id to specify the parameter id of the parameter value.
     */
    parameterId: ServiceParameter.Id;
};

/**
 * The kind of parameter value used for serialization and deserialization.
 */
export type ParameterValueKind = "discrete" | "range" | "boolean" | "text";

/**
 * Type guard to check if the value is a discrete value.
 */
export const isDiscrete = (value: ParameterValue): value is DiscreteValue => {
    return value.kind === "discrete";
};

/**
 * Type guard to check if the value is a range value.
 */
export const isRange = (value: ParameterValue): value is RangeValue => {
    return value.kind === "range";
};

/**
 * Type guard to check if the value is a boolean value.
 */
export const isBoolean = (value: ParameterValue): value is BooleanValue => {
    return value.kind === "boolean";
};

/**
 * Type guard to check if the value is a text value.
 */
export const isText = (value: ParameterValue): value is TextValue => {
    return value.kind === "text";
};
