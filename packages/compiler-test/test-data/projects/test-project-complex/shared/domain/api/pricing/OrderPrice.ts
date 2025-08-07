/**
 * The price of an order.
 */
export type OrderPrice = {
    /**
     * The subtotal of the order calculated by the price calculator.
     *
     * The value does not exist until the order is priced.
     */
    subTotal?: number;
};
