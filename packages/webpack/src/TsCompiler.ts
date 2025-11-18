/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */

import { type CompilerOptions, type WebpackLoaderOptions } from "@quatico/websmith-api";
import { type CompileFragment, Compiler, resolvePath } from "@quatico/websmith-core";
import path from "node:path";
import ts from "typescript";
import { type LoaderContext, WebpackError } from "webpack";
import { type WebpackAddonContext } from "./WebpackAddonContext";
import { type WebpackAddonConfig, WebpackAddonService } from "./WebpackAddonService";
import { type WebsmithLoaderConfig } from "./WebsmithLoaderConfig";

export class TsCompiler extends Compiler {
    private profile?: string;
    public readonly warn: (err: WebpackError) => void;
    public readonly error: (err: WebpackError) => void;
    private loaderContext?: LoaderContext<WebsmithLoaderConfig>;
    private webpackAddonService?: WebpackAddonService;
    private cachedWebpackContext?: WebpackAddonContext;

    constructor(
        options: CompilerOptions,
        loaderOptions: WebsmithLoaderConfig = {},
        dependencyCallback?: (filePath: string) => void,
        loaderContext?: LoaderContext<WebsmithLoaderConfig>,
        system?: ts.System
    ) {
        super(options, loaderOptions, system || ts.sys, undefined, dependencyCallback);
        this.warn = loaderOptions.warn ?? (() => {});
        this.error = loaderOptions.error ?? (() => {});
        this.loaderContext = loaderContext;

        const profileName = this.getOptions().profile || loaderOptions.profile;
        this.profile = profileName ? this.getFragmentProfile(profileName) : undefined;
        super.createProfileContextsIfNecessary();
    }

    public getProfile(): string | undefined {
        return this.profile;
    }

    public updateLoaderConfig(loaderOptions: WebpackLoaderOptions): void {
        super.setOptions(super.getOptions(), loaderOptions);

        // Initialize or re-initialize the webpack addon service now that we have the full configuration
        this.setupWebpackAddonService();

        // Update profile after configuration is updated
        const profileName = this.getOptions().profile || loaderOptions.profile;
        this.profile = profileName ? this.getFragmentProfile(profileName) : undefined;
    }

    public build(resourcePath: string): CompileFragment {
        // Allow both ts.sys and virtual filesystems for testing
        const system = this.getSystem();
        if (!system) {
            throw new Error("TsCompiler.build() called without a valid ts.System");
        }

        this.logDebug(`Building file: ${resourcePath}`);
        this.logDebug(`Build directory: ${this.getOptions().buildDir}`);
        this.logDebug(`Profile: ${this.profile || "default"}`);

        // Note: WebpackAddonService will be initialized lazily when needed
        // This allows the full configuration to be available first

        const { buildDir } = this.getOptions();
        const filePath = resolvePath(this.getSystem(), buildDir, resourcePath);

        if (this.profile) {
            const selectedProfiles = this.getOptions().getSelectedProfiles(this.profile);
            this.logDebug(`Selected profiles: ${selectedProfiles.join(", ")}`);
            selectedProfiles
                .filter((profile: string) => profile !== this.profile)
                .forEach((profile: string) => {
                    // Transpile source file with other profiles (different from webpack target) and write the file
                    this.logDebug(`Emitting source file: ${filePath} with profile: ${profile}`);
                    this.emitSourceFile(filePath, profile, true);

                    // TODO: We cannot apply the resultProcessors to the resulting fragment, because webpack has not written the file yet.
                    const ctx = this.getContext(profile);
                    if (ctx) {
                        ctx.getResultProcessors().forEach(cur => cur([filePath], ctx));
                    }
                });
        }

        // Apply addon transformations BEFORE compilation to register transformers
        this.applyAddonFunctionality(filePath, { version: 0, files: [], diagnostics: [] });

        // Transpile source file with webpack target but do not write the file, i.e. file is written by webpack
        this.logDebug(`Emitting source file: ${filePath} with profile: ${this.profile || "default"}`);
        const result = this.emitSourceFile(filePath, this.profile, true);

        if (result.diagnostics?.length) {
            result.diagnostics.forEach((diagnostic: ts.Diagnostic) => {
                const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
                this.error(new WebpackError(message));
            });
        }

        this.logDebug(`Emit result: ${result.files.length} files generated`);
        if (result.files.length > 0) {
            this.logDebug(`Write file: ${result.files[0].name}`);
        }

        this.logDebug(`Build completed for: ${resourcePath}`);
        return result;
    }

    protected emitSourceFile(fileName: string, profile: string | undefined, writeFile: boolean): CompileFragment {
        return super.emitSourceFile(fileName, profile, writeFile, true);
    }

    private setupWebpackAddonService(): void {
        const options = this.getOptions();
        const config = options.config;

        this.logDebug(`Setting up WebpackAddonService - addonsDir: ${config?.addonsDir}, addons: ${config?.addons?.join(", ") || "none"}`);

        // Only setup addon service if addons are configured
        if (config?.addonsDir || config?.addons?.length) {
            const addonConfig: WebpackAddonConfig = {
                addonsDir: config?.addonsDir,
                addons: config?.addons,
                profiles: config?.profiles,
                system: this.getSystem(),
                reporter: this.getReporter(),
                cacheDir: path.join(this.getSystem().getCurrentDirectory() || process.cwd(), ".websmith-cache", "addons"),
                ...(options.debug ? { debug: true } : {}),
            };

            this.webpackAddonService = new WebpackAddonService(addonConfig);
            this.logDebug(`WebpackAddonService initialized with addonsDir: ${config?.addonsDir}`);

            // Load available addons immediately
            this.webpackAddonService.getAvailableAddons();
            this.logDebug(`Addons loaded and ready`);
        } else {
            this.logDebug(`No WebpackAddonService created - no addons configured`);
        }
    }

    private getFragmentProfile(profile: string): string {
        // Validate profile against available profiles in config
        const profiles = this.getOptions().config?.profiles;
        if (profiles && !profiles[profile]) {
            this.warn(new WebpackError(`Profile "${profile}" not found in configuration. Available profiles: ${Object.keys(profiles).join(", ")}`));
        }
        return profile;
    }

    private applyAddonFunctionality(filePath: string, result: CompileFragment): void {
        // Ensure addon service is initialized (lazy initialization)
        if (!this.webpackAddonService) {
            this.setupWebpackAddonService();
        }

        if (!this.webpackAddonService) {
            return;
        }

        try {
            // Apply addon transformations to the compilation context
            const context = this.getContext(this.profile);

            let webpackContext;
            if (context) {
                // Cache the WebpackAddonContext to avoid re-creating it for each file
                if (!this.cachedWebpackContext) {
                    // Access webpack compilation from loader context
                    const webpackCompilation = this.loaderContext?._compilation;

                    this.cachedWebpackContext = this.webpackAddonService.applyAddonsToContext(
                        context,
                        this.profile,
                        this.loaderContext,
                        webpackCompilation
                    );
                }
                webpackContext = this.cachedWebpackContext;

                // Only apply file-level processing if we have actual compilation results
                if (result.files.length > 0 && (webpackContext.hasGenerators() || webpackContext.hasProcessors())) {
                    const fileContent = this.getSystem().readFile(filePath) || "";

                    // Execute generators
                    if (webpackContext.hasGenerators()) {
                        webpackContext.executeGenerators(filePath, fileContent);
                    }

                    // Execute processors and update the compilation result if needed
                    if (webpackContext.hasProcessors()) {
                        webpackContext.executeProcessors(filePath, fileContent);
                        // Note: In webpack context, we can't directly modify the result here
                        // Processors would need to work through TypeScript transformers instead
                    }

                    // Generate addon output files after compilation
                    const compiledFiles = result.files.map(f => f.name);
                    this.webpackAddonService.generateAddonOutputs(compiledFiles, this.profile);
                }
            }

            this.logDebug(`Applied addon functionality for profile: ${this.profile || "default"}`);
        } catch (error) {
            // Don't break webpack builds due to addon errors
            this.logDebug(`Addon functionality failed: ${error instanceof Error ? error.message : String(error)}`);
            this.warn(new WebpackError(`Addon processing failed: ${error instanceof Error ? error.message : String(error)}`));
        }
    }

    private logDebug(message: string): void {
        const debugEnabled = this.getOptions().debug ?? false;
        if (debugEnabled) {
            if (this.loaderContext) {
                this.loaderContext.emitWarning(new WebpackError(`[websmith-loader] ${message}`));
            }
        }
    }
}
