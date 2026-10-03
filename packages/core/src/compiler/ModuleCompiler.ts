/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type CompilerOptions, ErrorMessage, InfoMessage, type Reporter, type WebpackLoaderOptions } from "@quatico/websmith-api";
import path from "node:path";
import ts from "typescript";
import { type AddonRegistry } from "./addons";
import { type CompileFragment, Compiler } from "./Compiler";
import { resolvePath } from "./config";
import { DefaultReporter } from "./DefaultReporter";
import {
    checkDirectoryImport,
    checkJsonImportAttribute,
    checkMissingExtension,
    createCjsNamesCache,
    type EsmCheckContext,
    type ImportRule,
    type ModuleClassification,
    type ScanCache,
} from "./esm";

/** What one module's build yields: its output, the diagnostics to report on it and the files to watch for it. */
export type ModuleBuildResult = {
    fragment: CompileFragment;
    diagnostics: ts.Diagnostic[];
    /** Files the build depends on, and files whose creation would change its result. */
    dependencies: { files: string[]; missing: string[] };
};

export type ModuleBuildOptions = {
    /** How the host loads the module, which decides how the ESM check classifies the target's output under `runtime: "bundler"`. */
    moduleKind?: ModuleClassification["kind"];
};

/** What a bundler host passes to a `ModuleCompiler`. */
export type ModuleCompilerHost = {
    /** The addons of the CLI's path; without them, the host applies its addons in `applyAddons`. */
    addons?: AddonRegistry;
    dependencyCallback?: (filePath: string) => void;
    /** Receives the debug messages of `build`, with the `debug` option only. */
    debug?: (message: string) => void;
};

export const MISSING_SYSTEM_ERROR = "TsCompiler.build() called without a valid ts.System";

// webpack reports unresolved imports itself (91012), and enforces fully specified imports itself under bundler
const NODE_IMPORT_RULES: readonly ImportRule[] = [checkMissingExtension, checkDirectoryImport, checkJsonImportAttribute];

type ScanEntry = Parameters<ScanCache["set"]>[1];

/**
 * A scan cache that forgets files a compilation did not check: `nextCompilation` keeps the scans used since the last
 * call as fallbacks for the next compilation and drops the others, e.g. those of deleted or renamed files.
 */
export class CompilationScanCache implements ScanCache {
    private current = new Map<string, ScanEntry>();
    private previous = new Map<string, ScanEntry>();

    /** `limit` caps each generation, since without compilation hooks nothing calls `nextCompilation`. */
    constructor(private readonly limit = 5000) {}

    public get(fileName: string): ScanEntry | undefined {
        const current = this.current.get(fileName);
        if (current) {
            return current;
        }
        const previous = this.previous.get(fileName);
        if (previous) {
            this.set(fileName, previous);
        }
        return previous;
    }

    public set(fileName: string, entry: ScanEntry): void {
        // A full generation starts the next, so the cache holds at most two generations, e.g. under thread-loader
        if (this.current.size >= this.limit && !this.current.has(fileName)) {
            this.nextCompilation();
        }
        this.current.set(fileName, entry);
    }

    public nextCompilation(): void {
        this.previous = this.current;
        this.current = new Map();
    }
}

/**
 * Keeps the errors that option resolution reports, i.e. the configuration errors of the selected profile, instead of
 * printing them: the loader fails the compilation with them.
 */
class ConfigErrorReporter implements Reporter {
    public errors: ts.Diagnostic[] = [];
    private collecting = false;

    constructor(private readonly target: Reporter) {}

    /** Collects the errors `resolve` reports, after those collected before with `keep`. */
    public collect<T>(resolve: () => T, keep = false): T {
        if (!keep) {
            this.errors = [];
        }
        this.collecting = true;
        try {
            return resolve();
        } finally {
            this.collecting = false;
        }
    }

    public reportDiagnostic(diagnostic: ts.Diagnostic): void {
        if (this.collecting && diagnostic.category === ts.DiagnosticCategory.Error) {
            this.errors.push(diagnostic);
        } else {
            this.target.reportDiagnostic(diagnostic);
        }
    }

    public reportWatchStatus(...args: Parameters<Reporter["reportWatchStatus"]>): void {
        this.target.reportWatchStatus(...args);
    }

    public indent(): void {
        this.target.indent();
    }

    public unindent(): void {
        this.target.unindent();
    }
}

/**
 * Compiles one module at a time for a bundler host, without depending on a bundler. The host calls `build` per module
 * and reports its diagnostics, reports `getConfigErrors` once per compilation, and calls `refreshOptions`,
 * `refreshAddons` and `resetCompilationCaches` when its compilations start. A host that applies addons of its own
 * overrides `applyAddons`; without that, the addons come from the `AddonRegistry` of the host options.
 */
export class ModuleCompiler extends Compiler {
    private profile?: string;
    private readonly debugSink?: (message: string) => void;
    private compilationCaches: Pick<EsmCheckContext, "packageTypeCache" | "cjsNamesCache"> = ModuleCompiler.createCompilationCaches();
    private readonly scanCache = new CompilationScanCache();
    private esmCheckTime = 0;
    private cachesPerCompilation = false;
    private compilationHooks = false;
    private readonly baseOptions: Partial<CompilerOptions>;
    private optionsFiles: ModuleBuildResult["dependencies"] = { files: [], missing: [] };
    private readonly optionsFileTimes = new Map<string, number | undefined>();
    private addonsStamp?: string;

    constructor(
        options: Partial<CompilerOptions>,
        loaderOptions: Partial<WebpackLoaderOptions> = {},
        system: ts.System = ts.sys,
        { addons, dependencyCallback, debug }: ModuleCompilerHost = {}
    ) {
        const reporter = new ConfigErrorReporter(options.reporter ?? new DefaultReporter(system));
        super({ ...options, reporter }, loaderOptions, system, addons, dependencyCallback);
        this.debugSink = debug;
        this.baseOptions = options;

        // The host checks the profile once its construction completes, see checkProfile
        this.profile = this.getOptions().profile || loaderOptions.profile || undefined;
        super.createProfileContextsIfNecessary();
        this.completeResolution();
    }

    /** Returns the profile whose output the host bundles. */
    public getProfile(): string | undefined {
        return this.profile;
    }

    /** Resolves the options and keeps their configuration errors for `getConfigErrors` instead of reporting them. */
    public setOptions(options: Partial<CompilerOptions>, loaderOptions?: Partial<WebpackLoaderOptions>): this {
        const reporter = this.getReporter();
        return reporter instanceof ConfigErrorReporter
            ? reporter.collect(() => super.setOptions(options, loaderOptions))
            : super.setOptions(options, loaderOptions);
    }

    /** Returns the configuration errors of the last option resolution: of the selected profile and its dependencies. */
    public getConfigErrors(): ts.Diagnostic[] {
        const reporter = this.getReporter();
        return reporter instanceof ConfigErrorReporter ? reporter.errors : [];
    }

    /**
     * Resolves the options again from `loaderOptions`, which must be resolved again from their files too, and creates
     * the compilation contexts and loads the addons again on their next use.
     */
    public updateLoaderConfig(loaderOptions: WebpackLoaderOptions): void {
        this.setOptions(this.baseOptions, loaderOptions);
        this.resetAddons();
        this.recreateCompilationContexts();

        const profileName = this.getOptions().profile || loaderOptions.profile;
        this.profile = profileName ? this.checkProfile(profileName) : undefined;
        this.completeResolution();
    }

    /** Returns the files the options are resolved from: the config file, the tsconfig.json and the files it extends. */
    public getOptionsFiles(): ModuleBuildResult["dependencies"] {
        return this.optionsFiles;
    }

    /**
     * Resolves the options again with `loadOptions` when one of their files changed: is one of `modifiedFiles`, or,
     * without them, has another modification time than at the last resolution. Returns whether it resolved them.
     * When they cannot be resolved, e.g. from a config file that is no JSON, the previous options stay and the error
     * is the configuration error until the next change.
     */
    public refreshOptions(loadOptions: () => WebpackLoaderOptions, modifiedFiles?: ReadonlySet<string>): boolean {
        const files = [...this.optionsFiles.files, ...this.optionsFiles.missing];
        const changed = modifiedFiles
            ? files.some(cur => modifiedFiles.has(cur))
            : files.some(cur => this.getModifiedTime(cur) !== this.optionsFileTimes.get(cur));
        if (changed) {
            try {
                this.updateLoaderConfig(loadOptions());
            } catch (error) {
                this.recordOptionsFiles();
                const message = error instanceof Error ? error.message : String(error);
                this.collectConfigErrors(() =>
                    this.getReporter().reportDiagnostic(new ErrorMessage(`Cannot resolve the loader options: ${message}`))
                );
            }
        }
        return changed;
    }

    /**
     * Loads the addons again on their next use when a file in the addons directory changed since they were loaded;
     * call it once per webpack compilation. Unchanged addons stay active across compilations.
     */
    public refreshAddons(): void {
        if (this.addonsStamp !== undefined && this.getAddonsStamp() !== this.addonsStamp) {
            this.resetAddons();
            this.recreateCompilationContexts();
        }
    }

    /** Marks that compilation hooks report the config errors once per compilation, so the loader does not. */
    public useCompilationHooks(): void {
        this.compilationHooks = true;
    }

    public hasCompilationHooks(): boolean {
        return this.compilationHooks;
    }

    /**
     * Keeps the package.json and CommonJS package memos of the ESM check until `resetCompilationCaches`, which a
     * compilation hook calls; without hooks, e.g. when a worker loader provides no compiler, each build drops them.
     */
    public keepCachesPerCompilation(): void {
        this.cachesPerCompilation = true;
    }

    /**
     * Drops the package.json and CommonJS package memos of the ESM check, and the scans the last compilation did not
     * use; call it once per webpack compilation.
     */
    public resetCompilationCaches(): void {
        super.resetCompilationCaches();
        this.compilationCaches = ModuleCompiler.createCompilationCaches();
        this.scanCache.nextCompilation();
    }

    /** Reports the time spent in the ESM check since the last report, with `debug` only. */
    public reportEsmCheckTime(): void {
        if (this.getOptions().debug && this.esmCheckTime > 0) {
            this.getReporter().reportDiagnostic(new InfoMessage(`ESM check took ${this.esmCheckTime.toFixed(1)} ms.`));
        }
        this.esmCheckTime = 0;
    }

    /**
     * Compiles one module for the host: emits it with the dependent profiles, which write their files, then with the
     * host's profile, whose files the host bundles. `moduleKind` decides how the ESM check classifies the target's
     * output under `runtime: "bundler"`; without it the check classifies by package.json.
     */
    public build(resourcePath: string, { moduleKind }: ModuleBuildOptions = {}): ModuleBuildResult {
        // Allow both ts.sys and virtual filesystems for testing
        const system = this.getSystem();
        if (!system) {
            throw new Error(MISSING_SYSTEM_ERROR);
        }

        this.logDebug(`Building file: ${resourcePath}`);
        this.logDebug(`Build directory: ${this.getOptions().buildDir}`);
        this.logDebug(`Profile: ${this.profile || "default"}`);

        // Note: WebpackAddonService will be initialized lazily when needed
        // This allows the full configuration to be available first

        const { buildDir } = this.getOptions();
        const filePath = resolvePath(this.getSystem(), buildDir, resourcePath);
        if (!this.cachesPerCompilation) {
            // Scans stay: they are keyed by their text, so only the memos and the core's compilation caches can go stale
            super.resetCompilationCaches();
            this.compilationCaches = ModuleCompiler.createCompilationCaches();
        }
        const diagnostics: ts.Diagnostic[] = [];
        const dependencies = { files: new Set<string>(), missing: new Set<string>() };
        const onDependency = (fileName: string, exists: boolean) => (exists ? dependencies.files : dependencies.missing).add(fileName);

        if (this.profile) {
            const selectedProfiles = this.getOptions().getSelectedProfiles(this.profile);
            this.logDebug(`Selected profiles: ${selectedProfiles.join(", ")}`);
            selectedProfiles
                .filter((profile: string) => profile !== this.profile)
                .forEach((profile: string) => {
                    // Transpile source file with other profiles (different from webpack target) and write the file
                    this.logDebug(`Emitting source file: ${filePath} with profile: ${profile}`);
                    const fragment = this.emitSourceFile(filePath, profile, true);
                    // Dependent profiles write files that another runtime loads: checked as written, by their own esm
                    diagnostics.push(...this.checkLoaderOutput(profile, filePath, fragment.writtenFiles, undefined, onDependency));

                    // TODO: We cannot apply the resultProcessors to the resulting fragment, because webpack has not written the file yet.
                    const ctx = this.getContext(profile);
                    if (ctx) {
                        ctx.getResultProcessors().forEach(cur => cur([filePath], ctx));
                    }
                });
        }

        // Apply addon transformations BEFORE compilation to register transformers
        try {
            this.applyAddons(filePath);
        } catch (error) {
            diagnostics.push(new ErrorMessage(`Addon processing failed: ${error instanceof Error ? error.message : String(error)}`));
        }

        // Transpile source file with webpack target but do not write the file, i.e. file is written by webpack
        this.logDebug(`Emitting source file: ${filePath} with profile: ${this.profile || "default"}`);
        const result = this.emitSourceFile(filePath, this.profile, true);
        this.onTargetEmitted(filePath);
        diagnostics.push(...(result.diagnostics ?? []), ...this.checkLoaderOutput(this.profile, filePath, result.files, moduleKind, onDependency));

        this.logDebug(`Emit result: ${result.files.length} files generated`);
        if (result.files.length > 0) {
            this.logDebug(`Write file: ${result.files[0].name}`);
        }

        this.logDebug(`Build completed for: ${resourcePath}`);
        return { fragment: result, diagnostics, dependencies: { files: [...dependencies.files], missing: [...dependencies.missing] } };
    }

    /**
     * Runs the result processors of the host's profile once with `files`, e.g. the files the host wrote. Returns the
     * errors of processors that throw as error diagnostics; the processors after them still run.
     */
    public runResultProcessors(files: string[]): ts.Diagnostic[] {
        const ctx = this.getContext(this.profile);
        const diagnostics: ts.Diagnostic[] = [];
        ctx?.getResultProcessors().forEach(cur => {
            try {
                cur(files, ctx);
            } catch (err) {
                diagnostics.push(new ErrorMessage(`Error in result processor "${ctx.getAddonName(cur)}": ${err}`));
            }
        });
        return diagnostics;
    }

    /**
     * The host's addon step: applies the host's own addons to `filePath` before the target profile emits it. A throw is
     * an error diagnostic of the build. Without an override, the addons of the `AddonRegistry` apply.
     */
    protected applyAddons(_filePath: string): void {
        // The registry's addons are activated with the compilation contexts
    }

    /** Validates the host's profile on a new option resolution; returns the profile to build with. */
    protected checkProfile(profile: string): string {
        return profile;
    }

    /** Called after the target profile emitted `filePath` and before its output is checked. */
    protected onTargetEmitted(_filePath: string): void {
        // Nothing to do without a host
    }

    /** Drops the host's addons, so they are loaded again on their next use. */
    protected resetAddons(): void {
        this.addonsStamp = undefined;
    }

    /** Records that the host loaded its addons, so `refreshAddons` loads them again when their directory changes. */
    protected markAddonsLoaded(): void {
        this.addonsStamp = this.getAddonsStamp();
    }

    protected logDebug(message: string): void {
        const debugEnabled = this.getOptions().debug ?? false;
        if (debugEnabled) {
            this.debugSink?.(message);
        }
    }

    protected emitSourceFile(fileName: string, profile: string | undefined, writeFile: boolean): CompileFragment {
        return super.emitSourceFile(fileName, profile, writeFile, true);
    }

    /**
     * Runs the ESM check on a profile's output of one module. `moduleKind` overrides the classification of a bundler
     * profile; a node profile's files are loaded by Node as written, so they are classified as Node does.
     */
    private checkLoaderOutput(
        profile: string | undefined,
        fileName: string,
        files: ts.OutputFile[],
        moduleKind: ModuleClassification["kind"] | undefined,
        onDependency: EsmCheckContext["onDependency"]
    ): ts.Diagnostic[] {
        const ctx = this.getContext(profile);
        // A profile that is not ESM is reported once per option resolution, see completeResolution
        const esm = ctx && files.length > 0 ? this.getCheckedEsm(profile, ctx, false) : undefined;
        if (!ctx || !esm) {
            return [];
        }
        const start = performance.now();
        try {
            return this.checkEsmOutput(esm, profile, ctx, [{ files, addons: ctx.getAddonsChangingFile(fileName), source: fileName }], {
                ...this.compilationCaches,
                scanCache: this.scanCache,
                onDependency,
                importRules: esm.runtime === "node" ? NODE_IMPORT_RULES : [],
                ...(esm.runtime === "bundler" && moduleKind && { moduleKind }),
            });
        } finally {
            this.esmCheckTime += performance.now() - start;
        }
    }

    /** Records the files of the resolved options and their modification times, and reports profiles that are not ESM. */
    private completeResolution(): void {
        this.recordOptionsFiles();
        this.collectConfigErrors(
            () =>
                this.getOptions()
                    .getSelectedProfiles()
                    .forEach(profile => {
                        const ctx = this.getContext(profile);
                        if (ctx) {
                            this.getCheckedEsm(profile, ctx);
                        }
                    }),
            true
        );
    }

    private recordOptionsFiles(): void {
        const { configFile, tsConfigFile, tsConfigExtends = [] } = this.getOptions();
        // webpack compares native paths
        const files = [...new Set([configFile, tsConfigFile, ...tsConfigExtends].filter(cur => !!cur).map(cur => path.resolve(cur as string)))];
        // Not this.getSystem(): subclasses may replace it before their construction completes
        const system = super.getSystem();
        this.optionsFiles = { files: files.filter(cur => system.fileExists(cur)), missing: files.filter(cur => !system.fileExists(cur)) };
        this.optionsFileTimes.clear();
        files.forEach(cur => this.optionsFileTimes.set(cur, this.getModifiedTime(cur)));
    }

    /** Collects the errors `report` reports as configuration errors, after the previous ones with `keep`. */
    private collectConfigErrors(report: () => void, keep = false): void {
        const reporter = this.getReporter();
        if (reporter instanceof ConfigErrorReporter) {
            reporter.collect(report, keep);
        } else {
            report();
        }
    }

    private getModifiedTime(fileName: string): number | undefined {
        return super.getSystem().getModifiedTime?.(fileName)?.getTime();
    }

    /** Identifies the files of the addons directory and their modification times. */
    private getAddonsStamp(): string {
        const addonsDir = this.getOptions().config?.addonsDir;
        const system = this.getSystem();
        if (!addonsDir || !system.directoryExists(addonsDir)) {
            return "";
        }
        return system
            .readDirectory(addonsDir, undefined, ["**/node_modules"])
            .map(cur => `${cur}:${this.getModifiedTime(cur)}`)
            .join("\n");
    }

    private static createCompilationCaches(): Pick<EsmCheckContext, "packageTypeCache" | "cjsNamesCache"> {
        return { packageTypeCache: new Map(), cjsNamesCache: createCjsNamesCache() };
    }
}
