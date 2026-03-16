/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */

import { type AddonContext } from "./AddonContext";

/**
 * Represents a compiler addon that can be registered with the websmith compiler.
 * Addons can provide custom transformations, type checking, and file filtering.
 */
export interface CompilerAddon {
    /**
     * Returns the unique name of this addon.
     */
    getName: () => string;

    /**
     * Called when the addon is activated. Use the context to register processors,
     * generators, transformers, and result processors.
     *
     * @param context - The addon context for registering compilation hooks
     */
    activate: (context: AddonContext) => void;

    /**
     * Optional method to determine if this addon should process a specific file.
     * If not provided, the addon is assumed to want to process all files (backward compatible).
     *
     * @param filePath - The absolute path to the file being compiled
     * @param context - The addon context with compilation state
     * @returns true if this addon wants to process the file, false to skip
     */
    shouldProcessFile?: (filePath: string, context: AddonContext) => boolean;

    /**
     * Whether this addon needs TypeScript type information (Program API).
     *
     * **Important for backward compatibility:**
     * - `undefined` (not set): Legacy addon - assumes type info needed (safe default)
     * - `false` (explicit): Opts into fast path - no Program creation
     * - `true` (explicit): Requires Program for type information
     *
     * Set to `false` to enable 10-20x faster compilation by:
     * - Skipping TypeScript Program creation
     * - Using ts.transpileModule instead
     * - Avoiding full type graph construction
     *
     * Set to `true` if your addon needs:
     * - Type checking
     * - Import resolution
     * - Symbol information
     * - TypeScript's Program API
     *
     * **Legacy addons (undefined) are treated as needing type info to maintain backward compatibility.**
     *
     * @default undefined (treated as true for safety)
     */
    needsTypeInfo?: boolean;
}
