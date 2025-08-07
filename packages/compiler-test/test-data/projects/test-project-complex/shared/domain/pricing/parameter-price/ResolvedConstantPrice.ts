import { type ConstantPrice } from "../../api";
import { ResolvedParameterPrice } from "./ResolvedParameterPrice";

export class ResolvedConstantPrice extends ResolvedParameterPrice implements ConstantPrice {
    constructor(price: Omit<ConstantPrice, "type">) {
        super({ ...price, amount: price.amount ?? 0, type: "constant" });
    }

    /**
     * This parameter price type uses a constant price value from the configuration. It returns the
     * price's value from the configuration, unless a parameter value of 'false' is provided.
     *
     * Returns '0' if 'false' is provided as a parameter value or the price has no value in the configuration.
     *
     * @param parameterValue The value of the parameter. Ignored if not a boolean.
     * @returns The price for the parameter value. Defaults to 0.
     */
    defaultPriceFn(parameterValue: unknown): number {
        if (typeof parameterValue === "boolean" && parameterValue === false) {
            return 0;
        }

        return this.amount ?? 0;
    }

    static create(price: Omit<ConstantPrice, "type">): ResolvedConstantPrice | never {
        const { amount, priceFn } = price;

        if (amount === undefined && typeof priceFn !== "function") {
            throw new Error("ConstantPrice: Property 'value' or 'priceFn' must be provided.");
        }

        return new ResolvedConstantPrice(price);
    }
}
