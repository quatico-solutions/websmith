/* eslint-disable no-console */
import { createFs, resetFs } from "./packages/compiler/test/fusion-fs";
import { tsLibMocks } from "./packages/compiler/test/tsLibMocks";
import { readE2eTestData } from "./packages/test/src/test-data-helper";

tsLibMocks();

export { readE2eTestData };

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
