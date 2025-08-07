import { type Context, type Serialization } from "./magellan-shared";
import {
    ConfigurableService,
    ConfigurableServiceEntity,
    type ContactData,
    ContactEntity,
    type CustomerData,
    CustomerEntity,
    Logger,
    type Order,
    OrderEntity,
    OrderStage,
} from "./shared";

export type UpdateCustomerInput = {
    orderId: Order.Id;
    primaryContactData: ContactData;
    customerData: CustomerData;
};

const logger = Logger.create("update-customer");

// @service({"namespace":"cds-cpq-no-auth"})
export const updateCustomer = async (
    input: UpdateCustomerInput,
    _context?: Context,
    _serialization?: Serialization
): Promise<OrderEntity> => {
    logger.info("updateCustomer");
    // TODO: move complex logic to domain entities
    const order = await OrderEntity.load(input.orderId);
    if (!order) {
        logger.error(`Order with id "${input.orderId}" not found.`);
        throw new Error(`Order with id "${input.orderId}" not found.`);
    }

    let contact = await ContactEntity.findOrCreateByEmail(input.primaryContactData.email);
    let customer = await CustomerEntity.findOrCreateByPostalAddress(input.customerData);

    // Always update the contact with the provided data
    contact = await contact.update({ ...input.primaryContactData, customer: customer.id });

    // Update the primary contact of a customer if changed
    if (contact.id && customer.primaryContact !== contact.id) {
        customer = await customer.update({ ...input.customerData, primaryContact: contact.id });
    }

    // Associate the order with the customer and update its stage to created
    const updatedOrder = await order.update({ customer: customer.id });

    // Send emails if order is in "Offered" stage
    if (updatedOrder.stage === OrderStage.Offered) {
        await sendQuoteEmails(updatedOrder, customer, contact);
    }

    return updatedOrder;
};

const sendQuoteEmails = async (
    order: OrderEntity,
    customer: CustomerEntity,
    contact: ContactEntity
): Promise<void> => {
    logger.info("Sending quote emails for offered order");

    if (!process.env.CDS_CPQ_FRONTEND_URL) {
        logger.error("'CDS_CPQ_FRONTEND_URL' must be set.");
        throw new Error("Quote Email Sending: 'CDS_CPQ_FRONTEND_URL' must be set.");
    }

    // TODO: Add support for multiple configurations
    const existingConfig = (await order.getConfigurations())[0]!;
    if (!existingConfig) {
        logger.error(`No service configuration found for order with id "${order.id}".`);
        throw new Error(`No service configuration found for order with id "${order.id}".`);
    }

    const configurableService = await ConfigurableServiceEntity.loadOrFind(
        ConfigurableService.Id(existingConfig.serviceId)
    );

    if (!configurableService) {
        logger.error(`No configurable service found for service id "${existingConfig.serviceId}".`);
        throw new Error(
            `Quote Email Sending: No configurable service found for service id "${existingConfig.serviceId}".`
        );
    }

    const provider = configurableService.getProvider();
    if (!provider) {
        logger.error(`No provider found for service id "${existingConfig.serviceId}".`);
        throw new Error(
            `Quote Email Sending: No provider found for service id "${existingConfig.serviceId}".`
        );
    }

    // Send email with quote document
    const email = contact?.email;
    if (!email) {
        throw new Error("No email address found for customer with id " + customer.id);
    }

    logger.info("Quote emails sent successfully");
};
