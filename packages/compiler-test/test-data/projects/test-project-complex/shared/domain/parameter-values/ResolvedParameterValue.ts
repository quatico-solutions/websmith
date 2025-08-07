import { createBoundParameterPrice, type ServiceParameter, type BoundParameterValue, type ParameterValueKind } from "../api";
import { ValueObject } from "../base/ValueObject";
import { resolveParameterPrice } from "../pricing/parameter-price/resolve-parameter-price";
import { type ResolvedParameterPrice } from "../pricing/parameter-price/ResolvedParameterPrice";

/**
 * Represents a base class for a value of parameters.
 *
 * This class implements the common interface for all parameter values.
 * It provides a base implementation for the methods that are common to all parameter values.
 */
class BaseParameterValue<VALUE = unknown, PARAMETER_VALUE extends BoundParameterValue<VALUE> = BoundParameterValue<VALUE>> {
    value?: VALUE;
    readonly parameterId: ServiceParameter.Id;
    readonly price?: ResolvedParameterPrice;
    readonly kind: ParameterValueKind;

    constructor(options: PARAMETER_VALUE) {
        this.price = resolveParameterPrice(createBoundParameterPrice(options));
        this.kind = options.kind;
        this.parameterId = options.parameterId;
        this.value = options.value as VALUE;
    }
}

export abstract class ResolvedParameterValue<VALUE = unknown, PARAMETER_VALUE extends BoundParameterValue<VALUE> = BoundParameterValue<VALUE>>
    extends ValueObject(BaseParameterValue)
    implements BoundParameterValue<VALUE>
{
    declare value: VALUE;

    constructor(options: PARAMETER_VALUE) {
        super(options);
    }

    getParameterId(): ServiceParameter.Id {
        return this.parameterId;
    }

    getValue() {
        return this.value;
    }

    setValue(value: VALUE): this {
        this.value = value;
        return this;
    }

    abstract getKind(): ParameterValueKind;

    getPrice(): ResolvedParameterPrice | undefined {
        return this.price;
    }
}
