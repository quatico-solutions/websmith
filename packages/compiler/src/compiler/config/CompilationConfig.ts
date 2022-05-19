/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import type { TargetConfig } from "@quatico/websmith-api";

export type CompilationConfig = {
    configFilePath: string;
    addonsDir?: string;
    addons?: string[];
    targets?: Record<string, TargetConfig>;
};
