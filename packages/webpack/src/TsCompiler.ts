/* eslint-disable no-console */
/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */

import { type CompileFragment, Compiler, type CompilerOptions, resolvePath, type WebpackLoaderOptions } from "@quatico/websmith-core";
import ts from "typescript";
import { WebpackError, type LoaderContext } from "webpack";
import { type WebsmithLoaderConfig } from "./WebsmithLoaderConfig";

export class TsCompiler extends Compiler {
    private profile?: string;
    public readonly warn: (err: WebpackError) => void;
    public readonly error: (err: WebpackError) => void;
    private loaderContext?: LoaderContext<WebsmithLoaderConfig>;

    constructor(
        options: CompilerOptions,
        loaderOptions: WebsmithLoaderConfig = {},
        dependencyCallback: (filePath: string) => void,
        loaderContext?: LoaderContext<WebsmithLoaderConfig>
    ) {
        super(options, loaderOptions, ts.sys, undefined, dependencyCallback);
        this.warn = loaderOptions.warn ?? ((err: WebpackError) => console.warn(err.message));
        this.error = loaderOptions.error ?? ((err: WebpackError) => console.error(err.message));
        this.loaderContext = loaderContext;
        const profileName = this.getOptions().profile;
        this.profile = profileName ? this.getFragmentProfile(profileName) : undefined;
        super.createProfileContextsIfNecessary();
    }

    private logDebug(message: string): void {
        const debugEnabled = this.getOptions().debug ?? false;
        if (debugEnabled) {
            if (this.loaderContext) {
                // Use webpack's infrastructure logging
                this.loaderContext.emitWarning(new WebpackError(`[websmith-loader] ${message}`));
            } else {
                // Fallback to console.log if no loader context
                console.log(`[DEBUG] ${message}`);
            }
        }
    }

    public getProfile(): string | undefined {
        return this.profile;
    }

    public updateLoaderConfig(loaderOptions: WebpackLoaderOptions): void {
        super.setOptions(super.getOptions(), loaderOptions);
    }

    public build(resourcePath: string): CompileFragment {
        if (this.getSystem() !== ts.sys) {
            throw new Error("TsCompiler.build() not called with ts.sys as the active ts.System");
        }

        const { buildDir } = this.getOptions();

        this.logDebug(`Building file: ${resourcePath}`);
        this.logDebug(`Build directory: ${buildDir}`);
        this.logDebug(`Profile: ${this.profile || "default"}`);

        const filePath = resolvePath(this.getSystem(), buildDir, resourcePath);
        if (this.profile) {
            const selectedProfiles = this.getOptions().getSelectedProfiles(this.profile);
            this.logDebug(`Selected profiles: ${selectedProfiles.join(", ")}`);
            selectedProfiles
                .filter((profile: string) => profile !== this.profile)
                .forEach((profile: string) => {
                    this.logDebug(`Processing profile: ${profile}`);
                    // Transpile source file with other profiles (different from webpack target) and write the file
                    this.emitSourceFile(filePath, profile, true);

                    // TODO: We cannot apply the resultProcessors to the resulting fragment, because webpack has not written the file yet.
                    this.getContext(profile)
                        ?.getResultProcessors()
                        .forEach(cur => cur([filePath]));
                });
        }

        // Transpile source file with webpack target but do not write the file, i.e. file is written by webpack
        this.logDebug(`Emitting source file with profile: ${this.profile || "default"}`);
        const result = this.emitSourceFile(filePath, this.profile, false);

        if (result.diagnostics?.length) {
            this.logDebug(`Found ${result.diagnostics.length} diagnostics`);
            result.diagnostics.forEach((diagnostic: ts.Diagnostic) => {
                const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
                this.error(new WebpackError(message));
            });
        }

        this.logDebug(`Build completed for: ${resourcePath}`);

        return result;
    }

    protected emitSourceFile(fileName: string, profile: string | undefined, writeFile: boolean): CompileFragment {
        this.logDebug(`Emitting source file: ${fileName}`);
        this.logDebug(`Profile: ${profile || "default"}`);
        this.logDebug(`Write file: ${writeFile}`);

        const result = super.emitSourceFile(fileName, profile, writeFile, true);

        this.logDebug(`Emit result - diagnostics: ${result.diagnostics?.length || 0}, files: ${result.files?.length || 0}`);

        return result;
    }

    private getFragmentProfile(profile: string): string {
        const available = super.getDefinedProfiles();
        const selected = [...(this.getOptions().config?.profiles?.[profile]?.depends ?? []), profile];
        const missing = selected.filter(cur => !available.includes(cur));
        if (missing.length) {
            const noProfileError = `Found missing profile(s) '${missing.join(", ")}' in available profile(s) '${available.join(", ")}'.`;
            this.error(new WebpackError(noProfileError));
            throw new Error(noProfileError);
        }

        return profile;
    }
}
