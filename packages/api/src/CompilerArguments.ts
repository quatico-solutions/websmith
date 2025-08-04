/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */

export const TSC_ARGUMENT_KEYS: (keyof TscArguments)[] = [
    "allowJs",
    "checkJs",
    "configFilePath",
    "debug",
    "declaration",
    "declarationMap",
    "emitDeclarationOnly",
    "esModuleInterop",
    "files",
    "jsx",
    "lib",
    "module",
    "noEmit",
    "outDir",
    "outFile",
    "pretty",
    "project",
    "removeComments",
    "rootDir",
    "sourceMap",
    "strict",
    "target",
    "types",
    "watch",
] as const;

export const WEBSMITH_ARGUMENT_KEYS: (keyof WebsmithArguments)[] = ["addons", "addonsDir", "configFile", "profile", "transpileOnly"] as const;

export const LOADER_ARGUMENT_KEYS: (keyof LoaderArguments)[] = ["instanceName", "tsConfigFile"] as const;

export const COMPILER_ARGUMENT_KEYS: (keyof CompilerArguments)[] = [
    ...WEBSMITH_ARGUMENT_KEYS,
    ...TSC_ARGUMENT_KEYS,
    ...LOADER_ARGUMENT_KEYS,
] as const;

export type CompilerArgumentKey = (typeof COMPILER_ARGUMENT_KEYS)[number];

export type TscArgumentKey = (typeof TSC_ARGUMENT_KEYS)[number];

export type WebsmithArgumentKey = (typeof WEBSMITH_ARGUMENT_KEYS)[number];

export type LoaderArgumentKey = (typeof LOADER_ARGUMENT_KEYS)[number];

export type CompilerArguments = WebsmithArguments & TscArguments & LoaderArguments;

export type LoaderArguments = {
    instanceName?: string;
    tsConfigFile?: string;
    // We flatten these into arguments. TODO: Find a better way to handle this.
    // tsConfig?: ts.CompilerOptions;
    // config?: unknown;
};

export type WebsmithArguments = {
    addons?: string;
    addonsDir?: string;
    configFile?: string;
    profile?: string;
    transpileOnly?: boolean;
    tsConfigFile?: string;
};

export type TscArguments = {
    allowJs?: boolean;
    checkJs?: boolean;
    configFilePath?: string;
    debug?: boolean;
    declaration?: boolean;
    declarationMap?: boolean;
    emitDeclarationOnly?: boolean;
    esModuleInterop?: boolean;
    files?: string[];
    jsx?: string;
    lib?: string[];
    module?: string;
    noEmit?: boolean;
    outDir?: string;
    outFile?: string;
    pretty?: boolean;
    project?: string;
    removeComments?: boolean;
    rootDir?: string;
    sourceMap?: boolean;
    strict?: boolean;
    target?: string;
    types?: string[];
    watch?: boolean;
};
