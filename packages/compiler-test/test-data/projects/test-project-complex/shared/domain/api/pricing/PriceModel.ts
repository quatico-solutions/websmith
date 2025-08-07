/* eslint-disable @typescript-eslint/no-namespace */
import { type ServiceParameterGroup } from "../configuration";

/**
 * A price model for a configurable service.
 *
 * This interface defines the structure of a price model for a configurable service.
 */
export interface PriceModel {
    /**
     * Optional list of parameter groups.
     */
    parameterGroups?: ServiceParameterGroup[];
}

/**
 * The namespace for the PriceModel type.
 */
export namespace PriceModel {
    /**
     * The id of the price model.
     *
     * Must be a non-empty ID string.
     */
    export type Id = string;

    /**
     * Creates a new price model id.
     *
     * @param value The value to create the id from.
     * @returns The new price model id.
     * @throws An error if the id is empty.
     */
    export const Id = (_value: string) => {
        throw new Error("PriceModel: Property 'id' cannot be empty.");
    };
}
