import { type Context, type Serialization } from "./magellan-shared";
import {
    ConfigurableService,
    ConfigurableServiceEntity,
    Logger,
    type Order,
    OrderEntity,
    type QuoteDocument,
    QuoteDocumentValue,
} from "./shared";

const logger = Logger.create("get-quote-order-confirmation-service");

type OrderConfirmationDocumentInput = {
    orderId: Order.Id;
};

// @service({"namespace":"cds-cpq-no-auth"})
export const getOrderConfirmationDocument = async (
    input: OrderConfirmationDocumentInput,
    _context?: Context,
    _serialization?: Serialization
): Promise<QuoteDocument> => {
    const { orderId } = input;

    const order = await OrderEntity.load(orderId);

    if (!order) {
        logger.error(`Order with id "${orderId}" not found.`);
        throw new Error(`Order with id "${orderId}" not found.`);
    }

    const config = (await order.getConfigurations())[0]!;

    if (!config) {
        logger.error(`No service configuration found for order with id "${orderId}".`);
        throw new Error(`No service configuration found for order with id "${orderId}".`);
    }

    const customer = await order.getCustomer();
    if (!customer) {
        logger.error(`No customer found for order with id "${orderId}".`);
        throw new Error(`No customer found for order with id "${orderId}".`);
    }

    const primaryContact = await customer.getPrimaryContact();
    if (!primaryContact) {
        logger.error(`No primary contact found for customer with id "${customer.id}".`);
        throw new Error(`No primary contact found for customer with id "${customer.id}".`);
    }

    const configurableService = await ConfigurableServiceEntity.loadOrFind(
        ConfigurableService.Id(config.serviceId)
    );
    if (!configurableService) {
        logger.error(`No configurable service found for service id "${config.serviceId}".`);
        throw new Error(`No configurable service found for service id "${config.serviceId}".`);
    }

    const provider = configurableService.getProvider();
    if (!provider) {
        logger.error(`No provider found for service id "${config.serviceId}".`);
        throw new Error(`Quote Request Submission: No provider found for service id "${config.serviceId}".`);
    }

    return QuoteDocumentValue.create({
        content: Buffer.from("foobar").toString("base64"),
    });
};
