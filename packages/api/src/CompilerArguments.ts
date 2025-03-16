/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
export interface CompilerArguments {
    addons?: string;
    addonsDir?: string;
    allowJs?: boolean;
    checkJs?: boolean;
    configFile?: string;
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
    profile?: string;
    project?: string;
    removeComments?: boolean;
    sourceMap?: boolean;
    strict?: boolean;
    target?: string;
    transpileOnly?: boolean;
    types?: string[];
    watch?: boolean;
}
