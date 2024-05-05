/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import type { CompileFragment } from "./Compiler";
import { Compiler } from "./Compiler";
import type { CompilerOptions } from "./CompilerOptions";
import { DefaultReporter } from "./DefaultReporter";
import { NoReporter } from "./NoReporter";
import { tsDefaults, tsLibDefaults } from "./defaults";

export * from "./addons";
export * from "./compilation";
export * from "./config";
export { Compiler, DefaultReporter, NoReporter, tsDefaults, tsLibDefaults };
export type { CompileFragment, CompilerOptions };
