/* eslint-disable @typescript-eslint/no-namespace */
/**
 * A name is a string that represents a non-empty name, e.g. for a person or company.
 */
export type Name = string;

export namespace Name {
    // Type guard overloads to allow for optional names
    export function create(value: string): Name;
    export function create(value: undefined | null): undefined;
    export function create(value: string | undefined | null): Name | undefined;

    /**
     * Creates a new name.
     *
     * @param value The value to create the name from.
     * @returns The new name.
     * @throws An error if the name is empty.
     */
    export function create(value: string | undefined | null): Name | undefined {
        if (value === undefined || value === null) {
            return undefined;
        }
        return value;
    }
}
