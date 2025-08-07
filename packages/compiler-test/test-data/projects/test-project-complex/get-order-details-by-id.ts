import { type Context, type Serialization } from "./magellan-shared";
import {
    type Customer,
    type Contact,
    type Order,
    OrderEntity,
    type ServiceConfiguration,
    ConfigurableServiceEntity,
    type ConfigurableService,
} from "./shared";

export type OrderWithConfigurations = {
    order: Order;
    configurations: ServiceConfiguration[];
    customer?: Customer;
    contact?: Contact;
    service?: ConfigurableService;
};

// @service({"namespace":"cds-cpq-no-auth"})
export const getOrderDetailsById = async (
    input: { orderId: Order.Id },
    _context?: Context,
    _serialization?: Serialization
): Promise<OrderWithConfigurations | undefined> => {
    const { orderId } = input;
    try {
        const order = await OrderEntity.load(orderId);
        if (!order) {
            throw new Error(`getOrderDetailsById failed: Order with id "${orderId}" not found.`);
        }
        const configurations = await order.getConfigurations();
        const customer = await order.getCustomer();
        const contact = await customer?.getPrimaryContact();
        const service = await ConfigurableServiceEntity.loadOrFind(
            configurations[0]?.serviceId as ConfigurableService.Id
        );
        return {
            order,
            configurations,
            customer,
            contact,
            service,
        };
    } catch (err) {
        return Promise.reject(new Error(`getOrderDetailsById failed: ${err}`));
    }
};
