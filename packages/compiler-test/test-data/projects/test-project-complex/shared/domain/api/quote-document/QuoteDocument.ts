/**
 * A quote document is a file that contains a quote for a configurable service.
 *
 * It is a binary file that can be downloaded and displayed in a browser.
 */
export type QuoteDocument = {
    /**
     * The content of the quote document as base64 encoded string.
     */
    content: string;
    /**
     * The file name of the quote document.
     *
     * Defaults to "quote.pdf".
     */
    fileName?: string;
    /**
     * The MIME type of the quote document.
     *
     * Defaults to "application/pdf".
     */
    mimeType?: string;
};
