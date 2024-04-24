/* eslint-disable no-console */
import { tsLibMocks } from "./packages/testing/src/tsLibMocks";
import { readE2eTestData } from "./packages/test/src/test-data-helper";

tsLibMocks();

console.info = () => undefined;
console.log = () => undefined;

afterEach(() => {
    jest.clearAllMocks();
});

export { readE2eTestData };
