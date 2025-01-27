/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
module.exports = {
    collectCoverageFrom: ["./src/**/*.{ts,tsx}"],
    coverageDirectory: "coverage",
    coveragePathIgnorePatterns: ["index.ts"],
    moduleFileExtensions: ["ts", "js", "json", "node"],
    moduleNameMapper: {
        "@quatico/websmith-api": "<rootDir>/../api/src",
    },
    prettierPath: null,
    setupFilesAfterEnv: ["<rootDir>/../../jest.setup.ts"],
    testRegex: "(tests|src)/.*(test|spec)\\.(js|ts)$",
    testTimeout: 15000,
    transform: {
        "^.+\\.(js|ts)$": [
            "@swc/jest",
            {
                jsc: {
                    parser: {
                        syntax: "typescript",
                    },
                },
            },
        ],
    },
    transformIgnorePatterns: ["node_modules"],
    resetMocks: true,
};
