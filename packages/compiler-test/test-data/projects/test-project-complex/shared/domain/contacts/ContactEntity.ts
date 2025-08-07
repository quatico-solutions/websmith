import { type Contact, type Customer, type EmailAddress, type Name, type PhoneNumber } from "../api";
import { Entity } from "../base";
import { CustomerEntity } from "../commerce/CustomerEntity";
import { type ContactRepository } from "./ContactRepository";

/**
 * A contact entity represents a contact person. A contact person is a person
 * who is associated with a customer.
 *
 * @see CustomerEntity
 */
export class ContactEntity extends Entity<Contact> implements Contact {
    readonly firstName?: Name;
    readonly lastName?: Name;
    readonly email: EmailAddress;
    readonly phone?: PhoneNumber;
    readonly customer?: Customer.Id;

    constructor(props: Contact) {
        super(props.id);

        this.firstName = props.firstName;
        this.lastName = props.lastName;
        this.email = props.email;
        this.phone = props.phone;
        this.customer = props.customer;
    }

    /**
     * Converts the contact entity to an external data that are used in
     * templates to render the contact information.
     *
     * @returns The external data object.
     */
    toExternalData(): Record<string, string> {
        return {
            ...(this.firstName && { firstName: this.firstName }),
            ...(this.lastName && { lastName: this.lastName }),
            email: this.email,
            ...(this.phone && { phone: this.phone }),
        };
    }

    /**
     * Resolves the customer associated with the contact.
     *
     * @returns The customer associated with the contact.
     * @throws An error if no repository is registered.
     */
    async getCustomer(): Promise<CustomerEntity | undefined> {
        if (!this.customer) {
            return undefined;
        }

        const repository = ContactEntity.getRepository("getCustomer");
        return CustomerEntity.create(await repository.loadCustomer(this.customer))!;
    }

    /**
     * Updates the contact in the repository and returns the updated contact.
     *
     * @param props The properties to update the contact with.
     * @returns The updated contact.
     * @throws An error if no repository is registered.
     */
    async update(props: Partial<ContactEntity>): Promise<ContactEntity> {
        const repository = ContactEntity.getRepository("update");

        const values = { ...this } as Contact;
        if (!props.phone || props.phone.valueOf() === "") {
            values.phone = undefined;
        }

        return ContactEntity.create(await repository.store({ ...values, ...props, id: this.id }));
    }

    /**
     * Stores the contact in the repository and returns the stored contact.
     *
     * @returns The stored contact.
     * @throws An error if no repository is registered.
     */
    async store(): Promise<ContactEntity> {
        return ContactEntity.create(await ContactEntity.getRepository("store").store(this));
    }

    /**
     * Gets or creates a contact in the repository and returns the contact.
     *
     * @param contact The contact to get or create.
     * @returns The contact.
     * @throws An error if no repository is registered.
     */
    static async getOrCreate(contact: Contact): Promise<ContactEntity> {
        return ContactEntity.create(await ContactEntity.getRepository("getOrCreate").getOrCreate(contact));
    }

    /**
     * Finds or creates a contact in the repository and returns the contact.
     * This method is used to create a contact entity from an email address
     * provided by the user.
     *
     * @param email The email address of the contact to find or create.
     * @returns The contact.
     * @throws An error if no repository is registered.
     */
    static async findOrCreateByEmail(email: EmailAddress): Promise<ContactEntity> {
        return ContactEntity.create(
            await ContactEntity.getRepository("findOrCreateByEmail").findOrCreateByEmail(email)
        );
    }

    /**
     * Loads a contact from the repository and returns the contact.
     *
     * @param id The ID of the contact to load.
     * @returns The contact.
     * @throws An error if no repository is registered.
     */
    static async load(id: Contact.Id): Promise<ContactEntity | undefined> {
        const repository = ContactEntity.getRepository("load");
        return ContactEntity.create(await repository.load(id));
    }

    // Method overloading to allow for undefined values
    static create(props: Contact): ContactEntity;
    static create(props: Contact | undefined | null): undefined;

    /**
     * Creates a new contact entity from a contact object.
     *
     * @param props The contact object to create the entity from.
     * @returns The created contact entity.
     */
    static create(props: Contact | undefined | null): ContactEntity | undefined {
        if (!props) {
            return undefined;
        }
        return new ContactEntity(props);
    }

    private static getRepository(methodName: string): ContactRepository {
        throw new Error(`ContactEntity: Cannot call "${methodName}" without a repository.`);
    }
}
