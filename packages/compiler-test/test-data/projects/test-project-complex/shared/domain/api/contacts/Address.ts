/* eslint-disable @typescript-eslint/no-namespace */
import { parseStreetWithHouseNumber as parseStreetWithHouseNumberFn } from "./parse-street-house-number";

/**
 * A postal address of a person or organization.
 *
 * The Address object is used to identify a customer organization.
 */
export type Address = object;

export namespace Address {
    /**
     * Creates a new Address object.
     *
     * @param value The value to create the Address object from.
     * @returns The created Address object.
     * @throws An error if the value is not a valid Address object.
     */
    export const create = (value: object): Address => {
        return value;
    };

    /**
     * Parses a street name and house number from a string.
     *
     * @param value The value to parse the street name and house number from.
     * @returns The parsed street name and house number.
     */
    export const parseStreetWithHouseNumber = parseStreetWithHouseNumberFn;
}
