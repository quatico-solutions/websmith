import { type QuoteDocument } from "../api";
import { ValueObject } from "../base";

/**
 * A quote document value represents a quote document. A quote document is a
 * document that contains the quote for a service configuration.
 *
 * @see QuoteDocument
 */
export class QuoteDocumentValue
    extends ValueObject(
        class {
            readonly content: string;
            readonly fileName: string;
            readonly mimeType: string;

            constructor(value: QuoteDocument) {
                this.content = value.content;
                this.fileName = value.fileName ?? "quote.pdf";
                this.mimeType = value.mimeType ?? "application/pdf";
            }
        }
    )
    implements QuoteDocument
{
    /**
     * Returns the base64 encoded string content of the quote document.
     *
     * @returns The base64 encoded string.
     */
    getStringContent(): string {
        return this.content;
    }

    /**
     * Returns the file name of the quote document.
     *
     * @returns The file name.
     */
    getFileName(): string {
        return this.fileName;
    }

    /**
     * Returns the mime type of the quote document.
     *
     * @returns The mime type.
     */
    getMimeType(): string {
        return this.mimeType;
    }

    /**
     * Creates a new quote document value.
     *
     * @param value The quote document value to create.
     * @returns The created quote document value.
     * @throws An error if the document content is not provided.
     */
    static create(value: Partial<QuoteDocument>): QuoteDocumentValue {
        if (!value.content) {
            throw new Error("QuoteDocument: The document content is required.");
        }

        return new QuoteDocumentValue({
            content: value.content,
            fileName: value.fileName,
            mimeType: value.mimeType,
        });
    }
}
