import { type BoundParameterValue, type ParameterValue } from "./ParameterValue";

/**
 * The type of input for a text value.
 */
export type TextInputType = "date" | "email" | "number" | "tel" | "text" | "textarea";

/**
 * A text value for a service configuration parameter.
 */
export type TextValue = ParameterValue<string> & {
    /**
     * The type of input for the text value.
     *
     * Defaults to 'text'.
     */
    inputType?: TextInputType;
    /**
     * The placeholder text for the text value.
     *
     * Defaults to ''.
     */
    placeholder?: string;
    /**
     * The maximum length of the text value.
     */
    maxLength?: number;

    /**
     * The helper text for the text value.
     */
    help?: string;
};

/**
 * A parameter value that is used to represent a text value.
 */
export type BoundTextValue = TextValue & BoundParameterValue<string>;
