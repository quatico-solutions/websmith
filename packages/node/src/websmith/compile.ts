/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type CompilerOptions as WebsmithOptions, DefaultReporter, Compiler as WebsmithCompiler } from "@quatico/websmith-core";
import ts from "typescript";
import { Compiler as TscCompiler } from "./Compiler";

export const compile = async (files: string[], config?: { tsConfig?: ts.CompilerOptions; websmith?: Partial<WebsmithOptions> }): Promise<string> => {
    const { tsConfig, websmith } = config ?? {};
    if (websmith) {
        if (files?.length) {
            if (!websmith.cliArgs) {
                websmith.cliArgs = { fileNames: [], options: {}, errors: [] };
            }
            websmith.cliArgs = { ...(websmith.cliArgs ?? {}), fileNames: files };
        }
        if (tsConfig) {
            websmith.tsConfig = { ...tsConfig, ...(websmith.tsConfig ?? {}) };
        }
        websmith.config = { ...(websmith.config ?? {}) };

        const results = new WebsmithCompiler(websmith, {}, ts.sys).compile();

        const output = results.diagnostics;
        const reporter2 = new ReporterMock(ts.sys);
        output.forEach(diagnostic => reporter2.reportDiagnostic(diagnostic));
        return Promise.resolve(reporter2.message);
    } else {
        return await new TscCompiler(tsConfig).compile(files);
    }
};

export class ReporterMock extends DefaultReporter {
    public message = "";

    public reportWatchStatus(_diagnostic: ts.Diagnostic, _newLine = ""): void {
        // do nothing
    }

    protected logProblem(message: string, _category: ts.DiagnosticCategory): void {
        this.message += `${message ?? ""}\n`;
    }
}
