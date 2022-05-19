/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
// @annotated()
export const getFoobar = (date: Date) => {
    return foobar(date);
};

const foobar = (date: Date) => {
    return `foobar ${date.toISOString()}`;
};
