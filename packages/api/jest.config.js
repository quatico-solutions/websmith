/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
module.exports = {
    preset: "ts-jest",
    collectCoverageFrom: ["./src/**/*.ts"],
    coverageDirectory: "coverage",
    coveragePathIgnorePatterns: ["index.ts"],
    globals: {
        "ts-jest": {
            tsconfig: "./tsconfig.test.json",
        },
    },
    moduleFileExtensions: ["ts", "js", "json", "node"],
    testRegex: "src/.*spec\\.(js|ts)$",
    setupFilesAfterEnv: ["<rootDir>/../../jest.setup.ts"],
    testURL: "http://localhost/",
    transform: {
        "^.+\\.(js|ts)$": "ts-jest",
    },
    resetMocks: true,
};
