/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { getDate } from "./functions/getDate";
import { createMessage } from "./model";
import React from "react";

export const render = () => {
    return (
        <>
            <span>Test: {createMessage().message}</span>
            <span>Test Date {getDate(0).toDateString()}</span>
        </>
    );
};
