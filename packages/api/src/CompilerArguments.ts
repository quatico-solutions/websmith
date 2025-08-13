/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import type ts from "typescript";
import { type TscCliArguments } from "./TscArguments";
import { type Reporter } from "./addons";
import { CompilationProfile, type CompilationConfig } from "./config";

/**
 * Array of all TypeScript compiler option keys.
 * These are the options that can be passed as CLI arguments to the TypeScript compiler.
 */
export const TSC_ARGUMENT_KEYS: (keyof TscCliArguments)[] = [
    "all",
    "build",
    "help",
    "init",
    "listFilesOnly",
    "locale",
    "project",
    "showConfig",
    "version",
    "watch",

    // Module options
    "allowArbitraryExtensions",
    "allowImportingTsExtensions",
    "allowUmdGlobalAccess",
    "baseUrl",
    "customConditions",
    "module",
    "moduleResolution",
    "moduleSuffixes",
    "noResolve",
    "noUncheckedSideEffectImports",
    "paths",
    "resolveJsonModule",
    "resolvePackageJsonExports",
    "resolvePackageJsonImports",
    "rewriteRelativeImportExtensions",
    "rootDir",
    "rootDirs",
    "typeRoots",
    "types",

    // JavaScript support
    "allowJs",
    "checkJs",
    "maxNodeModuleJsDepth",

    // Interop constraints
    "allowSyntheticDefaultImports",
    "esModuleInterop",
    "forceConsistentCasingInFileNames",
    "isolatedDeclarations",
    "isolatedModules",
    "preserveSymlinks",
    "verbatimModuleSyntax",

    // Type checking
    "allowUnreachableCode",
    "allowUnusedLabels",
    "alwaysStrict",
    "exactOptionalPropertyTypes",
    "noFallthroughCasesInSwitch",
    "noImplicitAny",
    "noImplicitOverride",
    "noImplicitReturns",
    "noImplicitThis",
    "noPropertyAccessFromIndexSignature",
    "noUncheckedIndexedAccess",
    "noUnusedLocals",
    "noUnusedParameters",
    "strict",
    "strictBindCallApply",
    "strictBuiltinIteratorReturn",
    "strictFunctionTypes",
    "strictNullChecks",
    "strictPropertyInitialization",
    "useUnknownInCatchVariables",

    // Watch and build modes
    "assumeChangesOnlyAffectDirectDependencies",

    // Backwards compatibility
    "charset",
    "importsNotUsedAsValues",
    "keyofStringsOnly",
    "noImplicitUseStrict",
    "noStrictGenericChecks",
    "out",
    "preserveValueImports",
    "suppressExcessPropertyErrors",
    "suppressImplicitAnyIndexErrors",

    // Projects
    "composite",
    "disableReferencedProjectLoad",
    "disableSolutionSearching",
    "disableSourceOfProjectReferenceRedirect",
    "incremental",
    "tsBuildInfoFile",

    // Emit
    "declaration",
    "declarationDir",
    "declarationMap",
    "downlevelIteration",
    "emitBOM",
    "emitDeclarationOnly",
    "importHelpers",
    "inlineSourceMap",
    "inlineSources",
    "mapRoot",
    "newLine",
    "noEmit",
    "noEmitHelpers",
    "noEmitOnError",
    "outDir",
    "outFile",
    "preserveConstEnums",
    "removeComments",
    "sourceMap",
    "sourceRoot",
    "stripInternal",

    // Compiler diagnostics
    "diagnostics",
    "explainFiles",
    "extendedDiagnostics",
    "generateCpuProfile",
    "generateTrace",
    "listEmittedFiles",
    "listFiles",
    "noCheck",
    "traceResolution",

    // Editor support
    "disableSizeLimit",
    "plugins",

    // Language and environment
    "emitDecoratorMetadata",
    "experimentalDecorators",
    "jsx",
    "jsxFactory",
    "jsxFragmentFactory",
    "jsxImportSource",
    "lib",
    "moduleDetection",
    "noLib",
    "reactNamespace",
    "target",
    "useDefineForClassFields",

    // Output formatting
    "noErrorTruncation",
    "preserveWatchOutput",
    "pretty",

    // Completeness
    "skipDefaultLibCheck",
    "skipLibCheck",

    // Watch options
    "watchFile",
    "watchDirectory",
    "fallbackPolling",
    "synchronousWatchDirectory",
    "excludeDirectories",
    "excludeFiles",

    // Build options
    "verbose",
    "dry",
    "force",
    "clean",
    "stopBuildOnErrors",
] as const;

export const WEBSMITH_ARGUMENT_KEYS: (keyof WebsmithArguments)[] = [
    "addons",
    "addonsDir",
    "configFile",
    "debug",
    "files",
    "fileNames",
    "profile",
    "transpileOnly",
    "tsConfigFile",
    "watch",
] as const;

export const LOADER_OPTIONS_KEYS: (keyof LoaderOptions)[] = [
    "config",
    "configFile",
    "debug",
    "instanceName",
    "profile",
    "profiles",
    "transpileOnly",
    "tsConfig",
    "tsConfigFile",
] as const;

export const COMPILER_ARGUMENT_KEYS: (keyof CompilerArguments)[] = [
    ...new Set([...WEBSMITH_ARGUMENT_KEYS, ...TSC_ARGUMENT_KEYS, ...LOADER_OPTIONS_KEYS]),
] as const;

export type CompilerArgumentKey = (typeof COMPILER_ARGUMENT_KEYS)[number];

export type TscArgumentKey = (typeof TSC_ARGUMENT_KEYS)[number];

export type WebsmithArgumentKey = (typeof WEBSMITH_ARGUMENT_KEYS)[number];

export type LoaderArgumentKey = (typeof LOADER_OPTIONS_KEYS)[number];

export type CompilerArguments = WebsmithArguments & TscCliArguments & LoaderOptions;

export type LoaderOptions = {
    config?: CompilationConfig;
    configFile?: string;
    debug?: boolean;
    instanceName?: string;
    profile?: string;
    profiles?: Record<string, CompilationProfile>;
    transpileOnly?: boolean;
    tsConfig?: ts.CompilerOptions;
    tsConfigFile?: string;
};

export type WebsmithOptions = {
    additionalArguments?: Map<string, unknown>;
    addons?: string;
    addonsDir?: string;
    cliArgs?: ts.ParsedCommandLine;
    config?: CompilationConfig;
    configFile?: string;
    debug?: boolean;
    files?: string[];
    profile?: string;
    project?: string;
    reporter?: Reporter;
    transpileOnly?: boolean;
    tsConfig?: ts.CompilerOptions;
    tsConfigFile?: string;
    watch?: boolean;
};

export type TscArguments = TscCliArguments;

/**
 * Interface for Websmith CLI arguments that can be passed via command line.
 * This represents the complete set of Websmith-specific options that can be used
 * when invoking the Websmith compiler from the command line.
 */
export interface WebsmithArguments {
    /**
     * Comma-separated list of addon names to load.
     * Example: "addon1,addon2,addon3"
     */
    addons?: string;

    /**
     * Directory path containing addons.
     * Relative or absolute path to the directory where addon files are located.
     */
    addonsDir?: string;

    /**
     * Path to the Websmith configuration file.
     * Example: "./websmith.config.json"
     */
    configFile?: string;

    /**
     * Enable debug mode for verbose logging and debugging information.
     */
    debug?: boolean;

    /**
     * Array of file paths to include in the compilation.
     * Example: ["file1.ts", "file2.ts", "file3.ts"]
     */
    files?: string[];

    /**
     * Comma-separated list of file paths to include in the compilation.
     * Example: "file1.ts,file2.ts,file3.ts"
     */
    fileNames?: string;

    /**
     * Name of the compilation profile to use.
     * Profiles allow different sets of addons and configurations for different build scenarios.
     */
    profile?: string;

    /**
     * Enable transpile-only mode.
     * When true, only transpilation is performed without type checking.
     */
    transpileOnly?: boolean;

    /**
     * Path to the TypeScript configuration file.
     * Example: "./tsconfig.json"
     */
    tsConfigFile?: string;

    /**
     * Enable watch mode for automatic recompilation on file changes.
     */
    watch?: boolean;
}
