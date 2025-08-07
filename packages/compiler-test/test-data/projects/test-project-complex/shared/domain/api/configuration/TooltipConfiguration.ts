/**
 *  Configuration for a tooltip for a parameter or parameter value option in the case of discrete parameters.
 *
 */
import { type ImageConfiguration } from "./ImageConfiguration";

export type TooltipConfiguration = {
    /**
     * Optional title to be displayed in the tooltip.
     */
    title?: string;

    /**
     * The text to be displayed in the tooltip.
     */
    text: string;

    /**
     * The image to be displayed in the tooltip.
     */
    image?: ImageConfiguration;
};
