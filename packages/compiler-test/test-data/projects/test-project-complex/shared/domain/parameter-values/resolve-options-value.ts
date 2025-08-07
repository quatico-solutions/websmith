import { createBoundParameterPrice, type DiscreteValueOption, type ServiceParameter } from "../api";
import { resolveParameterPrice } from "../pricing/parameter-price/resolve-parameter-price";
import { type ResolvedDiscreteValueOption } from "./ResolvedDiscreteValue";

export const resolveOptionsValue = (
    options: DiscreteValueOption,
    parameterId: ServiceParameter.Id
): ResolvedDiscreteValueOption | never => {
    if (!options.value) {
        throw new Error("DiscreteOption: Property 'value' must be provided.");
    }

    if (!options.label) {
        throw new Error("DiscreteOption: Property 'label' must be provided.");
    }

    if (typeof options.price === "number") {
        options.price = {
            type: "constant",
            amount: options.price,
        };
    }

    return {
        value: options.value,
        label: options.label,
        tooltip: options.tooltip,
        price: resolveParameterPrice(
            createBoundParameterPrice({ ...options.price, parameterId, kind: "text" })
        ),
    };
};
