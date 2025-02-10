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
