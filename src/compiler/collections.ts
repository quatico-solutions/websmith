/*
 * @license
 *
 * Copyright (c) 2017-2021 Quatico Solutions AG
 * Förrlibuckstrasse 220, 8005 Zurich, Switzerland
 *
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Quatico Solutions AG, ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Quatico.
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
