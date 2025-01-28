/* eslint-disable no-console */

const actualError = console.error;
console.error = jest.fn().mockImplementation((msg: string | Error) => {
    if (isString(msg)) {
        if (msg.startsWith("Cannot log after tests are done.")) {
            return undefined;
        }
    }
    return actualError(msg);
});

const isString = (value: unknown): value is string => typeof value === "string" && typeof value.startsWith === "function";
