/**
 * The price for a service configuration calculated by the CPQ service.
 */
export type ServiceConfigurationPrice = {
    /**
     * The subtotal of the service configuration that is calculated by the CPQ service.
     *
     * If the subtotal is not provided, the CPQ service will calculate the subtotal based on the
     * parameter values and the price function of the service configuration.
     */
    subTotal?: number;
};
