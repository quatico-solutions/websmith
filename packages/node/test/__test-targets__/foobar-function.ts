/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
// @annotated()
export function getFoobar(date: Date) {
    return foobar(date);
}

function foobar(date: Date) {
    return `foobar ${date.toISOString()}`;
}
