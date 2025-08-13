/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */

/**
 * Comprehensive collection of all TypeScript Compiler (tsc) CLI flags.
 * Based on TypeScript 5.7.3 official documentation.
 *
 * This file provides type-safe access to all available tsc command-line options,
 * organized by their functional categories as defined in the TypeScript documentation.
 */

/**
 * Command-line options for TypeScript compiler execution control.
 */
export const TSC_COMMAND_LINE_FLAGS = {
    // Basic command options
    all: "--all",
    build: "--build",
    help: "--help",
    init: "--init",
    listFilesOnly: "--listFilesOnly",
    locale: "--locale",
    project: "--project",
    showConfig: "--showConfig",
    version: "--version",
    watch: "--watch",

    // Short aliases
    b: "-b",
    h: "-h",
    p: "-p",
    v: "-v",
    w: "-w",
} as const;

/**
 * Module-related compiler options.
 */
export const TSC_MODULE_FLAGS = {
    allowArbitraryExtensions: "--allowArbitraryExtensions",
    allowImportingTsExtensions: "--allowImportingTsExtensions",
    allowUmdGlobalAccess: "--allowUmdGlobalAccess",
    baseUrl: "--baseUrl",
    customConditions: "--customConditions",
    module: "--module",
    moduleResolution: "--moduleResolution",
    moduleSuffixes: "--moduleSuffixes",
    noResolve: "--noResolve",
    noUncheckedSideEffectImports: "--noUncheckedSideEffectImports",
    paths: "--paths",
    resolveJsonModule: "--resolveJsonModule",
    resolvePackageJsonExports: "--resolvePackageJsonExports",
    resolvePackageJsonImports: "--resolvePackageJsonImports",
    rewriteRelativeImportExtensions: "--rewriteRelativeImportExtensions",
    rootDir: "--rootDir",
    rootDirs: "--rootDirs",
    typeRoots: "--typeRoots",
    types: "--types",

    // Short aliases
    m: "-m",
} as const;

/**
 * JavaScript support options.
 */
export const TSC_JAVASCRIPT_FLAGS = {
    allowJs: "--allowJs",
    checkJs: "--checkJs",
    maxNodeModuleJsDepth: "--maxNodeModuleJsDepth",
} as const;

/**
 * Interoperability constraint options.
 */
export const TSC_INTEROP_FLAGS = {
    allowSyntheticDefaultImports: "--allowSyntheticDefaultImports",
    esModuleInterop: "--esModuleInterop",
    forceConsistentCasingInFileNames: "--forceConsistentCasingInFileNames",
    isolatedDeclarations: "--isolatedDeclarations",
    isolatedModules: "--isolatedModules",
    preserveSymlinks: "--preserveSymlinks",
    verbatimModuleSyntax: "--verbatimModuleSyntax",
} as const;

/**
 * Type checking options.
 */
export const TSC_TYPE_CHECKING_FLAGS = {
    allowUnreachableCode: "--allowUnreachableCode",
    allowUnusedLabels: "--allowUnusedLabels",
    alwaysStrict: "--alwaysStrict",
    exactOptionalPropertyTypes: "--exactOptionalPropertyTypes",
    noFallthroughCasesInSwitch: "--noFallthroughCasesInSwitch",
    noImplicitAny: "--noImplicitAny",
    noImplicitOverride: "--noImplicitOverride",
    noImplicitReturns: "--noImplicitReturns",
    noImplicitThis: "--noImplicitThis",
    noPropertyAccessFromIndexSignature: "--noPropertyAccessFromIndexSignature",
    noUncheckedIndexedAccess: "--noUncheckedIndexedAccess",
    noUnusedLocals: "--noUnusedLocals",
    noUnusedParameters: "--noUnusedParameters",
    strict: "--strict",
    strictBindCallApply: "--strictBindCallApply",
    strictBuiltinIteratorReturn: "--strictBuiltinIteratorReturn",
    strictFunctionTypes: "--strictFunctionTypes",
    strictNullChecks: "--strictNullChecks",
    strictPropertyInitialization: "--strictPropertyInitialization",
    useUnknownInCatchVariables: "--useUnknownInCatchVariables",
} as const;

/**
 * Watch and build mode options.
 */
export const TSC_WATCH_BUILD_FLAGS = {
    assumeChangesOnlyAffectDirectDependencies: "--assumeChangesOnlyAffectDirectDependencies",
} as const;

/**
 * Backwards compatibility options.
 */
export const TSC_BACKWARDS_COMPATIBILITY_FLAGS = {
    charset: "--charset",
    importsNotUsedAsValues: "--importsNotUsedAsValues",
    keyofStringsOnly: "--keyofStringsOnly",
    noImplicitUseStrict: "--noImplicitUseStrict",
    noStrictGenericChecks: "--noStrictGenericChecks",
    out: "--out",
    preserveValueImports: "--preserveValueImports",
    suppressExcessPropertyErrors: "--suppressExcessPropertyErrors",
    suppressImplicitAnyIndexErrors: "--suppressImplicitAnyIndexErrors",
} as const;

/**
 * Project reference options.
 */
export const TSC_PROJECT_FLAGS = {
    composite: "--composite",
    disableReferencedProjectLoad: "--disableReferencedProjectLoad",
    disableSolutionSearching: "--disableSolutionSearching",
    disableSourceOfProjectReferenceRedirect: "--disableSourceOfProjectReferenceRedirect",
    incremental: "--incremental",
    tsBuildInfoFile: "--tsBuildInfoFile",

    // Short aliases
    i: "-i",
} as const;

/**
 * Emit options.
 */
export const TSC_EMIT_FLAGS = {
    declaration: "--declaration",
    declarationDir: "--declarationDir",
    declarationMap: "--declarationMap",
    downlevelIteration: "--downlevelIteration",
    emitBOM: "--emitBOM",
    emitDeclarationOnly: "--emitDeclarationOnly",
    importHelpers: "--importHelpers",
    inlineSourceMap: "--inlineSourceMap",
    inlineSources: "--inlineSources",
    mapRoot: "--mapRoot",
    newLine: "--newLine",
    noEmit: "--noEmit",
    noEmitHelpers: "--noEmitHelpers",
    noEmitOnError: "--noEmitOnError",
    outDir: "--outDir",
    outFile: "--outFile",
    preserveConstEnums: "--preserveConstEnums",
    removeComments: "--removeComments",
    sourceMap: "--sourceMap",
    sourceRoot: "--sourceRoot",
    stripInternal: "--stripInternal",

    // Short aliases
    d: "-d",
} as const;

/**
 * Compiler diagnostic options.
 */
export const TSC_DIAGNOSTIC_FLAGS = {
    diagnostics: "--diagnostics",
    explainFiles: "--explainFiles",
    extendedDiagnostics: "--extendedDiagnostics",
    generateCpuProfile: "--generateCpuProfile",
    generateTrace: "--generateTrace",
    listEmittedFiles: "--listEmittedFiles",
    listFiles: "--listFiles",
    noCheck: "--noCheck",
    traceResolution: "--traceResolution",
} as const;

/**
 * Editor support options.
 */
export const TSC_EDITOR_FLAGS = {
    disableSizeLimit: "--disableSizeLimit",
    plugins: "--plugins",
} as const;

/**
 * Language and environment options.
 */
export const TSC_LANGUAGE_FLAGS = {
    emitDecoratorMetadata: "--emitDecoratorMetadata",
    experimentalDecorators: "--experimentalDecorators",
    jsx: "--jsx",
    jsxFactory: "--jsxFactory",
    jsxFragmentFactory: "--jsxFragmentFactory",
    jsxImportSource: "--jsxImportSource",
    lib: "--lib",
    moduleDetection: "--moduleDetection",
    noLib: "--noLib",
    reactNamespace: "--reactNamespace",
    target: "--target",
    useDefineForClassFields: "--useDefineForClassFields",

    // Short aliases
    t: "-t",
} as const;

/**
 * Output formatting options.
 */
export const TSC_OUTPUT_FLAGS = {
    noErrorTruncation: "--noErrorTruncation",
    preserveWatchOutput: "--preserveWatchOutput",
    pretty: "--pretty",
} as const;

/**
 * Completeness options.
 */
export const TSC_COMPLETENESS_FLAGS = {
    skipDefaultLibCheck: "--skipDefaultLibCheck",
    skipLibCheck: "--skipLibCheck",
} as const;

/**
 * Watch-specific options.
 */
export const TSC_WATCH_FLAGS = {
    watchFile: "--watchFile",
    watchDirectory: "--watchDirectory",
    fallbackPolling: "--fallbackPolling",
    synchronousWatchDirectory: "--synchronousWatchDirectory",
    excludeDirectories: "--excludeDirectories",
    excludeFiles: "--excludeFiles",
} as const;

/**
 * Build-specific options.
 */
export const TSC_BUILD_FLAGS = {
    verbose: "--verbose",
    dry: "--dry",
    force: "--force",
    clean: "--clean",
    stopBuildOnErrors: "--stopBuildOnErrors",

    // Short aliases for build mode
    buildVerbose: "-v",
    buildDry: "-d",
    buildForce: "-f",
} as const;

/**
 * All TypeScript compiler CLI flags organized by category.
 */
export const TSC_ALL_FLAGS = {
    ...TSC_COMMAND_LINE_FLAGS,
    ...TSC_MODULE_FLAGS,
    ...TSC_JAVASCRIPT_FLAGS,
    ...TSC_INTEROP_FLAGS,
    ...TSC_TYPE_CHECKING_FLAGS,
    ...TSC_WATCH_BUILD_FLAGS,
    ...TSC_BACKWARDS_COMPATIBILITY_FLAGS,
    ...TSC_PROJECT_FLAGS,
    ...TSC_EMIT_FLAGS,
    ...TSC_DIAGNOSTIC_FLAGS,
    ...TSC_EDITOR_FLAGS,
    ...TSC_LANGUAGE_FLAGS,
    ...TSC_OUTPUT_FLAGS,
    ...TSC_COMPLETENESS_FLAGS,
    ...TSC_WATCH_FLAGS,
    ...TSC_BUILD_FLAGS,
} as const;

/**
 * Array of all TypeScript compiler CLI flag values.
 */
export const TSC_FLAG_VALUES = Object.values(TSC_ALL_FLAGS);

/**
 * Array of all TypeScript compiler CLI flag keys.
 */
export const TSC_FLAG_KEYS = Object.keys(TSC_ALL_FLAGS) as (keyof typeof TSC_ALL_FLAGS)[];

/**
 * Type representing all possible TypeScript compiler CLI flags.
 */
export type TscFlag = (typeof TSC_ALL_FLAGS)[keyof typeof TSC_ALL_FLAGS];

/**
 * Type representing all possible TypeScript compiler CLI flag keys.
 */
export type TscFlagKey = keyof typeof TSC_ALL_FLAGS;

/**
 * Interface for TypeScript compiler CLI arguments that can be passed via command line.
 * This represents the complete set of available options that can be used
 * when invoking the TypeScript compiler from the command line.
 */
export interface TscCliArguments {
    // Command-line options
    all?: boolean;
    build?: boolean;
    help?: boolean;
    init?: boolean;
    listFilesOnly?: boolean;
    locale?: string;
    project?: string;
    showConfig?: boolean;
    version?: boolean;
    watch?: boolean;

    // Module options
    allowArbitraryExtensions?: boolean;
    allowImportingTsExtensions?: boolean;
    allowUmdGlobalAccess?: boolean;
    baseUrl?: string;
    customConditions?: string[];
    module?: "none" | "commonjs" | "amd" | "umd" | "system" | "es6" | "es2015" | "es2020" | "es2022" | "esnext" | "node16" | "nodenext" | "preserve";
    moduleResolution?: "classic" | "node10" | "node16" | "nodenext" | "bundler" | "node";
    moduleSuffixes?: string[];
    noResolve?: boolean;
    noUncheckedSideEffectImports?: boolean;
    paths?: Record<string, string[]>;
    resolveJsonModule?: boolean;
    resolvePackageJsonExports?: boolean;
    resolvePackageJsonImports?: boolean;
    rewriteRelativeImportExtensions?: boolean;
    rootDir?: string;
    rootDirs?: string[];
    typeRoots?: string[];
    types?: string[];

    // JavaScript support
    allowJs?: boolean;
    checkJs?: boolean;
    maxNodeModuleJsDepth?: number;

    // Interop constraints
    allowSyntheticDefaultImports?: boolean;
    esModuleInterop?: boolean;
    forceConsistentCasingInFileNames?: boolean;
    isolatedDeclarations?: boolean;
    isolatedModules?: boolean;
    preserveSymlinks?: boolean;
    verbatimModuleSyntax?: boolean;

    // Type checking
    allowUnreachableCode?: boolean;
    allowUnusedLabels?: boolean;
    alwaysStrict?: boolean;
    exactOptionalPropertyTypes?: boolean;
    noFallthroughCasesInSwitch?: boolean;
    noImplicitAny?: boolean;
    noImplicitOverride?: boolean;
    noImplicitReturns?: boolean;
    noImplicitThis?: boolean;
    noPropertyAccessFromIndexSignature?: boolean;
    noUncheckedIndexedAccess?: boolean;
    noUnusedLocals?: boolean;
    noUnusedParameters?: boolean;
    strict?: boolean;
    strictBindCallApply?: boolean;
    strictBuiltinIteratorReturn?: boolean;
    strictFunctionTypes?: boolean;
    strictNullChecks?: boolean;
    strictPropertyInitialization?: boolean;
    useUnknownInCatchVariables?: boolean;

    // Watch and build modes
    assumeChangesOnlyAffectDirectDependencies?: boolean;

    // Backwards compatibility
    charset?: string;
    importsNotUsedAsValues?: "remove" | "preserve" | "error";
    keyofStringsOnly?: boolean;
    noImplicitUseStrict?: boolean;
    noStrictGenericChecks?: boolean;
    out?: string;
    preserveValueImports?: boolean;
    suppressExcessPropertyErrors?: boolean;
    suppressImplicitAnyIndexErrors?: boolean;

    // Projects
    composite?: boolean;
    disableReferencedProjectLoad?: boolean;
    disableSolutionSearching?: boolean;
    disableSourceOfProjectReferenceRedirect?: boolean;
    incremental?: boolean;
    tsBuildInfoFile?: string;

    // Emit
    declaration?: boolean;
    declarationDir?: string;
    declarationMap?: boolean;
    downlevelIteration?: boolean;
    emitBOM?: boolean;
    emitDeclarationOnly?: boolean;
    importHelpers?: boolean;
    inlineSourceMap?: boolean;
    inlineSources?: boolean;
    mapRoot?: string;
    newLine?: "crlf" | "lf";
    noEmit?: boolean;
    noEmitHelpers?: boolean;
    noEmitOnError?: boolean;
    outDir?: string;
    outFile?: string;
    preserveConstEnums?: boolean;
    removeComments?: boolean;
    sourceMap?: boolean;
    sourceRoot?: string;
    stripInternal?: boolean;

    // Compiler diagnostics
    diagnostics?: boolean;
    explainFiles?: boolean;
    extendedDiagnostics?: boolean;
    generateCpuProfile?: string;
    generateTrace?: string;
    listEmittedFiles?: boolean;
    listFiles?: boolean;
    noCheck?: boolean;
    traceResolution?: boolean;

    // Editor support
    disableSizeLimit?: boolean;
    plugins?: Array<{ name: string; [option: string]: unknown }>;

    // Language and environment
    emitDecoratorMetadata?: boolean;
    experimentalDecorators?: boolean;
    jsx?: "preserve" | "react" | "react-native" | "react-jsx" | "react-jsxdev";
    jsxFactory?: string;
    jsxFragmentFactory?: string;
    jsxImportSource?: string;
    lib?: string[];
    moduleDetection?: "legacy" | "auto" | "force";
    noLib?: boolean;
    reactNamespace?: string;
    target?: "es5" | "es6" | "es2015" | "es2016" | "es2017" | "es2018" | "es2019" | "es2020" | "es2021" | "es2022" | "es2023" | "es2024" | "esnext";
    useDefineForClassFields?: boolean;

    // Output formatting
    noErrorTruncation?: boolean;
    preserveWatchOutput?: boolean;
    pretty?: boolean;

    // Completeness
    skipDefaultLibCheck?: boolean;
    skipLibCheck?: boolean;

    // Watch options
    watchFile?:
        | "fixedpollinginterval"
        | "prioritypollinginterval"
        | "dynamicprioritypolling"
        | "fixedchunksizepolling"
        | "usefsevents"
        | "usefseventsonparentdirectory";
    watchDirectory?: "usefsevents" | "fixedpollinginterval" | "dynamicprioritypolling" | "fixedchunksizepolling";
    fallbackPolling?: "fixedinterval" | "priorityinterval" | "dynamicpriority" | "fixedchunksize";
    synchronousWatchDirectory?: boolean;
    excludeDirectories?: string[];
    excludeFiles?: string[];

    // Build options
    verbose?: boolean;
    dry?: boolean;
    force?: boolean;
    clean?: boolean;
    stopBuildOnErrors?: boolean;
}

/**
 * Utility function to check if a string is a valid TypeScript compiler CLI flag.
 */
export function isTscFlag(flag: string): flag is TscFlag {
    return TSC_FLAG_VALUES.includes(flag as TscFlag);
}

/**
 * Utility function to get the flag key from a flag value.
 */
export function getTscFlagKey(flag: TscFlag): TscFlagKey | undefined {
    const entry = Object.entries(TSC_ALL_FLAGS).find(([, value]) => value === flag);
    return entry ? (entry[0] as TscFlagKey) : undefined;
}

/**
 * Utility function to get the flag value from a flag key.
 */
export function getTscFlagValue(key: TscFlagKey): TscFlag {
    return TSC_ALL_FLAGS[key];
}

/**
 * Export aliases for backward compatibility and convenience.
 */
export { TSC_ALL_FLAGS as TscFlags, TSC_FLAG_VALUES as TscFlagValues, TSC_FLAG_KEYS as TscFlagKeys };
