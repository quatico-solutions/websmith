import { type Context, type Serialization } from "../../magellan-shared";
import { Logger, type Order, OrderEntity, OrderStage } from "../../shared";

const logger = Logger.create("reconfigure-order-service");

export type ReconfigureOrderInput = {
    orderId: Order.Id;
};

/**
 * Resets an order's stage to Draft to allow reconfiguration.
 *
 * This service function is used when a customer wants to reconfigure
 * an existing order. It resets the order stage to Draft so that the
 * order can be modified and go through the configuration process again.
 *
 * @param input - The input object containing the order ID to reconfigure.
 * @returns The updated order with stage set to Draft.
 * @throws Error if the order is not found or cannot be reconfigured.
 */
// @service({"namespace":"cds-cpq-no-auth"})
export const reconfigureOrder = async (input: ReconfigureOrderInput, _context?: Context, _serialization?: Serialization): Promise<Order> => {
    const { orderId } = input;

    const order = await OrderEntity.load(orderId);

    if (!order) {
        logger.error(`Order with id "${orderId}" not found.`);
        throw new Error(`Order with id "${orderId}" not found.`);
    }

    // Validate that the order can be reconfigured
    if (order.stage === OrderStage.Draft) {
        logger.warn(`Order with id "${orderId}" is already in Draft stage.`);
        return order;
    }

    if (order.stage === OrderStage.Executed) {
        logger.error(`Cannot reconfigure Order with id "${orderId}". The order has already been executed.`);
        throw new Error(`Cannot reconfigure Order with id "${orderId}". The order has already been executed.`);
    }

    logger.info(`Reconfiguring order with id "${orderId}" from stage "${order.stage}" to "${OrderStage.Draft}".`);

    // Reset the order stage to Draft and clear any cancellation reason and date
    const updatedOrder = await order.update({
        stage: OrderStage.Created,
        cancellationReason: undefined,
        cancelledAt: undefined,
    });

    logger.info(`Successfully reconfigured order with id "${orderId}".`);

    return updatedOrder;
};
