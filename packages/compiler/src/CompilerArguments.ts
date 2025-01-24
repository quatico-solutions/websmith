import { CompilerOptions } from "@quatico/websmith-core";

/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
export interface CompilerArguments
    extends Partial<Omit<CompilerOptions, "tsconfig" | "reporter" | "project" | "additionalArguments" | "targets" | "config">> {
    targets?: string;
    files?: string[];
    project?: string;
}
