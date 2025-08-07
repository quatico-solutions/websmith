import { type Order, type ServiceConfiguration } from "../api";

/**
 * A repository to manage order entities associated service configurations. This
 * repository uses the CRM and data connectors to store and load order entities.
 *
 * @see OrderEntity
 * @see ServiceConfigurationEntity
 */
export interface OrderRepository {
    /**
     * Stores an order entity in the repository.
     *
     * @param order The order entity to store.
     * @returns The stored order entity.
     */
    store(order: Order): Promise<Order>;

    /**
     * Loads an order entity from the repository for the given ID.
     *
     * @param id The ID of the order to load.
     * @returns The loaded order entity or undefined if the order is not found.
     */
    load(id: Order.Id): Promise<Order | undefined>;

    /**
     * Loads an order entity from the repository for the given number.
     *
     * @param number The number of the order to load.
     * @returns The loaded order entity or undefined if the order is not found.
     */
    loadByNumber(number: Order.Number): Promise<Order | undefined>;

    /**
     * Gets or creates an order entity from the repository for the given ID.
     *
     * @param id The ID of the order to get or create.
     * @returns The order entity.
     */
    getOrCreate(id?: Order.Id): Promise<Order>;

    /**
     * Loads the configurations of an order from the repository.
     *
     * @param orderId The ID of the order to load the configurations for.
     * @returns The loaded configurations.
     */
    loadConfigurations(orderId: Order.Id): Promise<ServiceConfiguration[]>;

    /**
     * Stores the configurations of an order in the repository.
     *
     * @param orderId The ID of the order to store the configurations for.
     * @param configurations The configurations to store.
     * @returns The ID of the order.
     */
    storeConfigurations(orderId: Order.Id, configurations: ServiceConfiguration[]): Promise<Order.Id>;
}

/**
 * The token to identify the order repository for dependency injection.
 */
export const OrderRepositoryToken = "OrderRepository";
