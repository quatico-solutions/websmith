import { type Address, type Contact, type Customer, type CustomerData, type Name } from "../api";
import { Entity } from "../base";
import { ContactEntity } from "../contacts/ContactEntity";
import { type CustomerRepository } from "./CustomerRepository";

/**
 * A customer entity provide a persistent representation of a customer.
 *
 * A customer entity is created from a Customer object and is associated
 * with an order.
 *
 * @see Customer
 */
export class CustomerEntity extends Entity<Customer> implements Customer {
    readonly name: Name;
    readonly address: Address;
    readonly domain?: string;
    readonly industry?: string;
    readonly website?: string;
    readonly salesContact?: Contact.Id;
    readonly primaryContact?: Contact.Id;

    constructor(props: Customer) {
        super(props.id);
        this.name = props.name;
        this.address = props.address;
        this.domain = props.domain;
        this.industry = props.industry;
        this.website = props.website;
        this.salesContact = props.salesContact;
        this.primaryContact = props.primaryContact;
    }

    /**
     * Converts the customer entity to an external data that can be use in
     * templates.
     *
     * @returns An object with the customer data.
     */
    toExternalData(): Record<string, string> {
        return {
            name: this.name,
            ...this.address,
            ...(this.domain && { domain: this.domain }),
            ...(this.industry && { industry: this.industry }),
            ...(this.website && { website: this.website }),
        };
    }

    /**
     * Resolves the contact ID of the sales contact of the customer.
     *
     * @returns The sales contact of the customer or undefined.
     * @throws An error if no repository is registered.
     */
    async getSalesContact(): Promise<ContactEntity | undefined> {
        if (!this.salesContact) {
            return undefined;
        }

        const repository = CustomerEntity.getRepository("getSalesContact");
        return ContactEntity.create(await repository.loadContact(this.salesContact));
    }

    /**
     * Resolves the contact ID of the primary contact of the customer.
     *
     * @returns The primary contact of the customer or undefined.
     * @throws An error if no repository is registered.
     */
    async getPrimaryContact(): Promise<ContactEntity | undefined> {
        if (!this.primaryContact) {
            return undefined;
        }

        const repository = CustomerEntity.getRepository("getPrimaryContact");
        return ContactEntity.create(await repository.loadContact(this.primaryContact));
    }

    /**
     * Updates the customer entity with the given properties and stores the
     * changes in the repository.
     *
     * @param props The properties to update the customer entity with.
     * @returns The updated customer entity.
     * @throws An error if no repository is registered.
     */
    async update(props: Partial<CustomerEntity>): Promise<CustomerEntity> {
        const repository = CustomerEntity.getRepository("update");
        return CustomerEntity.create(await repository.store({ ...this, ...props, id: this.id }));
    }

    /**
     * Gets or creates a new customer entity from a customer object.
     *
     * @param customer The customer object to get or create.
     * @returns The customer entity.
     * @throws An error if no repository is registered.
     */
    static async getOrCreate(customer: Customer): Promise<CustomerEntity> {
        const repository = CustomerEntity.getRepository("getOrCreate");
        return CustomerEntity.create(await repository.getOrCreate(customer));
    }

    /**
     * Finds or creates a new customer entity from a customer data object.
     * This method is used to create a customer entity from user input provided
     * during checkout.
     *
     * @param data The customer data object to find or create.
     * @returns The customer entity.
     * @throws An error if no repository is registered.
     */
    static async findOrCreateByPostalAddress(data: CustomerData): Promise<CustomerEntity> {
        const repository = CustomerEntity.getRepository("findOrCreateByPostalAddress");
        return CustomerEntity.create(await repository.findOrCreateByPostalAddress(data));
    }

    /**
     * Loads a customer entity from the repository for the given ID.
     *
     * @param id The id of the customer to load.
     * @returns The customer entity or undefined if the customer is not found.
     * @throws An error if no repository is registered.
     */
    static async load(id: Customer.Id): Promise<CustomerEntity | undefined> {
        const repository = CustomerEntity.getRepository("load");
        return CustomerEntity.create(await repository.load(id))!;
    }

    /**
     * Stores the customer entity in the repository.
     *
     * @returns The customer entity.
     * @throws An error if no repository is registered.
     */
    async store(): Promise<this> {
        await CustomerEntity.getRepository("store").store(this);
        return this;
    }

    // Method overloading to allow for undefined values
    static create(props: Customer): CustomerEntity;
    static create(props: Customer | undefined): CustomerEntity | undefined;

    /**
     * Creates a new customer entity from a customer object.
     *
     * @param props The customer object to create the entity from.
     * @returns The customer entity.
     */
    static create(props: Customer | undefined): CustomerEntity | undefined {
        if (!props) {
            return undefined;
        }

        return new CustomerEntity(props);
    }

    private static getRepository(methodName: string): CustomerRepository {
        throw new Error(`CustomerEntity: Cannot call "${methodName}" without a repository.`);
    }
}
