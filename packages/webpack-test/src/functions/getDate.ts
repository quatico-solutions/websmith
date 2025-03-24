/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
// @service()
export const getDate = (offsetHours: number) => new Date(new Date().getTime() + offsetHours * 60 * 60 * 1000);
