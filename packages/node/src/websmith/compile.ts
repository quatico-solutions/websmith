/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type CompilerOptions as WebsmithOptions, AddonRegistry, DefaultReporter, Compiler as WebsmithCompiler } from "@quatico/websmith-core";
import ts from "typescript";
import { Compiler as TscCompiler } from "./Compiler";

export const compile = async (
    files: string[],
    config?: { tsConfig?: ts.CompilerOptions; websmith?: WebsmithOptions; debug?: boolean }
): Promise<string> => {
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

        if (!websmith.reporter) {
            websmith.reporter = new ReporterMock(ts.sys);
        }

        // Pass through the debug flag from config
        if (config?.debug !== undefined) {
            websmith.debug = config.debug;
        }

        let addons: AddonRegistry | undefined;
        if (config?.websmith?.config?.addonsDir !== undefined || config?.websmith?.config?.addons !== undefined) {
            addons = new AddonRegistry({
                addonsDir: config?.websmith?.config?.addonsDir ?? "",
                addons: config?.websmith?.config?.addons ?? [],
                reporter: websmith.reporter,
                system: ts.sys,
            });
        }

        const results = new WebsmithCompiler(websmith, {}, ts.sys, addons).compile();

        const output = results.diagnostics;

        output.forEach(diagnostic => websmith.reporter?.reportDiagnostic(diagnostic));
        return Promise.resolve((websmith.reporter as ReporterMock)?.message ?? "");
    } else {
        // Pass debug option to the node compiler
        const debugEnabled = config?.debug ?? false;
        return await new TscCompiler(tsConfig, debugEnabled).compile(files);
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
