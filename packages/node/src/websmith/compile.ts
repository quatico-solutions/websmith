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

        let addons;
        // Only create AddonRegistry if there's configuration or a config file
        if (
            config?.websmith?.config?.addonsDir !== undefined ||
            config?.websmith?.config?.addons !== undefined ||
            config?.websmith?.configFile !== undefined
        ) {
            addons = new AddonRegistry({
                addonsDir: config?.websmith?.config?.addonsDir ?? "",
                addons: config?.websmith?.config?.addons,
                profiles: config?.websmith?.config?.profiles,
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
        // Filter out addon warning and suggestion messages for test expectations
        if (message && typeof message === "string") {
            // Skip addon warnings that don't affect functionality
            if (
                message.includes('does not export an "activate" function') ||
                message.includes("Suggestion:") ||
                message.includes("Example generator processing") ||
                message.includes("Example result processor")
            ) {
                return;
            }
        }

        this.message += `${message ?? ""}\n`;
    }
}
