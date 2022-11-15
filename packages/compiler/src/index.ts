/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { addCompileCommand } from "./command";
import { createOptions } from "./options";
import type { CompilerArguments } from "./CompilerArguments";

export { addCompileCommand, createOptions };
export type { CompilerArguments };

export { Compiler, NoReporter } from "@quatico/websmith-core";
export type { CompilerOptions } from "@quatico/websmith-core";
