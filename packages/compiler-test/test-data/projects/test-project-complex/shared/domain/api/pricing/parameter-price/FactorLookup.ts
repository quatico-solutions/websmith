import { type ServiceParameter } from "../../configuration";

/**
 * A dictionary of parameter IDs to their factor values.
 */
export interface FactorLookup {
    /**
     * Gets the factor value for a given parameter ID.
     *
     * @param parameterId The ID of the parameter to get the factor value for.
     * @returns The factor value for the parameter.
     */
    getValue(parameterId: ServiceParameter.Id): number | undefined;

    /**
     * Checks if a parameter ID is in the factor lookup.
     *
     * @param parameterId The ID of the parameter to check.
     * @returns True if the parameter ID is in the factor lookup, false otherwise.
     */
    contains(parameterId: ServiceParameter.Id): boolean;
}
