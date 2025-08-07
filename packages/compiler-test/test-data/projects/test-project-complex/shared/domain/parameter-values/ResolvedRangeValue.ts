import { type BoundRangeValue, type ParameterValueKind } from "../api";
import { ResolvedParameterValue } from "./ResolvedParameterValue";

/**
 * Represents a range value with minimum, maximum, step, and label.
 * Used for numeric parameters that have a range of possible values.
 */
export class ResolvedRangeValue extends ResolvedParameterValue<number, BoundRangeValue> {
    readonly min: number;
    readonly max: number;
    readonly step: number;
    readonly label: string;
    readonly unit?: string;
    /**
     * Creates a new range value.
     *
     * @param value The range data containing min, max, step, and label bound to a parameter
     */
    constructor(value: Omit<BoundRangeValue, "kind">) {
        super({
            ...value,
            kind: "range",
        });
        this.min = value.min ?? 0;
        this.max = value.max ?? 100;
        this.step = value.step ?? 1;
        this.label = value.label ?? "";
        this.unit = value.unit ?? "";
    }

    getKind(): ParameterValueKind {
        return this.kind;
    }

    /**
     * Gets the minimum value of the range.
     *
     * @returns The minimum value. Defaults to 0.
     */
    getMin(): number {
        return this.min;
    }

    /**
     * Gets the maximum value of the range.
     *
     * @returns The maximum value. Defaults to 100.
     */
    getMax(): number {
        return this.max;
    }

    /**
     * Gets the step value between numbers in the range.
     *
     * @returns The step value. Defaults to 1.
     */
    getStep(): number {
        return this.step;
    }

    /**
     * Gets the display label for the range.
     *
     * @returns The range's label.
     */
    getLabel(): string {
        return this.label;
    }

    /**
     * Gets the display unit for the range.
     *
     * @returns The range's unit.
     */
    getUnit(): string | undefined {
        return this.unit;
    }

    /**
     * Creates a new range value with valid step and label.
     *
     * @param value The range data containing min, max, step, and label bound to a parameter
     * @returns A new range value or throws an error if the values are invalid
     */
    static create(value: Omit<BoundRangeValue, "kind">): ResolvedRangeValue | never {
        const { min, max, step } = value;
        if (min && max && min >= max) {
            throw new Error("RangeValue: Property 'min' must be smaller than property 'max'.");
        }

        if (step && step <= 0) {
            throw new Error("RangeValue: Property 'step' must be greater than 0.");
        }

        return new ResolvedRangeValue(value);
    }
}
