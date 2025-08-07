import { type BoundParameterValue, type ParameterValue } from "./ParameterValue";

/**
 * A value that represents a range of numbers.
 */
export type RangeValue = ParameterValue<number> & {
    /**
     * An optional minimum value of the range. Must be less than or equal to the maximum value.
     *
     * Defaults to 0.
     */
    min?: number;
    /**
     * An optional maximum value of the range. Must be greater than or equal to the minimum value.
     *
     * Defaults to 100.
     */
    max?: number;
    /**
     * An optional step of the range. Must be greater than 0.
     *
     * Defaults to 1.
     */
    step?: number;
    /**
     * An optional label of the range.
     *
     * Defaults to "".
     */
    label?: string;
    /**
     * An optional unit of the range.
     *
     * Defaults to "".
     */
    unit?: string;
};

/**
 * A parameter value that is used to represent a range of numbers.
 */
export type BoundRangeValue = RangeValue & BoundParameterValue<number>;
