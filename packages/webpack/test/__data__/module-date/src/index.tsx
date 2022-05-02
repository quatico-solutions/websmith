import { getDate } from "./functions/getDate";
import { createTest } from "./model";

export const render = () => {
    return (
        <>
            <span>Test: ${createTest().message}</span>
            <span>Test Date ${getDate(0)}</span>
        </>
    );
};
