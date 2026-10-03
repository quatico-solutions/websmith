/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */

import { type CompilerOptions, InfoMessage } from "@quatico/websmith-api";
import {
    type CompileFragment,
    type ModuleBuildOptions,
    type ModuleBuildResult,
    type ModuleClassification,
    ModuleCompiler,
} from "@quatico/websmith-core";
import path from "node:path";
import ts from "typescript";
import { type LoaderContext, WebpackError } from "webpack";
import { type WebpackAddonContext } from "./WebpackAddonContext";
import { type WebpackAddonConfig, WebpackAddonService } from "./WebpackAddonService";
import { type WebsmithLoaderConfig } from "./WebsmithLoaderConfig";

export { CompilationScanCache } from "@quatico/websmith-core";

/** What the loader reports for one module: diagnostics to emit and files to register with webpack. */
export type LoaderBuildResult = ModuleBuildResult;

// How webpack's module types load: webpack decides for the bundler target, since its default rules ignore .ts/.mts/.cts
const MODULE_KINDS: ReadonlyMap<string, ModuleClassification["kind"]> = new Map([
    ["javascript/esm", "esm"],
    ["javascript/dynamic", "dynamic"],
    ["javascript/auto", "auto"],
]);

export class TsCompiler extends ModuleCompiler {
    public readonly warn: (err: WebpackError) => void;
    public readonly error: (err: WebpackError) => void;
    private loaderContext?: LoaderContext<WebsmithLoaderConfig>;
    private webpackAddonService?: WebpackAddonService;
    private cachedWebpackContext?: WebpackAddonContext;
    private moduleType?: string;

    constructor(
        options: CompilerOptions,
        loaderOptions: WebsmithLoaderConfig = {},
        dependencyCallback?: (filePath: string) => void,
        loaderContext?: LoaderContext<WebsmithLoaderConfig>,
        system?: ts.System
    ) {
        super(options, loaderOptions, system || ts.sys, {
            dependencyCallback,
            debug: message => loaderContext?.emitWarning(new WebpackError(`[websmith-loader] ${message}`)),
        });
        this.warn = loaderOptions.warn ?? (() => {});
        this.error = loaderOptions.error ?? (() => {});
        this.loaderContext = loaderContext;

        const profile = this.getProfile();
        if (profile) {
            this.checkProfile(profile);
        }
    }

    /**
     * Compiles one module for webpack. `moduleType` is webpack's type of the module, which decides how the ESM check
     * classifies the target's output under `runtime: "bundler"`; without it the check classifies by package.json.
     */
    public build(resourcePath: string, moduleType?: string | ModuleBuildOptions): LoaderBuildResult {
        if (typeof moduleType === "object") {
            return super.build(resourcePath, moduleType);
        }
        this.moduleType = moduleType;
        try {
            return super.build(resourcePath, { moduleKind: moduleType ? MODULE_KINDS.get(moduleType) : undefined });
        } finally {
            this.moduleType = undefined;
        }
    }

    protected onTargetEmitted(filePath: string): void {
        // webpack bundles the target's files, also under addonEmitOnly where none of them may be written
        const moduleType = this.moduleType;
        if (moduleType && !MODULE_KINDS.has(moduleType) && this.getOptions().debug) {
            this.getReporter().reportDiagnostic(
                new InfoMessage(`Unknown webpack module type "${moduleType}", the ESM check classifies ${filePath} by package.json.`)
            );
        }
    }

    protected applyAddons(filePath: string): void {
        this.applyAddonFunctionality(filePath, { version: 0, files: [], writtenFiles: [], diagnostics: [] });
    }

    protected checkProfile(profile: string): string {
        return this.getFragmentProfile(profile);
    }

    protected resetAddons(): void {
        super.resetAddons();
        this.webpackAddonService = undefined;
        this.cachedWebpackContext = undefined;
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

            this.markAddonsLoaded();
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
            const context = this.getContext(this.getProfile());

            let webpackContext;
            if (context) {
                // Cache the WebpackAddonContext to avoid re-creating it for each file
                if (!this.cachedWebpackContext) {
                    // Access webpack compilation from loader context
                    const webpackCompilation = this.loaderContext?._compilation;

                    this.cachedWebpackContext = this.webpackAddonService.applyAddonsToContext(
                        context,
                        this.getProfile(),
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
                    this.webpackAddonService.generateAddonOutputs(compiledFiles, this.getProfile());
                }
            }

            this.logDebug(`Applied addon functionality for profile: ${this.getProfile() || "default"}`);
        } catch (error) {
            // Don't break webpack builds due to addon errors
            this.logDebug(`Addon functionality failed: ${error instanceof Error ? error.message : String(error)}`);
            this.warn(new WebpackError(`Addon processing failed: ${error instanceof Error ? error.message : String(error)}`));
        }
    }
}
