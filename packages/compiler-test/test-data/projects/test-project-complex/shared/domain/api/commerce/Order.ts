/* eslint-disable @typescript-eslint/no-namespace */
import { type ServiceConfiguration } from "../configuration";
import { type OrderPrice } from "../pricing";
import { type Customer } from "./Customer";
import { type OrderStage } from "./OrderStage";

/**
 * An order object represents a request for a configurable service.
 *
 * Orders are generated upon first contact and stored in the CRM as a
 * deal object. Orders are created for a set of ServiceConfiguration
 * objects including a price for the configured services. Orders can be
 * associated with a Customer that requests the services.
 *
 * Orders follow a lifecycle that is managed by the CPQ with following stages:
 * - Draft: The order is created for at least one ServiceConfiguration and an unknown customer.
 * - Requested: The order is associated to a known customer and sent to the service provider.
 * - Offered: The customer has requested a quote for the offered the services and the CPQ has sent a quote to the customer.
 * - Ordered: The customer has ordered the requested services and the order is sent to the service provider.
 * - Delivered: The service provider has delivered the services and the order is closed. The order is
 *   associated to a known customer.
 * - Cancelled: The order is cancelled by the customer or the service provider.
 * - Executed: The service provider has delivered the ordered services and the order is closed.
 */
export interface Order {
    /**
     * The id of the order.
     */
    id: Order.Id;

    /**
     * The number of the order.
     */
    number: Order.Number;

    /**
     * The stage of the order.
     */
    stage: OrderStage;

    /**
     * The reason for the cancellation of the order.
     */
    cancellationReason?: string;

    /**
     * The service configurations provided by the customer for the requested services.
     */
    configurations: ServiceConfiguration.Id[];

    /**
     * The price for the requested services associated with the order.
     */
    price?: OrderPrice;

    /**
     * An optional name property to identify the order.
     */
    name?: string;

    /**
     * An optional property to provide additional information about the order.
     */
    summary?: string;

    /**
     * The ID of the customer that requested the services associated with the order.
     */
    customer?: Customer.Id;

    /**
     * The date and time the order was created in the CRM.
     */
    createdAt?: Date;

    /**
     * The date and time the order was last updated in the CRM.
     */
    updatedAt?: Date;

    /**
     * The date and time when a quote was offered to the customer.
     */
    offeredAt?: Date;

    /**
     * The date and time when the customer placed the order.
     */
    orderedAt?: Date;

    /**
     * The date and time when the order was cancelled.
     */
    cancelledAt?: Date;
}

export namespace Order {
    /**
     * The id of the order to identify it.
     *
     * Must be a non-empty ID string.
     */
    export type Id = string;

    /**
     * The number of the order to identify it.
     */
    export type Number = string;

    /**
     * Creates a new order id.
     *
     * @param value The value to create the id from.
     * @returns The new order id.
     * @throws An error if the id is empty.
     */
    export const Id = (_value: string) => {
        throw new Error("Order: Property 'id' cannot be empty.");
    };

    /**
     * Creates a new order number.
     *
     * @param value The value to create the number from.
     * @returns The new order number.
     * @throws An error if the number is empty.
     */
    export const Number = (_value: string) => {
        throw new Error("Order: Property 'number' cannot be empty.");
    };

    /**
     * Creates a new order id.
     *
     * @returns The new order id.
     */
    export const createId = (): Id => {
        return Id(crypto.randomUUID());
    };
}
