/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { getFoobarServer } from "./functions/server-function";

export function getFoobarClient(date: Date) {
    return getFoobarServer(date);
}
