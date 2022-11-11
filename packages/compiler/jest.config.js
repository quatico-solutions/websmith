/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
module.exports = {
    preset: "ts-jest",
    collectCoverageFrom: ["./src/**/*.{ts,tsx}"],
    coverageDirectory: "coverage",
    coveragePathIgnorePatterns: ["index.ts"],
    moduleFileExtensions: ["ts", "js", "json", "node"],
    moduleNameMapper: {
        "@quatico/websmith-api": "<rootDir>/../api/src",
    },
    setupFilesAfterEnv: ["<rootDir>/../../jest.setup.ts"],
    testRegex: "src/.*(test|spec)\\.(js|ts)$",
    testTimeout: 15000,
    testEnvironmentOptions: { url: "http://localhost/" },
    transform: {
        "^.+\\.(js|ts)$": [
            "@swc/jest",
            {
                jsc: {
                    parser: {
                        syntax: "typescript",
                    },
                    transform: {
                        react: {
                            runtime: "automatic",
                        },
                    },
                },
            },
        ],
    },
    transformIgnorePatterns: ["node_modules"],
    resetMocks: true,
};
