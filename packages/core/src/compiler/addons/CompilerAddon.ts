/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */

import { AddonContext } from "@quatico/websmith-api";

export interface CompilerAddon {
    getName: () => string;
    activate: (context: AddonContext) => void;
}

export type CompilerAddons = CompilerAddon[] & {
    getNames: () => string[];
};

export const compilerAddons = (addons: CompilerAddon[]): CompilerAddons => Object.assign(addons, { getNames: () => addons.map(it => it.getName()) });
