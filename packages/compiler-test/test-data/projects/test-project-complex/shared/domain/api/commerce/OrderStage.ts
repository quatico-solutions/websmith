/* eslint-disable @typescript-eslint/no-namespace */

export const OrderStageNames = [
    "offen",
    "erfasst",
    "offeriert",
    "bestellt",
    "eingeplant",
    "abgebrochen",
    "ausgeführt",
];

export type OrderStage = string;

/**
 * The stage of an order.
 *
 * The stage of an order is used to track the progress of an order within the CPQ.
 *
 * The stage of an order is set by the CPQ and can be changed by the user throw
 * workflow actions. The stage determines the actions that can be performed on
 * the order.
 */
export namespace OrderStage {
    /**
     * Creates a new order stage.
     *
     * @param value - The name of the order stage.
     * @returns The order stage.
     * @throws An error if the name is invalid.
     */
    export const create = (value: string): OrderStage => {
        return value;
    };

    /**
     * The draft stage: The order is created for at least one
     * ServiceConfiguration and an unknown customer.
     */
    export const Draft: OrderStage = OrderStage.create("offen");

    /**
     * The created stage: The order is associated to a known customer
     * and sent to the service provider.
     */
    export const Created: OrderStage = OrderStage.create("erfasst");

    /**
     * The offered stage: The customer has requested a quote for the offered
     * the services and the CPQ has sent a quote to the customer.
     */
    export const Offered: OrderStage = OrderStage.create("offeriert");

    /**
     * The ordered stage: The customer has ordered the requested services
     * and the order is sent to the service provider.
     */
    export const Ordered: OrderStage = OrderStage.create("bestellt");

    /**
     * The planned stage: The customer and the service provider have agreed on
     * a planned delivery date for the ordered services.
     */
    export const Planned: OrderStage = OrderStage.create("eingeplant");

    /**
     * The cancelled stage: The order is cancelled by the customer or the
     * service provider.
     */
    export const Cancelled: OrderStage = OrderStage.create("abgebrochen");

    /**
     * The executed stage: The service provider has delivered the ordered
     * services and the order is closed.
     */
    export const Executed: OrderStage = OrderStage.create("ausgeführt");
}

/**
 * The default order stage: The order is created for at least one
 * ServiceConfiguration and an unknown customer.
 */
export const DEFAULT_ORDER_STAGE: OrderStage = OrderStage.create("offen");

/**
 * Checks if a string is a valid order stage.
 *
 * @param name - The name of the order stage.
 * @returns True if the name is a valid order stage, false otherwise.
 */
export const isOrderStage = (name: string): name is OrderStage => {
    return OrderStageNames.includes(name as unknown as OrderStage);
};
