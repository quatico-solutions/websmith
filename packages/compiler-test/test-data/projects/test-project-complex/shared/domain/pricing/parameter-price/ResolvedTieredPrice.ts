import { type TieredPrice, type PriceTier } from "../../api";
import { ResolvedParameterPrice } from "./ResolvedParameterPrice";

type ResolvedTier = Required<PriceTier>;

export class ResolvedTieredPrice extends ResolvedParameterPrice implements TieredPrice {
    readonly tiers: ResolvedTier[];

    constructor(price: Omit<TieredPrice, "type">) {
        super({ ...price, amount: price.amount ?? 0, type: "tiered" });
        this.tiers = resolveTiers(price.tiers);
    }

    getTiers(): PriceTier[] {
        return this.tiers;
    }

    /**
     * This parameter price type uses a tiered pricing structure to calculate the price for the
     * provided parameter value.
     *
     * @param parameterValue The value of the parameter.
     * @returns The price for the parameter value.
     * @throws An error if the parameter value is not a number.
     */
    defaultPriceFn(parameterValue: unknown): number | never {
        if (typeof parameterValue !== "number") {
            throw new Error("TieredPrice: Value must be a number.");
        }

        const tierPrice = this.getTierValue(parameterValue);

        return parameterValue * tierPrice;
    }

    private getTierValue(parameterValue: number): number {
        return (
            this.tiers.find(tier => {
                if ("gte" in tier && "lte" in tier) {
                    return parameterValue >= tier.gte && parameterValue <= tier.lte;
                } else if ("gt" in tier && "lte" in tier) {
                    return parameterValue > tier.gt && parameterValue <= tier.lte;
                } else if ("gte" in tier && "lt" in tier) {
                    return parameterValue >= tier.gte && parameterValue < tier.lt;
                } else if ("gt" in tier && "lt" in tier) {
                    return parameterValue > tier.gt && parameterValue < tier.lt;
                }
                return false;
            })?.price ?? 0
        );
    }

    static create(price: Omit<TieredPrice, "type">): ResolvedTieredPrice {
        const { tiers, amount, priceFn } = price;

        if (tiers === undefined || tiers.length === 0) {
            throw new Error("TieredPrice: Property 'tiers' must be provided.");
        }

        if (amount === undefined && typeof priceFn !== "function") {
            throw new Error("TieredPrice: Property 'value' or 'priceFn' must be provided.");
        }

        return new ResolvedTieredPrice(price);
    }
}

export const resolveTiers = (tiers: PriceTier[]): ResolvedTier[] =>
    tiers.map((cur: { lt?: number; lte?: number; gt?: number; gte?: number }, idx: number) => {
        const next = tiers[idx + 1];
        if (next) {
            if (cur.lt === undefined && cur.lte === undefined) {
                // @ts-expect-error -- fix typing
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                cur.lte = cur.lte = next.gt ? next.gt : next.gte - 1;
            }
        } else {
            if (cur.lt === undefined && cur.lte === undefined) {
                cur.lte = Infinity;
            }
        }

        return cur as ResolvedTier;
    });
