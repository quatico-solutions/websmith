import { type BoundDiscreteValue, type DiscreteValueOption, type ParameterValueKind } from "../api";
import { type ResolvedParameterPrice } from "../pricing";
import { resolveOptionsValue } from "./resolve-options-value";
import { ResolvedParameterValue } from "./ResolvedParameterValue";

/**
 * Represents a resolved discrete value option.
 */
export type ResolvedDiscreteValueOption = DiscreteValueOption & {
    price?: ResolvedParameterPrice;
};

/**
 * Represents a discrete option in a parameter value selection.
 *
 * This value object holds an option with an ID, value, and label bound to a parameter.
 */
export class ResolvedDiscreteValue extends ResolvedParameterValue<string, BoundDiscreteValue> {
    readonly options: ResolvedDiscreteValueOption[];

    /**
     * Creates a new discrete option.
     *
     * @param value The options
     */
    constructor(value: Omit<BoundDiscreteValue, "kind">) {
        super({
            ...value,
            kind: "discrete",
        });
        this.options = value.options?.map(it => resolveOptionsValue(it, this.getParameterId())) ?? [];
    }

    getKind(): ParameterValueKind {
        return this.kind;
    }

    /**
     * Gets the options.
     *
     * @returns The options
     */
    getOptions(): ResolvedDiscreteValueOption[] {
        return this.options;
    }

    /**
     * Creates a new discrete option with valid options.
     *
     * @param value The options bound to a parameter
     * @returns A new discrete option or never if the options are invalid
     */
    static create(value: Omit<BoundDiscreteValue, "kind">): ResolvedDiscreteValue | never {
        const { options } = value;
        const values = options?.map(it => it.value).filter(it => it !== undefined) ?? [];
        if (hasDuplicates(values)) {
            throw new Error(
                "DiscreteOption has values with duplicate a 'value'. Property 'value' must be unique."
            );
        }
        values.forEach(value => {
            if (value === "") {
                throw new Error("DiscreteOption: Property 'value' of value cannot be empty.");
            }
        });

        if (hasDuplicates(options?.map(it => it.label).filter(it => it !== undefined) ?? [])) {
            throw new Error(
                "DiscreteOption has values with duplicate a 'label'. Property 'label' must be unique."
            );
        }

        return new ResolvedDiscreteValue(value);
    }
}

const hasDuplicates = (array: string[]) => new Set(array).size !== array.length;
