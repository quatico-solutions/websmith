import { type OrderPrice } from "../api";
import { ValueObject } from "../base/ValueObject";
import { type ServiceConfigurationEntity } from "../configuration";
import { ResolvedServiceConfigurationPrice } from "./ResolvedServiceConfigurationPrice";

/**
 * Represents the price of a quote, including the total amount and
 * individual prices for each service configuration in the quote.
 */
export class ResolvedOrderPrice
    extends ValueObject(
        class {
            readonly subTotal?: number;
            readonly configurationPrices?: ResolvedServiceConfigurationPrice[];

            constructor(props: OrderPrice, configs?: ServiceConfigurationEntity[]) {
                this.subTotal = props.subTotal;
                this.configurationPrices = configs?.map(
                    config =>
                        new ResolvedServiceConfigurationPrice(config.price ?? {}, config.parameterGroups)
                );
            }
        }
    )
    implements OrderPrice
{
    readonly #defaultVat = 8.1;

    /**
     * Creates a new quote price.
     *
     * @param props The price data containing the quote ID, total amount,
     *              and an array of service configuration prices
     */
    constructor(props: OrderPrice, configs?: ServiceConfigurationEntity[]) {
        super(props, configs);
    }

    /**
     * Gets the sum of all price items of the quote.
     *
     * @returns The subtotal price
     */
    getSubTotal(): number {
        return (
            this.configurationPrices?.reduce((sum, item) => sum + item.getSubTotal(), 0) ?? this.subTotal ?? 0
        );
    }

    /**
     * Gets a percentual fraction of the subtotal.
     *
     * @param percentage Percentage to calculate. Default is 8.1.
     *
     * @returns Requested percentage of the subtotal price
     */
    getPercentageOfSubtotal(percentage: number = this.#defaultVat): number {
        const factor = percentage * 0.01;
        return factor * this.getSubTotal();
    }

    /**
     *  Gets the total price of the quote (including VAT)
     *
     *  @param vat Desired VAT to add to subtotal in percent. Default is 8.1.
     *
     *  @returns The total price including VAT
     */
    getTotal(vat: number = this.#defaultVat): number {
        return this.getSubTotal() + this.getPercentageOfSubtotal(vat);
    }

    /**
     * Gets the prices for all service configurations in the quote.
     * Returns a copy of the array to maintain immutability.
     *
     * @returns An array of service configuration prices
     */
    getServiceConfigurationPrices(): ResolvedServiceConfigurationPrice[] | undefined {
        return this.configurationPrices;
    }

    /**
     * Creates a new quote price with valid quote ID and total price.
     */
    static create(props: OrderPrice, configs: ServiceConfigurationEntity[]): ResolvedOrderPrice | never {
        return new ResolvedOrderPrice(props, configs);
    }
}
