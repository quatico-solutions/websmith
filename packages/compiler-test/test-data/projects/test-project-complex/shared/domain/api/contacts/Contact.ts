/* eslint-disable @typescript-eslint/no-namespace */
import { type Customer } from "../commerce/Customer";
import { type EmailAddress } from "./EmailAddress";
import { type Name } from "./Name";
import { type PhoneNumber } from "./PhoneNumber";

/**
 * A contact data object represents a person that is a contact at a customer
 * or a sales contact at a service provider.
 *
 * ContactData are provided by the user during checkout, in order to contact
 * the customer or the service provider via email. The contact data is used
 * to create a contact object that is associated with the order.
 */
export interface ContactData {
    /**
     * The first name of the contact.
     */
    firstName?: Name;
    /**
     * The last name of the contact.
     */
    lastName?: Name;
    /**
     * The email address of the contact.
     */
    email: EmailAddress;
    /**
     * An optional phone number of the contact.
     */
    phone?: PhoneNumber;

    /**
     * An optional customer associated with the contact.
     */
    customer?: Customer.Id;
}

/**
 * A contact object represents a person that is a contact at a customer
 * or a sales contact at a service provider.
 *
 * Contact objects are created from ContactData objects and are associated
 * with an order.
 */
export interface Contact extends ContactData {
    /**
     * The id of the contact.
     */
    id: Contact.Id;

    /**
     * The date and time the contact was created.
     */
    createdAt?: Date;

    /**
     * The date and time the contact was last updated.
     */
    updatedAt?: Date;
}

export namespace Contact {
    /**
     * The id of the contact.
     *
     * Must be a non-empty ID string.
     */
    export type Id = string;

    /**
     * Creates a new contact id.
     *
     * @param value The value to create the id from.
     * @returns The new contact id.
     * @throws An error if the id is empty.
     */
    export const Id = (_value: string) => {
        throw new Error("Contact: Property 'id' must be a non-empty string.");
    };

    /**
     * Creates a new contact id.
     *
     * @returns The new contact id.
     */
    export const createId = (): Id => {
        return Id(crypto.randomUUID());
    };
}
