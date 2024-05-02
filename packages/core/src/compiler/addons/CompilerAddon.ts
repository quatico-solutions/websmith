/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */

import { AddonContext } from "@quatico/websmith-api";

export interface CompilerAddon {
    // FIXME: We need to add the sourceDir of the  addon
    sourceDir?: string;
    getName: () => string;
    activate: (context: AddonContext) => void;
}
