/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { createResolver } from "./addon-resolver";
import { AddonRegistry, type AddonConfig } from "./AddonRegistry";
import { compilerAddons, type CompilerAddon, type CompilerAddons } from "./CompilerAddon";

export { AddonRegistry, compilerAddons, createResolver };
export type { AddonConfig, CompilerAddon, CompilerAddons };
