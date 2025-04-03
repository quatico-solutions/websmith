/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import type { CompilerOptions } from "../compiler";
import type { BrowserSystemOptions } from "../environment";

export type CompileSystemOptions = BrowserSystemOptions &
    Partial<CompilerOptions> & {
        files?: Record<string, string>;
    };
