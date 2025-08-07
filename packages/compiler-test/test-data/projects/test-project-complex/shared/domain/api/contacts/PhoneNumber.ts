/* eslint-disable @typescript-eslint/no-namespace */
const phoneValidation = /^(?:\+41\s?|0)(?:\d{2}|\d{3})\s?\d{3}\s?\d{2}\s?\d{2}$|^\d{9}$/;

/**
 * A phone number is a string that represents a valid phone number.
 */
export type PhoneNumber = string;

export namespace PhoneNumber {
    // Type guard overloads to allow for optional phone numbers
    export function create(value: string): PhoneNumber;
    export function create(value: undefined | null): undefined;
    export function create(value: string | undefined | null): PhoneNumber | undefined;

    /**
     * Creates a new phone number.
     *
     * @param value The value to create the phone number from.
     * @returns The new phone number.
     * @throws An error if the phone number is invalid.
     */
    export function create(value: string | undefined | null): PhoneNumber | undefined {
        if (!value) {
            return undefined;
        }
        return value;
    }

    /**
     * The pattern to validate phone numbers.
     */
    export const validatePattern = phoneValidation;
}
