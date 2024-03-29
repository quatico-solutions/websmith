/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { AddonActivator } from "@quatico/websmith-api";

export type AddonModule = {
    activate: AddonActivator;
    name: string;
};
