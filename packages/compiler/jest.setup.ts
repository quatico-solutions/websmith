/* eslint-disable no-console */
import { createFs, resetFs } from "./test/fusion-fs";

import { tsLibMocks } from "./test/tsLibMocks";

tsLibMocks();

console.debug = () => undefined;
console.info = () => undefined;
console.log = () => undefined;

jest.mock("fs", () => {
    return createFs(jest.requireActual("fs"));
});

afterEach(() => {
    jest.clearAllMocks();
    resetFs();
});
