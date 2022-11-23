/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { addCompileCommand } from "./command";
import type { CompilerArguments } from "./CompilerArguments";
import { createOptions } from "./options";

export { Compiler, createBrowserSystem, DefaultReporter, getVersionedFile, NoReporter } from "@quatico/websmith-core";
export type { CompilerOptions } from "@quatico/websmith-core";
export { addCompileCommand, createOptions };
export type { CompilerArguments };
