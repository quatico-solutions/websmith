/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */

import { type AddonContext } from "@quatico/websmith-api";

export interface CompilerAddon {
    getName: () => string;
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
     * **Defaults to `false`** (fast path - no Program creation).
     *
     * Set to `true` only if your addon needs:
     * - Type checking
     * - Import resolution
     * - Symbol information
     * - TypeScript's Program API
     *
     * Setting to `false` (default) enables 10-20x faster compilation by:
     * - Skipping TypeScript Program creation
     * - Using ts.transpileModule instead
     * - Avoiding full type graph construction
     *
     * @default false
     */
    needsTypeInfo?: boolean;
}

export type CompilerAddons = CompilerAddon[] & {
    getNames: () => string[];
};

export const compilerAddons = (addons: CompilerAddon[]): CompilerAddons => Object.assign(addons, { getNames: () => addons.map(it => it.getName()) });
