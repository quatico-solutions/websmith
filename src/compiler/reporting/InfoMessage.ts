import ts from "typescript";
import { DiagnosticMessage } from "./DiagnosticMessage";
import { isSourceFile } from "./messages";

export class InfoMessage extends DiagnosticMessage {
    constructor(message: string | ts.DiagnosticMessageChain, source?: ts.SourceFile | string) {
        super({
            category: ts.DiagnosticCategory.Suggestion,
            code: 0,
            file: isSourceFile(source) ? source : undefined,
            length: undefined,
            messageText: message,
            source: typeof source === "string" ? source : undefined,
            start: undefined,
        });
    }
}
