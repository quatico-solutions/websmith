/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { createResolver } from "./addon-resolver";
import { AddonRegistry } from "./AddonRegistry";
import type { CompilerAddon } from "./CompilerAddon";

export { AddonRegistry, createResolver };
export type { CompilerAddon };
