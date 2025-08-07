import { type BoundBooleanValue, type ParameterValueKind } from "../api";
import { ResolvedParameterValue } from "./ResolvedParameterValue";

/**
 * Represents a boolean value with custom labels for true and false states.
 */
export class ResolvedBooleanValue extends ResolvedParameterValue<boolean, BoundBooleanValue> {
    readonly trueLabel: string;
    readonly falseLabel: string;

    /**
     *
     * @param value The labels for true and false states bound to a parameter
     */
    constructor(value: Omit<BoundBooleanValue, "kind">) {
        super({
            ...value,
            kind: "boolean",
        });
        const { trueLabel, falseLabel } = value;
        this.trueLabel = trueLabel;
        this.falseLabel = falseLabel;
    }

    getKind(): ParameterValueKind {
        return this.kind;
    }

    /**
     * Gets the label for the true state.
     *
     * @returns The true state label
     */
    getTrueLabel(): string {
        return this.trueLabel;
    }

    /**
     * Gets the label for the false state.
     *
     * @returns The false state label
     */
    getFalseLabel(): string {
        return this.falseLabel;
    }

    /**
     * Creates a new boolean value with custom labels.
     *
     * @param value The labels for true and false states bound to a parameter
     * @returns A new boolean value or throws an error if the labels are empty
     */
    static create(value: Omit<BoundBooleanValue, "kind">): ResolvedBooleanValue | never {
        const { trueLabel, falseLabel } = value;
        if (!trueLabel || trueLabel.trim() === "") {
            throw new Error("BooleanValue: 'trueLabel' cannot be empty.");
        }

        if (!falseLabel || falseLabel.trim() === "") {
            throw new Error("BooleanValue: 'falseLabel' cannot be empty.");
        }

        return new ResolvedBooleanValue(value);
    }
}
