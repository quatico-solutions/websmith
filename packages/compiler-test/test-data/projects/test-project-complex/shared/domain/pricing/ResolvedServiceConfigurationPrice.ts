import { type ServiceConfigurationPrice } from "../api";
import { ValueObject } from "../base/ValueObject";
import { ConfigurationParameterGroupEntity } from "../configuration";

/**
 * Represents the price of a service configuration, including a total amount
 * and a breakdown of prices by parameter.
 */
export class ResolvedServiceConfigurationPrice
    extends ValueObject(
        class {
            readonly subTotal?: number;
            readonly groups?: ConfigurationParameterGroupEntity[];

            constructor(props: ServiceConfigurationPrice, groups?: ConfigurationParameterGroupEntity[]) {
                this.subTotal = props.subTotal;
                this.groups = groups?.map(group => ConfigurationParameterGroupEntity.create(group)) ?? [];
            }
        }
    )
    implements ServiceConfigurationPrice
{
    readonly #defaultVat = 8.1;

    constructor(props: ServiceConfigurationPrice, groups?: ConfigurationParameterGroupEntity[]) {
        super(props, groups);
    }

    /**
     * Gets the sum of all price items
     *
     * @returns Sum of all price items
     */

    getSubTotal(): number {
        return this.groups?.reduce((sum, item) => sum + item.getSubTotal(), 0) ?? this.subTotal ?? 0;
    }

    /**
     * Get the sum of all price items, rounded to two decimal places, in a round-half-up ("kaufmännisch") fashion
     *
     * @returns Sum of all price items, rounded to two decimal places, in a round-half-up ("kaufmännisch") fashion
     */
    getSubTotalRounded(): number {
        return this.roundHalfUp(this.getSubTotal());
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
     *  Gets the total price (including VAT)
     *
     *  @param vat Desired VAT to add to subtotal in percent. Default is 8.1.
     *
     *  @returns The total price including VAT
     */
    getTotal(vat: number = this.#defaultVat): number {
        return this.getSubTotal() + this.getPercentageOfSubtotal(vat);
    }

    /**
     * Get the total price (including VAT), rounded to two decimal places, in a round-half-up ("kaufmännisch") fashion
     *
     *  @param vat Desired VAT to add to subtotal in percent. Default is 8.1.
     *
     * @returns Total price (including VAT), rounded to two decimal places, in a round-half-up ("kaufmännisch") fashion
     */
    getTotalRounded(vat: number = this.#defaultVat): number {
        return this.roundHalfUp(this.getTotal(vat));
    }

    getGroups(): ConfigurationParameterGroupEntity[] | undefined {
        return this.groups;
    }

    /**
     * Round a number to specified decimal places using round-half-up method
     *
     * @param value The number to round
     * @param decimals Number of decimal places (default: 2)
     * @returns Rounded number
     */
    roundHalfUp(value: number, decimals: number = 2): number {
        const factor = Math.pow(10, decimals);
        return Math.floor(value * factor + 0.5) / factor;
    }

    static create(
        props: ServiceConfigurationPrice,
        groups?: ConfigurationParameterGroupEntity[]
    ): ResolvedServiceConfigurationPrice {
        return new ResolvedServiceConfigurationPrice(props, groups);
    }
}
