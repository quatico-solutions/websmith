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
import { type CompilationContext, type CompilationContextOptions } from "./compilation";
import { type CompileFragment, Compiler, ROOT_DIR_INFERENCE_ERROR } from "./Compiler";
import { isNodeModuleKind, resolvePath } from "./config";
import { DefaultReporter } from "./DefaultReporter";
import {
    checkDirectoryImport,
    checkJsonImportAttribute,
    checkMissingExtension,
    createCjsNamesCache,
    createPackageTypeLookup,
    type EsmCheckContext,
    type ImportRule,
    type ModuleClassification,
    type PackageType,
    type ScanCache,
} from "./esm";
import { getTypeDependencies } from "./type-dependencies";

/** What one module's build yields: its output, the diagnostics to report on it and the files to watch for it. */
export type ModuleBuildResult = {
    fragment: CompileFragment;
    diagnostics: ts.Diagnostic[];
    /**
     * Files the build depends on, and files whose creation would change its result. When a profile emitted the module
     * with a Program, i.e. with type information, `files` also holds the project files its type check read: its
     * transitive imports, also those for types only, and the global files of the Program, never `lib*.d.ts` or files
     * under `node_modules`. `packageTypes` holds the package.json files whose `"type"` alone decided the build, with
     * the type read, `null` for none: only a change of that type changes the result.
     */
    dependencies: { files: string[]; missing: string[]; packageTypes: Record<string, PackageType | null> };
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
    /** Compiler options that apply to the host's profile only, i.e. the fragment `build` returns, not to its dependent profiles. */
    targetCompilerOptions?: ts.CompilerOptions;
    /**
     * Creates the compilation context of the host's profile, e.g. one whose `AddonContext` methods map to the bundler.
     * Dependent profiles keep the core context.
     */
    createContext?: (options: CompilationContextOptions) => CompilationContext;
};

export const MISSING_SYSTEM_ERROR = "TsCompiler.build() called without a valid ts.System";

// webpack reports unresolved imports itself (91012), and enforces fully specified imports itself under bundler
const NODE_IMPORT_RULES: readonly ImportRule[] = [checkMissingExtension, checkDirectoryImport, checkJsonImportAttribute];

/**
 * How a profile emits in a bundler host: "memory" when its resolved options set `noEmit`, "memory-declarations" when they
 * set `emitDeclarationOnly`, else "disk". A profile in memory emits its JavaScript for the host without writing it.
 */
type EmitMode = "memory" | "memory-declarations" | "disk";

// Compiled without them, so the JavaScript exists; tsc removes nothing else under these options
const IN_MEMORY_OPTIONS: ts.CompilerOptions = { noEmit: false, emitDeclarationOnly: false, allowImportingTsExtensions: false };

const isJavaScriptOutput = (fileName: string): boolean => /\.([cm]?js|jsx)(\.map)?$/i.test(fileName);

const isDeclarationOutput = (fileName: string): boolean => /\.d\.[cm]?ts(\.map)?$/i.test(fileName);

type ScanEntry = Parameters<ScanCache["set"]>[1];

/**
 * Returns a copy of `diagnostic` whose message names `profile`, the way the ESM check names its profile: a chain is
 * labelled on its head. TypeScript caches its diagnostics per Program, so the label goes on a copy.
 */
const labelWithProfile = (diagnostic: ts.Diagnostic, profile: string): ts.Diagnostic => {
    const suffix = ` (profile "${profile}")`;
    const { messageText } = diagnostic;
    return {
        ...diagnostic,
        messageText: typeof messageText === "string" ? messageText + suffix : { ...messageText, messageText: messageText.messageText + suffix },
    };
};

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
 * and reports its diagnostics, reports `getConfigErrors` once per compilation, or without compilation hooks
 * `takeUnreportedConfigErrors` per module with a token of its compilation, and calls `refreshOptions`,
 * `refreshAddons` and `resetCompilationCaches` when its compilations start. A host that applies addons of its own
 * overrides `applyAddons`, and `prepareAddons` if they need setting up first; without that, the addons come from the
 * `AddonRegistry` of the host options. When `isProfileConfigured` is false, `build` emits nothing and the host finishes
 * the module without output: the configuration error of the profile fails the build. The diagnostics of the dependent
 * profiles come with those of `build` and `getConfigErrors`, labelled with their profile: a host reports them without
 * work of its own.
 */
export class ModuleCompiler extends Compiler {
    private profile?: string;
    private readonly debugSink?: (message: string) => void;
    private readonly targetCompilerOptions: ts.CompilerOptions;
    private contextFactory?: (options: CompilationContextOptions) => CompilationContext;
    private compilationCaches: Pick<EsmCheckContext, "packageTypeCache" | "cjsNamesCache"> = ModuleCompiler.createCompilationCaches();
    private readonly scanCache = new CompilationScanCache();
    private esmCheckTime = 0;
    private cachesPerCompilation = false;
    private compilationHooks = false;
    private readonly baseOptions: Partial<CompilerOptions>;
    private optionsFiles: Omit<ModuleBuildResult["dependencies"], "packageTypes"> = { files: [], missing: [] };
    private readonly optionsFileTimes = new Map<string, number | undefined>();
    private addonsStamp?: string;
    // Until the next option resolution: Compiler's constructor resolves the options before these fields exist
    private readonly fileLessErrors = new Map<string, ts.Diagnostic>();
    private readonly configErrorCarriers = new Map<string, string>();
    private configErrorCompilation?: unknown;
    private readonly emitModes = new Map<string | undefined, EmitMode>();
    // The type dependencies the running build collects, and those of each module's last build
    private typeDependencies?: Set<string>;
    private readonly lastTypeDependencies = new Map<string, string[]>();
    // The asset dependencies the running build's processors register, and those of each module's last build that registered any
    private assetDependencies?: Set<string>;
    private readonly lastAssetDependencies = new Map<string, string[]>();

    constructor(
        options: Partial<CompilerOptions>,
        loaderOptions: Partial<WebpackLoaderOptions> = {},
        system: ts.System = ts.sys,
        { addons, dependencyCallback, debug, targetCompilerOptions = {}, createContext }: ModuleCompilerHost = {}
    ) {
        const reporter = new ConfigErrorReporter(options.reporter ?? new DefaultReporter(system));
        super({ ...options, reporter }, loaderOptions, system, addons, dependencyCallback);
        this.debugSink = debug;
        this.targetCompilerOptions = targetCompilerOptions;
        this.baseOptions = options;
        // Before createProfileContextsIfNecessary below, which creates the contexts through the factory
        this.contextFactory = createContext;

        // Option resolution reports an unconfigured profile, see isProfileConfigured
        this.profile = this.getOptions().profile || loaderOptions.profile || undefined;
        super.createProfileContextsIfNecessary();
        this.completeResolution();
    }

    /**
     * Returns the host's target compiler options for its profile, where no profile is the default context. A profile in
     * memory is compiled without `noEmit`, `emitDeclarationOnly` and `allowImportingTsExtensions`, and under `noEmit`
     * without `noEmitOnError`: tsc emits nothing under `noEmit`, so the option would only skip the in-memory emit on errors
     * the override causes, e.g. TS5097 of a `.ts` import.
     */
    protected getContextCompilerOptions(profile?: string): ts.CompilerOptions {
        const mode = this.getEmitMode(profile);
        return {
            ...(profile === this.profile ? this.targetCompilerOptions : {}),
            ...(mode !== "disk" && IN_MEMORY_OPTIONS),
            ...(mode === "memory" && { noEmitOnError: false }),
        };
    }

    /** Creates the host's context for its profile with the host's factory, where no profile is the default context. */
    protected instantiateCompilationContext(options: CompilationContextOptions, profile?: string): CompilationContext {
        const contextOptions = this.collectAssetDependencies(options);
        return profile === this.profile && this.contextFactory
            ? this.contextFactory(contextOptions)
            : super.instantiateCompilationContext(contextOptions, profile);
    }

    /**
     * Credits the asset dependencies that addons register during `build` to the module it builds: they travel with its
     * build result. The host's dependency callback belongs to the call that created this instance, so it only receives
     * those registered outside a build. Without a callback, the context registers them itself, e.g. for the watch of the
     * CLI and the Vite plugin.
     */
    private collectAssetDependencies(options: CompilationContextOptions): CompilationContextOptions {
        const hostCallback = options.registerDependencyCallback;
        if (!hostCallback) {
            return options;
        }
        return {
            ...options,
            registerDependencyCallback: (filePath: string) => (this.assetDependencies ? this.assetDependencies.add(filePath) : hostCallback(filePath)),
        };
    }

    /** Returns the profile whose output the host bundles. */
    public getProfile(): string | undefined {
        return this.profile;
    }

    /** Returns false if the host's profile is not configured, which option resolution reports as configuration error. */
    public isProfileConfigured(): boolean {
        return !this.profile || Object.hasOwn(this.getOptions().config?.profiles ?? {}, this.profile);
    }

    /**
     * Resolves the options and keeps their configuration errors for `getConfigErrors` instead of reporting them. Drops
     * the file-less errors of the builds with the previous options.
     */
    public setOptions(options: Partial<CompilerOptions>, loaderOptions?: Partial<WebpackLoaderOptions>): this {
        // Undefined while Compiler's constructor resolves the options
        this.fileLessErrors?.clear();
        this.emitModes?.clear();
        this.configErrorCarriers?.clear();
        this.configErrorCompilation = undefined;
        const reporter = this.getReporter();
        return reporter instanceof ConfigErrorReporter
            ? reporter.collect(() => super.setOptions(options, loaderOptions))
            : super.setOptions(options, loaderOptions);
    }

    /**
     * Returns the configuration errors of the last option resolution, of the selected profile and its dependencies,
     * then the errors of the `tsconfig.json`, e.g. an unknown option or invalid JSON, then the TypeScript errors without
     * a file that builds returned since, e.g. option errors such as TS5095. Those of a dependent profile are labelled
     * with the profile, unless the host's profile reports them too.
     */
    public getConfigErrors(): ts.Diagnostic[] {
        const reporter = this.getReporter();
        return [
            ...(reporter instanceof ConfigErrorReporter ? reporter.errors : []),
            ...this.getOptions().configErrors,
            ...this.fileLessErrors.values(),
        ];
    }

    /**
     * Returns the configuration errors that no other module received since the last option resolution, or since the
     * last change of `compilation`, for a host without compilation hooks to report on the module `resourcePath`. The
     * first module to receive an error carries it: it receives the error again on every build, since a host replaces
     * the errors of a rebuilt module. A host passes a token of its compilation, e.g. its start time, so that the first
     * module it builds in each compilation carries the errors again; without a token, the carrier stays until the next
     * option resolution.
     */
    public takeUnreportedConfigErrors(resourcePath: string, compilation?: unknown): ts.Diagnostic[] {
        if (compilation !== undefined && compilation !== this.configErrorCompilation) {
            this.configErrorCarriers.clear();
            this.configErrorCompilation = compilation;
        }
        const taken = new Set<string>();
        const result: ts.Diagnostic[] = [];
        for (const cur of this.getConfigErrors()) {
            const key = ModuleCompiler.getDiagnosticKey(cur);
            if (!this.configErrorCarriers.has(key)) {
                this.configErrorCarriers.set(key, resourcePath);
            }
            if (this.configErrorCarriers.get(key) === resourcePath && !taken.has(key)) {
                taken.add(key);
                result.push(cur);
            }
        }
        return result;
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
        this.profile = profileName || undefined;
        this.completeResolution();
    }

    /** Returns the files the options are resolved from: the config file, the tsconfig.json and the files it extends. */
    public getOptionsFiles(): Omit<ModuleBuildResult["dependencies"], "packageTypes"> {
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
     * host's profile, whose files the host bundles. The diagnostics are those of the host's profile, then those of the
     * dependent profiles, labelled with their profile; a diagnostic that several profiles report identically is
     * returned once, without a label if the host's profile reports it, else with the first dependent's. `moduleKind`
     * decides how the ESM check classifies the target's output under `runtime: "bundler"`; without it the check
     * classifies by package.json.
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
        const dependentDiagnostics: [string, ts.Diagnostic][] = [];
        const dependencies = { files: new Set<string>(), missing: new Set<string>() };
        const onDependency = (fileName: string, exists: boolean) => (exists ? dependencies.files : dependencies.missing).add(fileName);
        const packageTypes: Record<string, PackageType | null> = {};
        const onPackageType = (packageJson: string, type: PackageType | undefined) => (packageTypes[packageJson] = type ?? null);
        if (!this.isProfileConfigured()) {
            return {
                fragment: { version: 0, files: [], writtenFiles: [] },
                diagnostics: [],
                dependencies: { files: [], missing: [], packageTypes: {} },
            };
        }
        // The language service reads a file it never built again only when its version changes
        const lastTypeDependencies = this.lastTypeDependencies.get(filePath) ?? [];
        this.refreshUnbuiltFiles(lastTypeDependencies);
        this.typeDependencies = new Set();
        this.assetDependencies = new Set();
        // The nearest package.json's "type" decides the module format a profile emits under a node module kind (node16,
        // node18, node20, nodenext)
        if (this.hasNodeModuleProfile()) {
            createPackageTypeLookup(system, onDependency, this.compilationCaches.packageTypeCache, onPackageType)(filePath);
        }

        if (this.profile) {
            const selectedProfiles = this.getOptions().getSelectedProfiles(this.profile);
            this.logDebug(`Selected profiles: ${selectedProfiles.join(", ")}`);
            selectedProfiles
                .filter((profile: string) => profile !== this.profile)
                .forEach((profile: string) => {
                    // Transpile source file with other profiles (different from webpack target) and write the file
                    this.logDebug(`Emitting source file: ${filePath} with profile: ${profile}`);
                    const fragment = this.emitSourceFile(filePath, profile, true);
                    // Merged with the target's after its emit: the target's copy of a diagnostic wins
                    dependentDiagnostics.push(
                        ...this.takeFileLessErrors(fragment.diagnostics ?? [], filePath, profile).map((cur): [string, ts.Diagnostic] => [
                            profile,
                            cur,
                        ])
                    );
                    // Dependent profiles write files that another runtime loads: checked as written, by their own esm
                    diagnostics.push(...this.checkLoaderOutput(profile, filePath, fragment.writtenFiles, undefined, { onDependency, onPackageType }));

                    // TODO: We cannot apply the resultProcessors to the resulting fragment, because webpack has not written the file yet.
                    const ctx = this.getContext(profile);
                    if (ctx) {
                        ctx.getResultProcessors().forEach(cur => cur([filePath], ctx));
                    }
                });
        }

        // A host whose addons cannot be set up fails the build
        this.prepareAddons();

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
        const targetDiagnostics = this.takeFileLessErrors(result.diagnostics ?? [], filePath);
        // Deduplicated on the unlabelled key, so a host's message-based deduplication sees one copy per module
        const reported = new Set(targetDiagnostics.map(cur => ModuleCompiler.getDiagnosticKey(cur)));
        diagnostics.push(
            ...targetDiagnostics,
            ...dependentDiagnostics
                .filter(([, cur]) => {
                    const key = ModuleCompiler.getDiagnosticKey(cur);
                    return !reported.has(key) && !!reported.add(key);
                })
                .map(([profile, cur]) => labelWithProfile(cur, profile)),
            ...this.checkLoaderOutput(this.profile, filePath, result.files, moduleKind, { onDependency, onPackageType })
        );

        this.logDebug(`Emit result: ${result.files.length} files generated`);
        if (result.files.length > 0) {
            this.logDebug(`Write file: ${result.files[0].name}`);
        }

        const typeDependencies = [...this.typeDependencies];
        this.typeDependencies = undefined;
        typeDependencies.forEach(cur => dependencies.files.add(cur));
        // Records when the files were seen, so the next build of the module finds those modified since
        this.refreshUnbuiltFiles(typeDependencies);
        this.lastTypeDependencies.set(filePath, typeDependencies);
        // A build whose processors did not run again, e.g. of an unchanged module, keeps those of the last build
        const assetDependencies = this.assetDependencies.size > 0 ? [...this.assetDependencies] : (this.lastAssetDependencies.get(filePath) ?? []);
        this.assetDependencies = undefined;
        assetDependencies.forEach(cur => dependencies.files.add(cur));
        this.lastAssetDependencies.set(filePath, assetDependencies);

        this.logDebug(`Build completed for: ${resourcePath}`);
        return {
            fragment: result,
            diagnostics,
            dependencies: { files: [...dependencies.files], missing: [...dependencies.missing], packageTypes },
        };
    }

    /**
     * Runs the result processors of the host's profile once with `files`, e.g. the files the host wrote. Returns the
     * errors of processors that throw as error diagnostics; the processors after them still run.
     */
    public runResultProcessors(files: string[]): ts.Diagnostic[] {
        const ctx = this.getContext(this.profile);
        const diagnostics: ts.Diagnostic[] = [];
        ctx?.getResultProcessors().forEach(cur => {
            const addonName = ctx.findAddonName(cur);
            try {
                if (addonName) {
                    ctx.runAsAddon(addonName, () => cur(files, ctx));
                } else {
                    cur(files, ctx);
                }
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

    /**
     * Sets up the host's own addons before its addon step, after the dependent profiles emitted. `build` calls it on
     * every build, so an override must be idempotent, e.g. set up only once. A throw fails the build, unlike a throw of
     * `applyAddons`.
     */
    protected prepareAddons(): void {
        // Nothing to set up without a host
    }

    /** Collects the project files the type check of `fileName` read, while `build` runs. */
    protected onTypeCheckProgram(fileName: string, getProgram: () => ts.Program | undefined): void {
        const program = this.typeDependencies && getProgram();
        if (program) {
            // webpack compares native paths
            getTypeDependencies(program, fileName).forEach(cur => this.typeDependencies?.add(path.resolve(cur)));
        }
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

    /**
     * Emits `fileName` with `profile`. A profile in memory under `noEmit` writes nothing and yields only its JavaScript and
     * source maps, without TS5011, which tsc does not report under `noEmit`; under `emitDeclarationOnly` it writes only
     * its declarations, see selectWrittenFiles.
     */
    protected emitSourceFile(fileName: string, profile: string | undefined, writeFile: boolean): CompileFragment {
        if (this.getEmitMode(profile) !== "memory") {
            return super.emitSourceFile(fileName, profile, writeFile, true);
        }
        const fragment = super.emitSourceFile(fileName, profile, false, true);
        return {
            ...fragment,
            files: fragment.files.filter(cur => isJavaScriptOutput(cur.name)),
            ...(fragment.diagnostics && { diagnostics: fragment.diagnostics.filter(cur => cur.code !== ROOT_DIR_INFERENCE_ERROR) }),
        };
    }

    /** Writes only the declarations of a profile under `emitDeclarationOnly`, where tsc writes them. */
    protected selectWrittenFiles(files: ts.OutputFile[], profile?: string): ts.OutputFile[] {
        return this.getEmitMode(profile) === "memory-declarations" ? files.filter(cur => isDeclarationOutput(cur.name)) : files;
    }

    /** Returns the emit mode of `profile` from its resolved options, once per option resolution. */
    private getEmitMode(profile?: string): EmitMode {
        // Undefined while Compiler's constructor resolves the options
        const cached = this.emitModes?.get(profile);
        if (cached) {
            return cached;
        }
        const { noEmit, emitDeclarationOnly } = this.getOptions().getOptions(profile).tsConfig ?? {};
        const result: EmitMode = noEmit ? "memory" : emitDeclarationOnly ? "memory-declarations" : "disk";
        this.emitModes?.set(profile, result);
        return result;
    }

    /** Raises the cached version of each of `fileNames` that no profile built and that changed since it was last seen. */
    private refreshUnbuiltFiles(fileNames: string[]): void {
        if (fileNames.length > 0) {
            const profiles = this.profile ? this.getOptions().getSelectedProfiles(this.profile) : [this.profile];
            profiles.forEach(profile => {
                const cache = this.getContext(profile)?.getCache();
                fileNames.forEach(cur => cache?.refreshUnbuilt(cur));
            });
        }
    }

    /**
     * True when the host's profile or one of its dependent profiles emits with a node module kind (node16, node18, node20,
     * nodenext).
     */
    private hasNodeModuleProfile(): boolean {
        const profiles = this.profile ? this.getOptions().getSelectedProfiles(this.profile) : [this.profile];
        return profiles.some(profile => isNodeModuleKind(this.getContext(profile)?.getCompilerOptions().module));
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
        callbacks: Pick<EsmCheckContext, "onDependency" | "onPackageType">
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
                ...callbacks,
                importRules: esm.runtime === "node" ? NODE_IMPORT_RULES : [],
                ...(esm.runtime === "bundler" && moduleKind && { moduleKind }),
            });
        } finally {
            this.esmCheckTime += performance.now() - start;
        }
    }

    /**
     * Keeps the TypeScript errors without a file of `diagnostics` as configuration errors and returns the others: every
     * module of the fast path returns the same option errors, so N modules give one configuration error, not N. An
     * error that names the module's own file `filePath` in quotes, as TypeScript names paths, e.g. TS6059 for a file
     * outside `rootDir`, stays on the module and lives as long as it, like an error with a file; for a dependent profile
     * `dependentProfile` the caller labels it. The other errors of a dependent profile are kept labelled with it, unless
     * the host's profile already keeps the same error, whose unlabelled copy replaces a dependent's. websmith's own
     * diagnostics without a file (code 0) and warnings stay on the module.
     */
    private takeFileLessErrors(diagnostics: readonly ts.Diagnostic[], filePath: string, dependentProfile?: string): ts.Diagnostic[] {
        const ownPath = `'${filePath.replace(/\\/g, "/")}'`;
        return diagnostics.filter(cur => {
            if (!cur.file && cur.code > 0 && cur.category === ts.DiagnosticCategory.Error) {
                if (ts.flattenDiagnosticMessageText(cur.messageText, "\n").replace(/\\/g, "/").includes(ownPath)) {
                    return true;
                }
                const key = ModuleCompiler.getDiagnosticKey(cur);
                if (!dependentProfile) {
                    this.fileLessErrors.set(key, cur);
                } else if (!this.fileLessErrors.has(key)) {
                    this.fileLessErrors.set(key, labelWithProfile(cur, dependentProfile));
                }
                return false;
            }
            return true;
        });
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

    private static getDiagnosticKey({ file, start, code, messageText }: ts.Diagnostic): string {
        return [file?.fileName, start, code, ts.flattenDiagnosticMessageText(messageText, "\n")].join("\0");
    }

    private static createCompilationCaches(): Pick<EsmCheckContext, "packageTypeCache" | "cjsNamesCache"> {
        return { packageTypeCache: new Map(), cjsNamesCache: createCjsNamesCache() };
    }
}
