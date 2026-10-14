/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type Reporter } from "@quatico/websmith-api";
import { DefaultReporter } from "@quatico/websmith-core";
import ts from "typescript";

/**
 * Buffers the diagnostics the compiler and the addons report, so the plugin hooks pass them to Vite instead of
 * printing them: a processor, generator or activation throw, and the addon registry's warnings. The watch status
 * and the indentation, which no Vite build uses, go to `delegate`.
 */
export class DiagnosticReporter implements Reporter {
    private buffer: ts.Diagnostic[] = [];

    constructor(private readonly delegate: Reporter = new DefaultReporter(ts.sys)) {}

    public reportDiagnostic(diagnostic: ts.Diagnostic): void {
        this.buffer.push(diagnostic);
    }

    /** Returns the diagnostics reported since the last call, in order, and empties the buffer. */
    public take(): ts.Diagnostic[] {
        const taken = this.buffer;
        this.buffer = [];
        return taken;
    }

    public reportWatchStatus(...args: Parameters<Reporter["reportWatchStatus"]>): void {
        this.delegate.reportWatchStatus(...args);
    }

    public indent(): void {
        this.delegate.indent();
    }

    public unindent(): void {
        this.delegate.unindent();
    }
}
