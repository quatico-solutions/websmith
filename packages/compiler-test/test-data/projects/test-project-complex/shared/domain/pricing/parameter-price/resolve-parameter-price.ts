import {
    isConstantPrice,
    isFactorLookupPrice,
    isMultiConstantPrice,
    isTieredPrice,
    type ParameterPriceObject,
} from "../../api";
import { ResolvedConstantPrice } from "./ResolvedConstantPrice";
import { ResolvedFactorLookupPrice } from "./ResolvedFactorLookupPrice";
import { ResolvedMultiConstantPrice } from "./ResolvedMultiConstantPrice";
import { type ResolvedParameterPrice } from "./ResolvedParameterPrice";
import { ResolvedTieredPrice } from "./ResolvedTieredPrice";

export const resolveParameterPrice = (price?: ParameterPriceObject): ResolvedParameterPrice | undefined => {
    if (!price) {
        return undefined;
    }

    const type = price.type;
    if (isConstantPrice(price)) {
        // TODO: should we use .create() here? instead of the constructor?
        return new ResolvedConstantPrice(price);
    }
    if (isMultiConstantPrice(price)) {
        // TODO: should we use .create() here? instead of the constructor?
        return new ResolvedMultiConstantPrice(price);
    }
    if (isFactorLookupPrice(price)) {
        // TODO: should we use .create() here? instead of the constructor?
        return new ResolvedFactorLookupPrice(price);
    }
    if (isTieredPrice(price)) {
        // TODO: should we use .create() here? instead of the constructor?
        return new ResolvedTieredPrice(price);
    }

    throw new Error(`Cannot resolve parameter price. Unsupported price type '${type}'.`);
};
