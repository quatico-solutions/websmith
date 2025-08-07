import { type Context, type Serialization } from "../../magellan-shared";
import { ConfigurableService, ConfigurableServiceEntity, Logger, type Order, OrderEntity, OrderStage } from "../../shared";

export type SubmitOrderRequestInput = {
    orderId: Order.Id;
};

const logger = Logger.create("submit-order-request");

// TODO: add unit tests for this function
// @service({"namespace":"cds-cpq-no-auth"})
export const submitOrderRequest = async (input: SubmitOrderRequestInput, _context?: Context, _serialization?: Serialization): Promise<Order> => {
    logger.debug("Quote Request Submission start");
    logger.debug(`Input: ${JSON.stringify(input)}`);

    if (!process.env.CDS_CPQ_FRONTEND_URL) {
        return Promise.reject(new Error("Quote Request Submission: 'CDS_CPQ_FRONTEND_URL' must be set."));
    }

    const { orderId } = input;

    const existingOrder = await OrderEntity.load(orderId);
    if (!existingOrder) {
        logger.error(`Could not request order for orderId:"${orderId}"." `);
        throw new Error(`Could not request order for orderId:"${orderId}"." `);
    }

    const existingCustomer = await existingOrder.getCustomer();
    if (!existingCustomer) {
        logger.error(`No customer found for order with id "${orderId}".`);
        throw new Error(`No customer found for order with id "${orderId}".`);
    }

    const existingContact = await existingCustomer?.getPrimaryContact();
    if (!existingContact) {
        logger.error(`No primary contact found for customer with id "${existingCustomer.id}".`);
        throw new Error(`No primary contact found for customer with id "${existingCustomer.id}".`);
    }
    if (!existingOrder) {
        logger.error(`No Order found with id "${orderId}".`);
        throw new Error(`No Order found with id "${orderId}".`);
    }
    if (existingOrder.stage === OrderStage.Draft) {
        logger.error(`Order with id "${orderId}" is in stage draft.`);
        throw new Error(`Order with id "${orderId}" is in stage draft.`);
    }

    const config = (await existingOrder.getConfigurations())[0]!;
    if (!config) {
        logger.error(`No service configuration found for order with id "${orderId}".`);
        throw new Error(`No service configuration found for order with id "${orderId}".`);
    }

    const configurableService = await ConfigurableServiceEntity.loadOrFind(ConfigurableService.Id(config.serviceId));
    if (!configurableService) {
        logger.error(`No configurable service found for service id "${config.serviceId}".`);
        throw new Error(`No configurable service found for service id "${config.serviceId}".`);
    }

    const provider = configurableService.getProvider();
    if (!provider) {
        logger.error(`No provider found for service id "${config.serviceId}".`);
        throw new Error(`Quote Request Submission: No provider found for service id "${config.serviceId}".`);
    }

    const requestedOrder = await OrderEntity.requestOrder(orderId);

    const email = existingContact.email;
    if (!email) {
        throw new Error("No email address found for existingCustomer with id " + existingCustomer.id);
    }

    await existingOrder.update({
        stage: OrderStage.Ordered,
        orderedAt: new Date(),
    });

    logger.debug("Order Request Submission success");
    return requestedOrder;
};
