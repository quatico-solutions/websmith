import { type MultiConstantPrice } from "../../api";
import { ResolvedParameterPrice } from "./ResolvedParameterPrice";

export class ResolvedMultiConstantPrice extends ResolvedParameterPrice implements MultiConstantPrice {
    private readonly valueMap: Record<string, number>;

    constructor(price: Omit<MultiConstantPrice, "type"> & { valueMap: Record<string, number> }) {
        super({ ...price, amount: 0, type: "multi-constant" });
        this.valueMap = price.valueMap;
    }

    /**
     * This parameter price type uses a map of multiple price values to return a price for
     * the provided parameter value.
     *
     * Returns the price value from the configured value map using the parameter value as the key.
     *
     * @param parameterValue The key of the price value to return from the configured value map.
     * @returns The price for the parameter value. Defaults to 0.
     * @throws An error if the parameter value is not a string.
     */
    defaultPriceFn(parameterValue: unknown): number {
        if (typeof parameterValue !== "string") {
            throw new Error("MultiConstantPrice: Parameter value must be a string.");
        }
        return this.valueMap[parameterValue] ?? 0;
    }

    static create(
        price: Omit<MultiConstantPrice, "type"> & { valueMap: Record<string, number> }
    ): ResolvedMultiConstantPrice | never {
        const { valueMap, priceFn } = price;

        if (valueMap === undefined && typeof priceFn !== "function") {
            throw new Error("MultiConstantPrice: Property 'value' or 'priceFn' must be provided.");
        }

        return new ResolvedMultiConstantPrice(price);
    }
}
