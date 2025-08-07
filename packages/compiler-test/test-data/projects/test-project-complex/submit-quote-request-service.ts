import { type Context, type Serialization } from "./magellan-shared";
import {
    ConfigurableService,
    ConfigurableServiceEntity,
    Logger,
    type Order,
    OrderEntity,
    type QuoteDocument,
} from "./shared";

export type SubmitQuoteRequestInput = {
    orderId: Order.Id;
};

const logger = Logger.create("submit-quote-request");

// @service({"namespace":"cds-cpq-no-auth"})
export const submitQuoteRequest = async (
    input: SubmitQuoteRequestInput,
    _context?: Context,
    _serialization?: Serialization
): Promise<QuoteDocument> => {
    logger.debug("Quote Request Submission start");
    logger.debug(`Input: ${JSON.stringify(input)}`);

    if (!process.env.CDS_CPQ_FRONTEND_URL) {
        logger.error("'CDS_CPQ_FRONTEND_URL' must be set.");
        throw new Error("Quote Request Submission: 'CDS_CPQ_FRONTEND_URL' must be set.");
    }

    const { orderId } = input;

    // check preconditions
    const existingOrder = await OrderEntity.load(orderId);
    if (!existingOrder) {
        logger.error(`No Order found with id "${orderId}".`);
        throw new Error(`No Order found with id "${orderId}".`);
    }

    // TODO: Add support for multiple configurations
    const existingConfig = (await existingOrder.getConfigurations())[0]!;
    if (!existingConfig) {
        logger.error(`No service configuration found for order with id "${orderId}".`);
        throw new Error(`No service configuration found for order with id "${orderId}".`);
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

    const configurableService = await ConfigurableServiceEntity.loadOrFind(
        ConfigurableService.Id(existingConfig.serviceId)
    );

    if (!configurableService) {
        logger.error(`No configurable service found for service id "${existingConfig.serviceId}".`);
        throw new Error(
            // eslint-disable-next-line max-len
            `Quote Request Submission: No configurable service found for service id "${existingConfig.serviceId}".`
        );
    }

    const provider = configurableService.getProvider();
    if (!provider) {
        logger.error(`No provider found for service id "${existingConfig.serviceId}".`);
        throw new Error(
            `Quote Request Submission: No provider found for service id "${existingConfig.serviceId}".`
        );
    }

    // Generate quote document

    // Send email with quote document
    const email = existingContact?.email;
    if (!email) {
        throw new Error("No email address found for customer with id " + existingCustomer.id);
    }

    // Change order stage to "Offered"
    await OrderEntity.requestOffer(orderId);

    logger.debug("Quote Request Submission success");
    return {
        content: "foobar",
    };
};
