/* eslint-disable no-console */
/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */

import {
    AddonRegistry,
    type CompilationConfig,
    type CompileFragment,
    Compiler,
    type CompilerOptions,
    resolveCompilationConfig,
    type WebpackLoaderOptions,
} from "@quatico/websmith-core";
import ts from "typescript";
import { WebpackError } from "webpack";
import { type WebsmithLoaderConfig } from "./WebsmithLoaderConfig";

export class TsCompiler extends Compiler {
    private profile?: string;
    public readonly warn: (err: WebpackError) => void;
    public readonly error: (err: WebpackError) => void;

    constructor(options: CompilerOptions, loaderOptions: WebsmithLoaderConfig = {}, dependencyCallback: (filePath: string) => void) {
        // TODO: Resolve compiler options
        const system = ts.sys;
        const compilationConfig = loadCompilationConfig(options, loaderOptions, system);
        const { addons, profiles: profileMap, addonsDir } = compilationConfig;
        const profileName = loaderOptions.profile ?? options.profile;
        const selectedProfiles = profileName ? [...(options.config?.profiles?.[profileName]?.depends ?? []), profileName] : [];
        const addonsMerged = addons?.length
            ? addons
            : Object.entries(profileMap ?? {})
                  .filter(([name]) => selectedProfiles.includes(name))
                  // eslint-disable-next-line @typescript-eslint/no-unused-vars
                  .map(([_, value]) => value.addons ?? [])
                  .flat();

        super(
            { ...options, config: { ...options.config, ...compilationConfig } },
            loaderOptions,
            system,
            addonsMerged.length
                ? new AddonRegistry({
                      addons: addonsMerged,
                      addonsDir: addonsDir ?? options.config?.addonsDir ?? "./addons",
                      reporter: options.reporter,
                      system,
                  })
                : undefined,
            dependencyCallback
        );
        this.warn = loaderOptions.warn ?? ((err: WebpackError) => console.warn(err.message));
        this.error = loaderOptions.error ?? ((err: WebpackError) => console.error(err.message));
        this.profile = profileName ? this.getFragmentProfile(profileName) : undefined;
        super.createProfileContextsIfNecessary();
    }

    public getProfile(): string | undefined {
        return this.profile;
    }

    public updateLoaderConfig(loaderOptions: WebpackLoaderOptions): void {
        const options = super.getOptions();
        const compilationConfig = loadCompilationConfig(options, loaderOptions, this.getSystem());
        super.setOptions({ ...options, config: { ...options.config, ...compilationConfig } }, loaderOptions);
    }

    public build(resourcePath: string): CompileFragment {
        if (this.getSystem() !== ts.sys) {
            throw new Error("TsCompiler.build() not called with ts.sys as the active ts.System");
        }

        const filePath = this.getSystem().resolvePath(resourcePath);
        if (this.profile) {
            const selectedProfiles = this.getOptions().getSelectedProfiles(this.profile);
            selectedProfiles
                .filter((profile: string) => profile !== this.profile)
                .forEach((profile: string) => {
                    // Transpile source file with other profiles (different from webpack target) and write the file
                    this.emitSourceFile(filePath, profile, true);

                    // TODO: We cannot apply the resultProcessors to the resulting fragment, because webpack has not written the file yet.
                    this.getContext(profile)
                        ?.getResultProcessors()
                        .forEach(cur => cur([filePath]));
                });
        }

        // Transpile source file with webpack target but do not write the file, i.e. file is written by webpack
        const result = this.emitSourceFile(filePath, this.profile, false);

        if (result.diagnostics?.length) {
            result.diagnostics.forEach((diagnostic: ts.Diagnostic) => {
                const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
                this.error(new WebpackError(message));
            });
        }

        return result;
    }

    protected emitSourceFile(fileName: string, profile: string | undefined, writeFile: boolean): CompileFragment {
        return super.emitSourceFile(fileName, profile, writeFile, true);
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

const loadCompilationConfig = (options: CompilerOptions, loaderOptions: WebpackLoaderOptions, system: ts.System): CompilationConfig => {
    // Prefer config values from webpack loaderConfig, but fallback to values from websmith.config.json
    const { configFile = loaderOptions.configFile ?? options.configFile, transpileOnly } = loaderOptions;
    const addons = loaderOptions.config?.addons ?? options.config?.addons ?? [];
    const addonsDir = loaderOptions.config?.addonsDir ?? options.config?.addonsDir;
    let results: CompilationConfig = {
        ...(addons.length && { addons }),
        ...(!!addonsDir && { addonsDir }),
        ...(!!transpileOnly && { transpileOnly }),
    };
    if (configFile) {
        results = { ...resolveCompilationConfig(configFile, options.reporter, system), ...results };
    }
    return results;
};
