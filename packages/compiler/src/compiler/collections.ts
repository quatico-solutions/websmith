/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
/**
 * Concat two possibly undefined arrays. (More indulgent than 'lodash/concat').
 *
 * @param result Resulting array; maybe undefined
 * @param add Appended values; maybe undefined
 * @returns A possibly empty array; NEVER undefined
 */
export const concat = <R>(result?: R[], add?: R[] | readonly R[]): R[] => {
    if (result) {
        result.push(...(add ?? []));
    } else {
        result = [...(add ?? [])];
    }
    return result;
};
