import { type CustomerData, type Contact, type Customer } from "../api";

/**
 * A repository to manage customer and contact entities. This repository uses
 * the CRM connector to manage customer and contact entities.
 *
 * @see CustomerEntity
 * @see ContactEntity
 */
export interface CustomerRepository {
    /**
     * Loads a customer entity from the repository for the given ID.
     *
     * @param id The id of the customer to load.
     * @returns The customer entity or undefined if the customer is not found.
     */
    load(id: Customer.Id): Promise<Customer | undefined>;

    /**
     * Finds or creates a new customer entity from a customer data object.
     *
     * @param data The customer data object to find or create.
     * @returns The customer entity.
     */
    findOrCreateByPostalAddress(data: CustomerData): Promise<Customer>;

    /**
     * Stores a customer entity in the repository.
     *
     * @param customer The customer entity to store.
     * @returns The stored customer entity.
     */
    store(customer: Customer): Promise<Customer>;

    /**
     * Loads a contact entity from the repository for the given ID.
     *
     * @param id The id of the contact to load.
     * @returns The contact entity or undefined if the contact is not found.
     */
    loadContact(id: Contact.Id): Promise<Contact | undefined>;

    /**
     * Gets or creates a new customer entity from a customer object.
     *
     * @param customer The customer object to get or create.
     * @returns The customer entity.
     */
    getOrCreate(customer: Customer): Promise<Customer>;
}

/**
 * The token to identify the repository for dependency injection.
 */
export const CustomerRepositoryToken = "CustomerRepository";
