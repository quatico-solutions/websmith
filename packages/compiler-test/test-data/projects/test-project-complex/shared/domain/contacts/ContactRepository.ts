import { type Contact, type Customer, type EmailAddress } from "../api";

/**
 * A repository to manage contact entities. This repository uses the CRM
 * connector to manage contact entities.
 *
 * @see ContactEntity
 */
export interface ContactRepository {
    /**
     * Loads a contact from the repository.
     *
     * @param id The ID of the contact to load.
     * @returns The loaded contact.
     */
    load(id: Contact.Id): Promise<Contact | undefined>;

    /**
     * Stores a contact in the repository.
     *
     * @param contact The contact to store.
     * @returns The stored contact.
     */
    store(contact: Contact): Promise<Contact>;

    /**
     * Loads a customer from the repository.
     *
     * @param id The ID of the customer to load.
     * @returns The loaded customer or undefined if the customer is not found.
     */
    loadCustomer(id: Customer.Id): Promise<Customer | undefined>;

    /**
     * Gets or creates a contact in the repository.
     *
     * @param contact The contact to get or create.
     * @returns The contact.
     */
    getOrCreate(contact: Contact): Promise<Contact>;

    /**
     * Finds or creates a contact in the repository.
     *
     * @param email The email address of the contact to find or create.
     * @returns The contact.
     */
    findOrCreateByEmail(email: EmailAddress): Promise<Contact>;
}
/**
 * The token to identify the contact repository for dependency injection.
 */
export const ContactRepositoryToken = "ContactRepository";
