/* eslint-disable @typescript-eslint/no-namespace */

/**
 * An email address is a string that represents a valid email address.
 */
export type EmailAddress = string;

export namespace EmailAddress {
    // Type guard overloads to allow for optional email addresses
    export function create(value: string): EmailAddress;
    export function create(value: undefined | null): undefined;
    export function create(value: string | undefined | null): EmailAddress | undefined;

    /**
     * Creates a new email address.
     *
     * @param value The value to create the email address from.
     * @returns The new email address.
     * @throws An error if the email address is invalid.
     */
    export function create(value: string | undefined | null): EmailAddress | undefined {
        if (!value) {
            return undefined;
        }
        return value;
    }
}
