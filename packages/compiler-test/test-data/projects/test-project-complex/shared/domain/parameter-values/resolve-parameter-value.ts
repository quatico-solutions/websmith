import { type BoundParameterValue, isBoolean, isDiscrete, isRange, isText } from "../api";
import { ResolvedBooleanValue } from "./ResolvedBooleanValue";
import { ResolvedDiscreteValue } from "./ResolvedDiscreteValue";
import { type ResolvedParameterValue } from "./ResolvedParameterValue";
import { ResolvedRangeValue } from "./ResolvedRangeValue";
import { ResolvedTextValue } from "./ResolvedTextValue";

/**
 * Resolves a parameter value to a specific type.
 *
 * @param value The bound parameter value to resolve.
 * @returns The resolved parameter value.
 */
export const resolveParameterValue = (value: BoundParameterValue): ResolvedParameterValue | never => {
    if (isDiscrete(value)) {
        return ResolvedDiscreteValue.create(value);
    }
    if (isRange(value)) {
        return ResolvedRangeValue.create(value);
    }
    if (isBoolean(value)) {
        return ResolvedBooleanValue.create(value);
    }
    if (isText(value)) {
        return ResolvedTextValue.create(value);
    }
    throw new Error(
        `ParameterValue: Cannot resolve parameter value with unknown kind '${String(value?.kind ?? "null")}'.`
    );
};
