import { type Context, type Serialization } from "../../magellan-shared";
import { type ContactData, ContactEntity, type CustomerData, CustomerEntity, Logger, type Order, OrderEntity, OrderStage } from "../../shared";

export type PatchOrderAndAssociateCustomerInput = {
    orderId: Order.Id;
    primaryContactData: ContactData;
    customerData: CustomerData;
};

const logger = Logger.create("register-order-and-associate-customer");

// @service({"namespace":"cds-cpq-no-auth"})
export const registerOrderAndAssociateCustomer = async (
    input: PatchOrderAndAssociateCustomerInput,
    _context?: Context,
    _serialization?: Serialization
): Promise<OrderEntity> => {
    logger.info("registerOrderAndAssociateCustomer");
    // TODO: move complex logic to domain entities
    const order = await OrderEntity.load(input.orderId);
    if (!order) {
        logger.error(`Order with id "${input.orderId}" not found.`);
        throw new Error(`Order with id "${input.orderId}" not found.`);
    }
    // eslint-disable-next-line no-console
    console.log("OrderStage: ", order.stage);
    if (!(order.stage === OrderStage.Draft)) {
        logger.error(`Order with id "${input.orderId}" is not in draft stage.`);
        throw new Error(`Order with id "${input.orderId}" is not draft stage.`);
    }

    let contact = await ContactEntity.findOrCreateByEmail(input.primaryContactData.email);
    let customer = await CustomerEntity.findOrCreateByPostalAddress(input.customerData);

    // Always update the contact with the provided data
    contact = await contact.update({ ...input.primaryContactData, customer: customer.id });

    // Update the primary contact of a customer if changed
    if (contact.id && customer.primaryContact !== contact.id) {
        customer = await customer.update({ primaryContact: contact.id });
    }

    // Associate the order with the customer and update its stage to created
    return await order.update({ customer: customer.id, stage: OrderStage.Created });
};
