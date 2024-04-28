import { createFs, resetFs } from "./fusion-fs";

jest.mock("fs", () => {
    return createFs(jest.requireActual("memfs"));
});

jest.mock("fs/promises", () => {
    return createFs(jest.requireActual("memfs"));
});

afterEach(() => {
    jest.clearAllMocks();
    resetFs();
});
