import {
    type BoundParameterValue,
    type ConfigurableService,
    type Customer,
    type Order,
    type OrderPrice,
    OrderStage,
    type ServiceConfiguration,
} from "../api";
import { Entity } from "../base";
import { ConfigurableServiceEntity, ServiceConfigurationEntity } from "../configuration";
import { resolveParameterValue } from "../parameter-values";
import { ResolvedOrderPrice } from "../pricing";
import { CustomerEntity } from "./CustomerEntity";
import { type OrderRepository } from "./OrderRepository";

/**
 * A order entity provide a persistent representation of an order.
 *
 * An order entity is created from an Order object and is associated with a
 * customer. It is used to manage orders and their configurations.
 *
 * @see Order
 */
export class OrderEntity extends Entity<Order> implements Order {
    readonly number: Order.Number;
    readonly stage: OrderStage;
    readonly cancellationReason?: string;
    readonly configurations: ServiceConfiguration.Id[];
    readonly price?: OrderPrice;
    readonly name?: string;
    readonly summary?: string;
    readonly customer?: Customer.Id;
    readonly offeredAt?: Date;
    readonly orderedAt?: Date;
    readonly createdAt?: Date;
    readonly updatedAt?: Date;
    readonly cancelledAt?: Date;
    #loadedConfigurations?: ServiceConfigurationEntity[];

    constructor(order: Order) {
        super(order.id);
        this.number = order.number;
        this.stage = order.stage;
        this.cancellationReason = order.cancellationReason;
        this.configurations = order.configurations;
        this.price = order.price;
        this.name = order.name;
        this.summary = order.summary;
        this.offeredAt = order.offeredAt;
        this.orderedAt = order.orderedAt;
        this.createdAt = order.createdAt;
        this.updatedAt = order.updatedAt;
        this.cancelledAt = order.cancelledAt;
    }

    /**
     * Resolves the customer entity of the order.
     *
     * @returns The customer entity or undefined if the customer is not found.
     * @throws An error if no repository is registered.
     */
    async getCustomer(): Promise<CustomerEntity | undefined> {
        if (!this.customer) {
            return undefined;
        }
        return CustomerEntity.load(this.customer);
    }

    /**
     * Resolves the service configuration entities of the order.
     *
     * @returns The service configuration entities.
     * @throws An error if the repository for service configurations is not
     * registered.
     * @throws An error if the order is not in draft stage and no service
     * configurations are found.
     * @throws An error if the order is not in draft stage and multiple service
     * configurations are found.
     */
    async getConfigurations(): Promise<ServiceConfigurationEntity[]> {
        let configurations = this.#loadedConfigurations;
        if (!configurations) {
            configurations = await Promise.all(
                this.configurations
                    .map(async it => await ServiceConfigurationEntity.load(it))
                    .filter(it => it !== undefined) as unknown as ServiceConfigurationEntity[]
            );
            this.#loadedConfigurations = configurations;
        }

        if (this.stage !== OrderStage.Draft && !configurations?.length) {
            throw new Error(`OrderEntity: No service configurations found for order id "${this.id}".`);
        }

        if (this.stage !== OrderStage.Draft && configurations.length > 1) {
            throw new Error(
                // eslint-disable-next-line max-len
                `OrderEntity: Multiple service configurations for order with id "${this.id}" are not supported yet.`
            );
        }

        return configurations ?? [];
    }

    /**
     * Gets the summary of the order.
     *
     * @returns The summary of the order.
     */
    async getSummary(): Promise<string> {
        if (this.summary) {
            return Promise.resolve(this.summary);
        }
        return (await this.getConfigurations()).map(it => it.getSummary()).join("\n");
    }

    /**
     * Resolves the configurations and calculates the price of the order.
     *
     * @returns The price of the order.
     * @throws An error if the repository for service configurations is not
     * registered.
     */
    async getPrice(): Promise<ResolvedOrderPrice> {
        const configs = await this.getConfigurations();
        return new ResolvedOrderPrice(this.price ?? {}, configs);
    }

    /**
     * Updates the order entity with the given properties and stores the changes
     * in the repository.
     *
     * @param order The properties to update the order entity with.
     * @returns The updated order entity.
     * @throws An error if no repository is registered.
     */
    async update(order: Partial<OrderEntity>): Promise<OrderEntity> {
        const repository = OrderEntity.getRepository("update");
        return OrderEntity.create(
            await repository.store({
                ...this,
                ...order,
                id: this.id,
            })
        );
    }

    /**
     * Stores the order entity in the repository.
     *
     * @returns The stored order entity.
     * @throws An error if no repository is registered.
     */
    async store(): Promise<OrderEntity> {
        const repository = OrderEntity.getRepository("store");
        return OrderEntity.create(await repository.store(this));
    }

    /**
     * Updates the configurations of the order entity and stores the changes in
     * the repository.
     *
     * @param configurations The configurations to update the order entity with.
     * @returns The updated order entity.
     * @throws An error if no repository is registered.
     */
    async updateConfigurations(configurations: ServiceConfigurationEntity[]): Promise<OrderEntity> {
        await Promise.all(configurations.map(it => it.store()));

        return OrderEntity.create({
            ...this,
            configurations: configurations.map(it => it.getId()),
        });
    }

    /**
     * Gets or creates a new order entity from a service ID and selected parameter values.
     * This method is used to create a new order entity when a user adds a new service
     * configuration to a new order.
     *
     * @param serviceId The ID of the service to create the order for.
     * @param selectedParameterValues The selected parameter values to create the order with.
     * @param remarks The remarks to add to the order.
     * @returns The created order entity.
     * @throws An error if the repository for orders is not registered.
     * @throws An error if the configurable service is not found.
     */
    static async getOrCreateOrder(
        serviceId: ConfigurableService.Id,
        selectedParameterValues: BoundParameterValue[],
        remarks?: string,
        attachments?: ServiceConfiguration.Attachment[]
    ): Promise<OrderEntity> {
        const repository = OrderEntity.getRepository("getOrCreateOrder");
        const configurableService = await ConfigurableServiceEntity.loadOrFind(serviceId);
        const resolvedValues = selectedParameterValues.map(value => resolveParameterValue(value));

        if (!configurableService) {
            throw new Error(`OrderEntity: Configurable service with ID "${serviceId}" not found.`);
        }

        const newConfiguration = configurableService
            .applyConfiguration(resolvedValues)
            .addAttachments(attachments)
            .addRemarks(remarks);

        const configurationPrice = configurableService.calculatePrice(resolvedValues);

        // Create new order
        const newOrder = OrderEntity.create(await repository.getOrCreate());
        await newOrder.update({
            configurations: [newConfiguration.getId()],
            price: {
                subTotal: configurationPrice.getSubTotal(),
            },
        });
        return await newOrder.updateConfigurations([newConfiguration]);
    }

    /**
     * Offers an order to a customer.
     *
     * @param orderId The ID of the order to offer.
     * @returns The offered order entity.
     * @throws An error if the repository for orders is not registered.
     * @throws An error if the order is not found.
     */
    static async offerOrder(orderId: Order.Id): Promise<OrderEntity> {
        const order = await OrderEntity.load(orderId);
        if (!order) {
            throw new Error(`Order with id "${orderId}" not found.`);
        }
        if (!(order.stage === OrderStage.Created)) {
            throw new Error(`Order with id "${orderId}" is not in created stage.`);
        }

        // Change status to "Offered"
        return await order.update({ stage: OrderStage.Offered });
    }

    /**
     * Requests an order from a customer.
     *
     * @param orderId The ID of the order to request.
     * @returns The requested order entity.
     * @throws An error if the repository for orders is not registered.
     * @throws An error if the order is not found.
     */
    static async requestOrder(orderId: Order.Id): Promise<OrderEntity> {
        const order = await OrderEntity.load(orderId);
        if (!order) {
            throw new Error(`Order with id "${orderId}" not found.`);
        }
        if (![OrderStage.Created, OrderStage.Offered].includes(order.stage)) {
            throw new Error(`Order with id "${orderId}" is not in created or offered stage.`);
        }

        // Change status to "Ordered"
        return await order.update({ stage: OrderStage.Ordered, orderedAt: new Date() });
    }

    /**
     * Requests an offer from a customer.
     *
     * @param orderId The ID of the order to request.
     * @returns The requested order entity.
     * @throws An error if the repository for orders is not registered.
     * @throws An error if the order is not found.
     */
    static async requestOffer(orderId: Order.Id): Promise<OrderEntity> {
        const order = await OrderEntity.load(orderId);
        if (!order) {
            throw new Error(`Order with id "${orderId}" not found.`);
        }
        return await order.update({ stage: OrderStage.Offered, offeredAt: new Date() });
    }

    /**
     * Checks if an order is valid.
     *
     * @param order The order to check.
     * @returns True if the order is valid, false otherwise.
     */
    static isOrderValid(order: Order): order is Order & { id: string; price: OrderPrice } {
        return !!(order && order.id && order.id.trim() !== "" && order.price);
    }

    // Method overloading to allow for undefined values
    static create(order: Order): OrderEntity;
    static create(order: undefined | null): undefined;
    static create(order: Order | undefined | null): OrderEntity | undefined;

    /**
     * Creates a new order entity from an order object.
     *
     * @param order The order object to create the entity from.
     * @returns The created order entity.
     * @throws An error if the order is not valid.
     * @throws An error if the order ID is empty.
     * @throws An error if the order price is empty.
     */
    static create(order: Order | undefined | null): OrderEntity | undefined {
        if (!order) {
            return undefined;
        }
        if (!order.id || order.id.trim() === "") {
            throw new Error("OrderEntity: Property 'id' cannot be empty.");
        }

        if (!order.price) {
            throw new Error("OrderEntity: Property 'price' cannot be empty.");
        }
        return new OrderEntity(order);
    }

    /**
     * Loads an order entity from the repository for the given ID.
     *
     * @param id The ID of the order to load.
     * @returns The loaded order entity or undefined if the order is not found.
     * @throws An error if no repository is registered.
     */
    static async load(id: Order.Id): Promise<OrderEntity | undefined> {
        const repository = OrderEntity.getRepository("load");
        return OrderEntity.create(await repository.load(id));
    }

    /**
     * Loads an order entity from the repository for the given number.
     *
     * @param number The number of the order to load.
     * @returns The loaded order entity or undefined if the order is not found.
     * @throws An error if no repository is registered.
     */
    static async loadByNumber(number: Order.Number): Promise<OrderEntity | undefined> {
        const repository = OrderEntity.getRepository("loadByNumber");
        return OrderEntity.create(await repository.loadByNumber(number));
    }

    private static getRepository(methodName: string): OrderRepository {
        throw new Error(`OrderEntity: Cannot call "${methodName}" without a repository.`);
    }
}
