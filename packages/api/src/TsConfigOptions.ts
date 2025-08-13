/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */

/**
 * Comprehensive type definition for all tsconfig.json options.
 * This includes all top-level properties and nested configuration sections.
 */
export interface TsConfigOptions {
    /**
     * TypeScript compiler options
     */
    compilerOptions?: TsConfigCompilerOptions;

    /**
     * Specifies a list of files to be included in the compilation.
     * When present, only these files (and those referenced by them) are included.
     */
    files?: string[];

    /**
     * Specifies an array of filenames or patterns to include in the program.
     * These filenames are resolved relative to the directory containing the tsconfig.json file.
     */
    include?: string[];

    /**
     * Specifies an array of filenames or patterns that should be skipped when resolving include.
     */
    exclude?: string[];

    /**
     * Path to a base configuration file to inherit from.
     * The configuration from the base file are loaded first, then overridden by those in the inheriting config file.
     */
    extends?: string | string[];

    /**
     * Project references are a way to structure your TypeScript programs into smaller pieces.
     */
    references?: ProjectReference[];

    /**
     * Settings for TypeScript's type acquisition in JavaScript projects.
     */
    typeAcquisition?: TypeAcquisitionOptions;

    /**
     * Settings for the file watching algorithm.
     */
    watchOptions?: WatchOptions;

    /**
     * Build options for TypeScript project references.
     */
    buildOptions?: BuildOptions;

    /**
     * Enable Compile-on-Save for this project.
     */
    compileOnSave?: boolean;

    /**
     * ts-node specific configuration options.
     */
    "ts-node"?: TsNodeOptions;
}

/**
 * TypeScript compiler options as they appear in tsconfig.json files.
 * This uses string literal types for values instead of TypeScript's internal enum values.
 */
export interface TsConfigCompilerOptions {
    // Basic Options
    /**
     * Specify ECMAScript target version.
     */
    target?:
        | "ES3"
        | "ES5"
        | "ES6"
        | "ES2015"
        | "ES2016"
        | "ES2017"
        | "ES2018"
        | "ES2019"
        | "ES2020"
        | "ES2021"
        | "ES2022"
        | "ES2023"
        | "ES2024"
        | "ESNext";

    /**
     * Specify module code generation.
     */
    module?: "None" | "CommonJS" | "AMD" | "UMD" | "System" | "ES6" | "ES2015" | "ES2020" | "ES2022" | "ESNext" | "Node16" | "NodeNext";

    /**
     * Specify library files to be included in the compilation.
     */
    lib?: string[];

    /**
     * Allow JavaScript files to be compiled.
     */
    allowJs?: boolean;

    /**
     * Report errors in .js files.
     */
    checkJs?: boolean;

    /**
     * Specify JSX code generation.
     */
    jsx?: "preserve" | "react" | "react-jsx" | "react-jsxdev" | "react-native";

    /**
     * Generates corresponding .d.ts file.
     */
    declaration?: boolean;

    /**
     * Generates a sourcemap for each corresponding .d.ts file.
     */
    declarationMap?: boolean;

    /**
     * Generate .map files.
     */
    sourceMap?: boolean;

    /**
     * Concatenate and emit output to single file.
     */
    outFile?: string;

    /**
     * Redirect output structure to the directory.
     */
    outDir?: string;

    /**
     * Specify the root directory of input files.
     */
    rootDir?: string;

    /**
     * Enable project compilation.
     */
    composite?: boolean;

    /**
     * Specify file to store incremental compilation information.
     */
    tsBuildInfoFile?: string;

    /**
     * Do not emit comments to output.
     */
    removeComments?: boolean;

    /**
     * Do not emit outputs.
     */
    noEmit?: boolean;

    /**
     * Import emit helpers from 'tslib'.
     */
    importHelpers?: boolean;

    /**
     * Provide full support for iterables in 'for-of', spread, and destructuring when targeting 'ES5' or 'ES3'.
     */
    downlevelIteration?: boolean;

    /**
     * Transpile each file as a separate module.
     */
    isolatedModules?: boolean;

    // Strict Type-Checking Options
    /**
     * Enable all strict type-checking options.
     */
    strict?: boolean;

    /**
     * Raise error on expressions and declarations with an implied 'any' type.
     */
    noImplicitAny?: boolean;

    /**
     * Enable strict null checks.
     */
    strictNullChecks?: boolean;

    /**
     * Enable strict checking of function types.
     */
    strictFunctionTypes?: boolean;

    /**
     * Enable strict checking of property initialization in classes.
     */
    strictPropertyInitialization?: boolean;

    /**
     * Enable strict 'bind', 'call', and 'apply' methods on functions.
     */
    strictBindCallApply?: boolean;

    /**
     * Raise error on 'this' expressions with an implied 'any' type.
     */
    noImplicitThis?: boolean;

    /**
     * Parse in strict mode and emit "use strict" for each source file.
     */
    alwaysStrict?: boolean;

    /**
     * Report errors on unused locals.
     */
    noUnusedLocals?: boolean;

    /**
     * Report errors on unused parameters.
     */
    noUnusedParameters?: boolean;

    /**
     * Report error when not all code paths in function return a value.
     */
    noImplicitReturns?: boolean;

    /**
     * Report errors for fallthrough cases in switch statement.
     */
    noFallthroughCasesInSwitch?: boolean;

    /**
     * Include 'undefined' in index signature results.
     */
    noUncheckedIndexedAccess?: boolean;

    /**
     * Ensure optional property types are interpreted exactly as written.
     */
    exactOptionalPropertyTypes?: boolean;

    /**
     * Ensure overriding members in derived classes are marked with an 'override' modifier.
     */
    noImplicitOverride?: boolean;

    // Module Resolution Options
    /**
     * Specify module resolution strategy.
     */
    moduleResolution?: "node" | "classic" | "node16" | "nodenext" | "bundler";

    /**
     * Base directory to resolve non-absolute module names.
     */
    baseUrl?: string;

    /**
     * A series of entries which re-map imports to lookup locations relative to the 'baseUrl'.
     */
    paths?: Record<string, string[]>;

    /**
     * List of root folders whose combined content represents the structure of the project at runtime.
     */
    rootDirs?: string[];

    /**
     * List of folders to include type definitions from.
     */
    typeRoots?: string[];

    /**
     * Type declaration files to be included in compilation.
     */
    types?: string[];

    /**
     * Allow default imports from modules with no default export.
     */
    allowSyntheticDefaultImports?: boolean;

    /**
     * Enables emit interoperability between CommonJS and ES Modules.
     */
    esModuleInterop?: boolean;

    /**
     * Don't resolve symlinks to their real path; treat symlinks like real files.
     */
    preserveSymlinks?: boolean;

    /**
     * Allow accessing UMD globals from modules.
     */
    allowUmdGlobalAccess?: boolean;

    /**
     * Include modules imported with '.json' extension.
     */
    resolveJsonModule?: boolean;

    // Source Map Options
    /**
     * Specify the location where debugger should locate TypeScript files instead of source locations.
     */
    sourceRoot?: string;

    /**
     * Specify the location where debugger should locate map files instead of generated locations.
     */
    mapRoot?: string;

    /**
     * Emit a single file with source maps instead of having a separate file.
     */
    inlineSourceMap?: boolean;

    /**
     * Emit the source alongside the sourcemaps within a single file.
     */
    inlineSources?: boolean;

    // Experimental Options
    /**
     * Enables experimental support for ES7 decorators.
     */
    experimentalDecorators?: boolean;

    /**
     * Enables experimental support for emitting type metadata for decorators.
     */
    emitDecoratorMetadata?: boolean;

    /**
     * Emit class fields with Define instead of Set.
     */
    useDefineForClassFields?: boolean;

    // Advanced Options
    /**
     * Skip type checking of declaration files.
     */
    skipLibCheck?: boolean;

    /**
     * Skip the default library checking.
     */
    skipDefaultLibCheck?: boolean;

    /**
     * Disallow inconsistently-cased references to the same file.
     */
    forceConsistentCasingInFileNames?: boolean;

    /**
     * Suppress excess property checks for object literals.
     */
    suppressExcessPropertyErrors?: boolean;

    /**
     * Suppress noImplicitAny errors for indexing objects lacking index signatures.
     */
    suppressImplicitAnyIndexErrors?: boolean;

    /**
     * Disable strict checking of generic signatures in function types.
     */
    noStrictGenericChecks?: boolean;

    /**
     * Don't add 'use strict' directive in emitted files.
     */
    noImplicitUseStrict?: boolean;

    /**
     * Report errors on unreachable code.
     */
    allowUnreachableCode?: boolean;

    /**
     * Report errors on unused labels.
     */
    allowUnusedLabels?: boolean;

    /**
     * Require undeclared properties from index signatures to use element accesses.
     */
    noPropertyAccessFromIndexSignature?: boolean;

    /**
     * Disable truncating types in error messages.
     */
    noErrorTruncation?: boolean;

    /**
     * Do not erase const enum declarations in generated code.
     */
    preserveConstEnums?: boolean;

    /**
     * Output directory for generated declaration files.
     */
    declarationDir?: string;

    /**
     * Disable size limitations on JavaScript projects.
     */
    disableSizeLimit?: boolean;

    /**
     * Disable preferring source files instead of declaration files when referencing composite projects.
     */
    disableSourceOfProjectReferenceRedirect?: boolean;

    /**
     * Disable solution searching for this project.
     */
    disableSolutionSearching?: boolean;

    /**
     * Disable loading referenced projects.
     */
    disableReferencedProjectLoad?: boolean;

    /**
     * Remove the 20mb cap on total source code size for JavaScript files in the TypeScript language server.
     */
    maxNodeModuleJsDepth?: number;

    /**
     * Specify the end of line sequence to be used when emitting files.
     */
    newLine?: "crlf" | "lf";

    /**
     * Do not emit helpers.
     */
    noEmitHelpers?: boolean;

    /**
     * Do not emit outputs if any errors were reported.
     */
    noEmitOnError?: boolean;

    /**
     * Disable wiping the console in watch mode.
     */
    preserveWatchOutput?: boolean;

    /**
     * Enable color and formatting in TypeScript's output.
     */
    pretty?: boolean;

    /**
     * Enable tracing of the name resolution process.
     */
    traceResolution?: boolean;

    /**
     * Print names of files part of the compilation.
     */
    listFiles?: boolean;

    /**
     * Print names of generated files part of the compilation.
     */
    listEmittedFiles?: boolean;

    /**
     * Emit a v8 CPU profile of the compiler run for debugging.
     */
    generateCpuProfile?: string;

    /**
     * Emit a UTF-8 Byte Order Mark (BOM) in the beginning of output files.
     */
    emitBOM?: boolean;

    /**
     * Enable incremental compilation.
     */
    incremental?: boolean;

    /**
     * Have recompiles in projects that use incremental and watch mode assume that changes within a file will only affect files directly depending on it.
     */
    assumeChangesOnlyAffectDirectDependencies?: boolean;

    /**
     * The character set of the input files.
     */
    charset?: string;

    /**
     * When type checking, take into account 'null' and 'undefined'.
     */
    keyofStringsOnly?: boolean;

    /**
     * Default catch clause variables as 'unknown' instead of 'any'.
     */
    useUnknownInCatchVariables?: boolean;

    /**
     * Preserve unused imported values in the JavaScript output that would otherwise be removed.
     */
    preserveValueImports?: boolean;

    /**
     * Control what method is used to detect file changes in watch mode.
     */
    watchFile?: WatchFileKind;

    /**
     * Control how directories are watched on systems that lack recursive file-watching functionality.
     */
    watchDirectory?: WatchDirectoryKind;

    /**
     * Synchronously call callbacks and update the state of directory watchers on platforms that don`t support recursive watching natively.
     */
    synchronousWatchDirectory?: boolean;

    /**
     * When using file system events, this option specifies the polling strategy that gets used when the system runs out of native file watchers and/or doesn't support native file watchers.
     */
    fallbackPolling?: PollingWatchKind;

    /**
     * Remove a list of directories from the watch process.
     */
    excludeDirectories?: string[];

    /**
     * Remove a list of files from the watch process.
     */
    excludeFiles?: string[];

    // JSX Options
    /**
     * Specify the object invoked for createElement.
     */
    jsxFactory?: string;

    /**
     * Specify the JSX fragment factory function to use when targeting react JSX emit with jsxFactory compiler option is specified.
     */
    jsxFragmentFactory?: string;

    /**
     * Specify the module specifier to be used to import the jsx and jsxs factory functions from.
     */
    jsxImportSource?: string;

    /**
     * List of names of plugins to load.
     */
    plugins?: PluginConfig[];

    /**
     * Only output d.ts files and not JavaScript files.
     */
    emitDeclarationOnly?: boolean;

    /**
     * Remove the internal stripping in the TypeScript compiler.
     */
    stripInternal?: boolean;

    /**
     * Conditions to set in addition to the resolver-specific defaults when resolving imports.
     */
    customConditions?: string[];

    /**
     * Allow imports to include TypeScript file extensions.
     */
    allowImportingTsExtensions?: boolean;

    /**
     * Use the package.json 'exports' field when resolving package imports.
     */
    resolvePackageJsonExports?: boolean;

    /**
     * Use the package.json 'imports' field when resolving imports.
     */
    resolvePackageJsonImports?: boolean;

    /**
     * Allow multiple folders to be treated as one when resolving modules.
     */
    allowArbitraryExtensions?: boolean;

    /**
     * Emit more compliant, but verbose and less performant JavaScript for iteration.
     */
    verbatimModuleSyntax?: boolean;

    /**
     * Control what method is used to include reusable functionality in emitted JavaScript.
     */
    importsNotUsedAsValues?: "remove" | "preserve" | "error";
}

/**
 * Alias for backward compatibility
 * @deprecated Use TsConfigCompilerOptions instead
 */
export type CompilerOptionsExtended = TsConfigCompilerOptions;

/**
 * Project reference configuration.
 */
export interface ProjectReference {
    /**
     * Path to the referenced project's tsconfig.json or to a folder containing one.
     */
    path: string;

    /**
     * True if the reference should be prepended to the output of this project.
     */
    prepend?: boolean;

    /**
     * True if it is intended that this reference form a circular reference.
     */
    circular?: boolean;
}

/**
 * Type acquisition options for JavaScript projects.
 */
export interface TypeAcquisitionOptions {
    /**
     * Enable type acquisition for this project.
     */
    enable?: boolean;

    /**
     * Specifies a list of type declarations to be included in type acquisition.
     */
    include?: string[];

    /**
     * Specifies a list of type declarations to be excluded from type acquisition.
     */
    exclude?: string[];

    /**
     * Disables the type acquisition for files with the name that would suggest a type.
     */
    disableFilenameBasedTypeAcquisition?: boolean;
}

/**
 * Watch options for file system watching.
 */
export interface WatchOptions {
    /**
     * Strategy for how individual files are watched.
     */
    watchFile?: WatchFileKind;

    /**
     * Strategy for how entire directory trees are watched under systems that lack recursive file-watching functionality.
     */
    watchDirectory?: WatchDirectoryKind;

    /**
     * When using file system events, this option specifies the polling strategy that gets used when the system runs out of native file watchers and/or doesn't support native file watchers.
     */
    fallbackPolling?: PollingWatchKind;

    /**
     * Synchronously call callbacks and update the state of directory watchers on platforms that don`t support recursive watching natively.
     */
    synchronousWatchDirectory?: boolean;

    /**
     * Remove a list of directories from the watch process.
     */
    excludeDirectories?: string[];

    /**
     * Remove a list of files from the watch process.
     */
    excludeFiles?: string[];
}

/**
 * Build options for TypeScript project references.
 */
export interface BuildOptions {
    /**
     * Build without emitting files.
     */
    dry?: boolean;

    /**
     * Build all projects, including those that appear to be up to date.
     */
    force?: boolean;

    /**
     * Enable verbose logging.
     */
    verbose?: boolean;

    /**
     * Disable truncating types in error messages.
     */
    preserveWatchOutput?: boolean;

    /**
     * Print names of files that are part of the compilation and then stop processing.
     */
    listFiles?: boolean;

    /**
     * Print names of generated files part of the compilation.
     */
    listEmittedFiles?: boolean;

    /**
     * Have recompiles in '--incremental' and '--watch' assume that changes within a file will only affect files directly depending on it.
     */
    assumeChangesOnlyAffectDirectDependencies?: boolean;
}

/**
 * ts-node specific configuration options.
 */
export interface TsNodeOptions {
    /**
     * TypeScript compiler name or absolute path.
     */
    compiler?: string;

    /**
     * Use TypeScript's compiler host API instead of the language service API.
     */
    compilerHost?: boolean;

    /**
     * JSON object to merge with TypeScript `compilerOptions`.
     */
    compilerOptions?: TsConfigCompilerOptions;

    /**
     * Use TypeScript's `transpileModule` which is faster but does not perform type checking.
     */
    transpileOnly?: boolean;

    /**
     * Enable experimental ESM loader.
     */
    experimentalEsmLoader?: boolean;

    /**
     * Load files from `tsconfig.json` on startup.
     */
    files?: boolean;

    /**
     * Specify a list of TypeScript diagnostic codes to ignore.
     */
    ignoreDiagnostics?: (number | string)[];

    /**
     * Logs TypeScript errors to stderr instead of throwing exceptions.
     */
    logError?: boolean;

    /**
     * Prefer TypeScript extensions over JavaScript extensions.
     */
    preferTsExts?: boolean;

    /**
     * Use pretty diagnostic formatter.
     */
    pretty?: boolean;

    /**
     * Modules to require, like node's `-r` option.
     */
    require?: string[];

    /**
     * Skip ignore check, so that compilation will be attempted for all files with matching extensions.
     */
    skipIgnore?: boolean;

    /**
     * Skip project config resolution and loading.
     */
    skipProject?: boolean;

    /**
     * Enable type checking.
     */
    typeCheck?: boolean;

    /**
     * Emit output files to stdout.
     */
    emit?: boolean;
}

/**
 * Plugin configuration for TypeScript compiler plugins.
 */
export interface PluginConfig {
    /**
     * Plugin name.
     */
    name: string;

    /**
     * Plugin configuration options.
     */
    [option: string]: unknown;
}

/**
 * Enum for watch file strategies.
 */
export enum WatchFileKind {
    FixedPollingInterval = "fixedPollingInterval",
    PriorityPollingInterval = "priorityPollingInterval",
    DynamicPriorityPolling = "dynamicPriorityPolling",
    FixedChunkSizePolling = "fixedChunkSizePolling",
    UseFsEvents = "useFsEvents",
    UseFsEventsOnParentDirectory = "useFsEventsOnParentDirectory",
}

/**
 * Enum for watch directory strategies.
 */
export enum WatchDirectoryKind {
    UseFsEvents = "useFsEvents",
    FixedPollingInterval = "fixedPollingInterval",
    DynamicPriorityPolling = "dynamicPriorityPolling",
    FixedChunkSizePolling = "fixedChunkSizePolling",
}

/**
 * Enum for polling watch strategies.
 */
export enum PollingWatchKind {
    FixedInterval = "fixedInterval",
    PriorityInterval = "priorityInterval",
    DynamicPriority = "dynamicPriority",
    FixedChunkSize = "fixedChunkSize",
}

/**
 * Union type of all possible tsconfig.json option keys.
 */
// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
export type TsConfigOptionKey = keyof TsConfigOptions | keyof TsConfigCompilerOptions;

/**
 * Helper type to extract all compiler option keys.
 */
export type CompilerOptionKey = keyof TsConfigCompilerOptions;

/**
 * Helper type to extract all top-level tsconfig.json keys.
 */
export type TsConfigTopLevelKey = keyof TsConfigOptions;
