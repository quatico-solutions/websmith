import { type Context, type Serialization } from "./magellan-shared";
import { Logger, type Order, OrderEntity, OrderStage } from "./shared";

const logger = Logger.create("cancel-order-service");

type CancelOrderInput = {
    orderId: Order.Id;
    reason: string;
};

// @service({"namespace":"cds-cpq-no-auth"})
export const cancelOrder = async (
    input: CancelOrderInput,
    _context?: Context,
    _serialization?: Serialization
): Promise<Order> => {
    const { orderId, reason } = input;

    const order = await OrderEntity.load(orderId);

    if (!order) {
        logger.error(`Order with id "${orderId}" not found.`);
        throw new Error(`Order with id "${orderId}" not found.`);
    }

    if (order.stage !== OrderStage.Ordered) {
        logger.error(`We cannot cancel Order with id "${orderId}". The order is not in ordered stage.`);
        throw new Error(`We cannot cancel Order with id "${orderId}". The order is not in ordered stage.`);
    }

    return await order.update({
        stage: OrderStage.Cancelled,
        cancellationReason: reason,
        cancelledAt: new Date(),
    });
};
