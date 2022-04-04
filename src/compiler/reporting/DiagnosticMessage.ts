import ts from "typescript";

export abstract class DiagnosticMessage implements MessageConstructor, ts.Diagnostic {
    public category: ts.DiagnosticCategory;
    public code: number;
    public file: ts.SourceFile | undefined;
    // @ts-ignore FIXME: compile problem?
    public length: number | undefined;
    public messageText: string | ts.DiagnosticMessageChain;
    public source?: string;
    public start: number | undefined;

    constructor(props: ts.Diagnostic) {
        this.category = props.category;
        this.code = props.code;
        this.file = props.file;
        this.length = undefined;
        this.messageText = props.messageText;
        this.source = props.source;
        this.start = undefined;
    }
}
export type MessageConstructor = new (message: string | ts.DiagnosticMessageChain, source?: ts.SourceFile | string) => ts.Diagnostic;
