/* eslint-disable @typescript-eslint/no-namespace */
import { type Address, type Contact, type Name } from "../contacts";

/**
 * A customer data object represents a company that buys a configurable service.
 *
 * CustomerData are provided by the user during checkout, in order to
 * associate the order with a customer.
 */
export interface CustomerData {
    /**
     * The company name of the customer.
     */
    name: Name;

    /**
     * An optional property to store the description of the customer.
     */
    description?: string;

    /**
     * The address of the customer's company.
     */
    address: Address;

    /**
     * An optional property to store the domain of the customer.
     */
    domain?: string;

    /**
     * An optional property to store the industry of the customer.
     */
    industry?: string;

    /**
     * An optional property to store the website of the customer.
     */
    website?: string;

    /**
     * The sales contact person within the service providing company that is responsible for the customer.
     */
    salesContact?: Contact.Id;

    /**
     * The primary contact person within the customer company that is responsible for the order.
     */
    primaryContact?: Contact.Id;
}

/**
 * A customer object represents a company that buys a configurable service.
 *
 * Customers are persisted in the CRM and created from CustomerData.
 */
export interface Customer extends CustomerData {
    /**
     * The id of the customer.
     */
    id: Customer.Id;

    /**
     * The date and time the customer was created in the CRM.
     */
    createdAt?: Date;

    /**
     * The date and time the customer was last updated in the CRM.
     */
    updatedAt?: Date;
}

export namespace Customer {
    /**
     * The id of the customer to identify it.
     *
     * Must be a non-empty ID string.
     */
    export type Id = string;

    /**
     * Creates a new customer ID.
     *
     * @param value The value to create the ID from.
     * @returns The new customer ID.
     */
    export const Id = (_value: string) => {
        throw new Error("Customer: Property 'id' cannot be empty.");
    };

    /**
     * Creates a new customer ID.
     *
     * @returns The new customer ID.
     */
    export const createId = (): Id => {
        return Id(crypto.randomUUID());
    };
}
