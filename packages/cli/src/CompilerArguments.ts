/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
export interface CompilerArguments {
    addons?: string;
    addonsDir?: string;
    buildDir?: string;
    config?: string;
    debug?: boolean;
    files?: string[];
    project?: string;
    sourceMap?: boolean;
    targets?: string;
    watch?: boolean;
}
