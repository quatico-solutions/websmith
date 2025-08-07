import { type BoundTextValue, type ParameterValueKind, type TextInputType } from "../api";
import { ResolvedParameterValue } from "./ResolvedParameterValue";

/**
 * Represents a text input value with specific input type and optional placeholder.
 */

export class ResolvedTextValue extends ResolvedParameterValue<string, BoundTextValue> {
    readonly inputType: TextInputType;
    readonly placeholder?: string;
    readonly help?: string;

    /**
     * Creates a new text value with input type and optional placeholder bound to a parameter.
     *
     * @param value The text input configuration
     */
    constructor(value: Omit<BoundTextValue, "kind">) {
        super({
            ...value,
            kind: "text",
        });
        this.inputType = value.inputType ?? "text";
        this.placeholder = value.placeholder;
        this.help = value.help;
    }

    getKind(): ParameterValueKind {
        return this.kind;
    }

    /**
     * Gets the type of input field.
     *
     * @returns The input type
     */
    getInputType(): TextInputType {
        return this.inputType;
    }

    /**
     * Gets the placeholder text for the input field.
     *
     * @returns The placeholder text or undefined if not set
     */
    getPlaceholder(): string | undefined {
        return this.placeholder;
    }

    /**
     * Gets the help text for the input field.
     *
     * @returns The help text or undefined if not set
     */
    getHelp(): string | undefined {
        return this.help;
    }

    /**
     * Creates a new text value with valid input type and optional placeholder.
     *
     * @param value The text input configuration bound to a parameter
     * @returns A new text value or throws an error if the values are invalid
     */
    static create(value: Omit<BoundTextValue, "kind">): ResolvedTextValue | never {
        let { inputType } = value;
        if (!inputType || inputType.trim() === "") {
            inputType = "text";
        }

        if (
            inputType !== "date" &&
            inputType !== "email" &&
            inputType !== "number" &&
            inputType !== "tel" &&
            inputType !== "text" &&
            inputType !== "textarea"
        ) {
            throw new Error(
                // eslint-disable-next-line max-len
                "TextValue: Property 'inputType' must be one of the following: 'date', 'email', 'number', 'tel', 'text', 'textarea'."
            );
        }

        return new ResolvedTextValue(value);
    }
}
