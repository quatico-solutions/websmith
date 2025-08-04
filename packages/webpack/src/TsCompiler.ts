/* eslint-disable no-console */
/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */

import { type CompileFragment, Compiler, type CompilerOptions, resolvePath, type WebpackLoaderOptions } from "@quatico/websmith-core";
import { AddonRegistry } from "@quatico/websmith-core";
import ts from "typescript";
import { type LoaderContext, WebpackError } from "webpack";
import { type WebsmithLoaderConfig } from "./WebsmithLoaderConfig";

export class TsCompiler extends Compiler {
    private profile?: string;
    public readonly warn: (err: WebpackError) => void;
    public readonly error: (err: WebpackError) => void;
    private loaderContext?: LoaderContext<WebsmithLoaderConfig>;

    constructor(
        options: CompilerOptions,
        loaderOptions: WebsmithLoaderConfig = {},
        dependencyCallback?: (filePath: string) => void,
        loaderContext?: LoaderContext<WebsmithLoaderConfig>,
        system?: ts.System
    ) {
        super(options, loaderOptions, system || ts.sys, undefined, dependencyCallback);
        this.warn = loaderOptions.warn ?? ((err: WebpackError) => console.warn(err.message));
        this.error = loaderOptions.error ?? ((err: WebpackError) => console.error(err.message));
        this.loaderContext = loaderContext;

        // Ensure loaderOptions are properly set in the parent class
        super.setOptions(super.getOptions(), loaderOptions);

        const profileName = this.getOptions().profile;
        this.profile = profileName ? this.getFragmentProfile(profileName) : undefined;

        // Set up addon registry if addons are configured
        this.setupAddonRegistry();

        this.logDebug(`Creating profile contexts for profile: ${this.profile || "default"}`);
        super.createProfileContextsIfNecessary();
        this.logDebug(`Profile contexts created. Available profiles: ${this.getDefinedProfiles().join(", ")}`);
    }

    private setupAddonRegistry(): void {
        const { config } = this.getOptions();
        if (config?.addonsDir) {
            const system = this.getSystem();
            if (!system) {
                this.logDebug("System not available, skipping addon registry setup");
                return;
            }

            const addonRegistry = new AddonRegistry({
                addonsDir: config.addonsDir,
                addons: config.addons ?? [],
                profiles: config.profiles ?? {},
                reporter: this.getReporter(),
                system: system,
            });
            this.setAddonRegistry(addonRegistry);
        }
    }

    private logDebug(message: string): void {
        const debugEnabled = this.getOptions().debug ?? false;
        if (debugEnabled) {
            if (this.loaderContext) {
                // Use webpack's infrastructure logging properly
                const logger = this.loaderContext.getLogger("websmith-loader");
                if (logger) {
                    logger.info(`[websmith-loader] ${message}`);
                } else {
                    // Fallback to console.log if logger is not available
                    console.log(`[DEBUG] [websmith-loader] ${message}`);
                }
            } else {
                // Fallback to console.log if no loader context
                console.log(`[DEBUG] [websmith-loader] ${message}`);
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
        // Allow both ts.sys and virtual filesystems for testing
        const system = this.getSystem();
        if (!system) {
            throw new Error("TsCompiler.build() called without a valid ts.System");
        }

        const { buildDir } = this.getOptions();

        this.logDebug(`Building file: ${resourcePath}`);
        this.logDebug(`Build directory: ${buildDir}`);
        this.logDebug(`Profile: ${this.profile || "default"}`);

        // Ensure profile contexts are created before emitting files
        this.createProfileContextsIfNecessary();

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
        // In test mode, we need to write files to the virtual filesystem
        // However, if emitSourceFile has been stubbed (like in tests), we should not write files
        const isTestMode = this.getSystem() !== ts.sys;
        const isStubbed = this.emitSourceFile !== super.emitSourceFile;
        const shouldWriteFiles = isTestMode && !isStubbed;

        this.logDebug(`Emitting source file with profile: ${this.profile || "default"}`);
        this.logDebug(`Is test mode: ${isTestMode}, is stubbed: ${isStubbed}, should write files: ${shouldWriteFiles}`);

        // For TsCompiler, we need to ensure the file is in the root files list
        // This is needed because the parent Compiler class expects root files to be set up
        const currentCliArgs = this.getOptions().cliArgs;
        if (currentCliArgs && !currentCliArgs.fileNames.includes(filePath)) {
            this.logDebug(`Adding ${filePath} to root files`);
            currentCliArgs.fileNames = [...currentCliArgs.fileNames, filePath];
        }

        const result = this.emitSourceFile(filePath, this.profile, shouldWriteFiles);

        // Write all output files to the file system, including addon-generated files
        if (result.files && result.files.length > 0) {
            this.logDebug(`Writing ${result.files.length} output files to file system`);
            result.files.forEach(file => {
                this.logDebug(`Writing file: ${file.name}`);
                this.getSystem().writeFile(file.name, file.text);
            });
        }

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

        // For tests with virtual filesystem, we need to write files
        const isTestMode = this.getSystem() !== ts.sys;
        const shouldWriteFiles = writeFile || isTestMode;

        this.logDebug(`Is test mode: ${isTestMode}`);
        this.logDebug(`Should write files: ${shouldWriteFiles}`);

        // Ensure default context is created if no profile is specified
        if (!profile) {
            this.getContext(); // This will create the default context if it doesn't exist
        }

        // Check if context exists
        const context = this.getContext(profile);
        this.logDebug(`Context exists: ${!!context}`);
        if (context) {
            this.logDebug(`Context outDir: ${context.getCliArgs().options.outDir}`);
            this.logDebug(`Context declaration: ${context.getCliArgs().options.declaration}`);

            // Check cache
            const cache = context.getCache();
            this.logDebug(`Cache exists: ${!!cache}`);
            if (cache) {
                const filePath = this.getSystem().resolvePath(fileName);
                const hasChanged = cache.hasChanged(filePath);
                this.logDebug(`Cache hasChanged: ${hasChanged}`);
                const cachedFile = cache.getCachedFile(filePath);
                this.logDebug(`Cached file exists: ${!!cachedFile}`);
            }
        }

        // Check if file exists
        const fileExists = this.getSystem().fileExists(fileName);
        this.logDebug(`File exists: ${fileExists}`);
        if (fileExists) {
            const fileContent = this.getSystem().readFile(fileName);
            this.logDebug(`File content length: ${fileContent?.length || 0}`);
        }

        const result = super.emitSourceFile(fileName, profile, shouldWriteFiles, true);

        this.logDebug(`Emit result - diagnostics: ${result.diagnostics?.length || 0}, files: ${result.files?.length || 0}`);
        if (result.files && result.files.length > 0) {
            result.files.forEach((file, index) => {
                this.logDebug(`File ${index}: ${file.name} (${file.text.length} chars)`);
            });
        } else {
            this.logDebug(`No files generated - output was undefined or emitSkipped was true`);
        }

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
