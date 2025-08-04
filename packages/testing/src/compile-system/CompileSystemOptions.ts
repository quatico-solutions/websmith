/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import type { BrowserSystemOptions, CompilerOptions } from "@quatico/websmith-core";

export type CompileSystemOptions = BrowserSystemOptions &
    CompilerOptions & {
        files?: Record<string, string>;
    };
