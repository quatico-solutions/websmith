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
    moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
    moduleNameMapper: {
        "@quatico/websmith-api": "<rootDir>/packages/api/src",
        "@quatico/websmith-compiler": "<rootDir>/packages/compiler/src",
        "@quatico/websmith-core": "<rootDir>/packages/core/src",
        "@quatico/websmith-testing": "<rootDir>/packages/testing/src",
        "@quatico/websmith-webpack": "<rootDir>/packages/webpack/src",
    },
    prettierPath: null,
    setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
    testRegex: "src/.*spec\\.(tsx?)$",
    testEnvironmentOptions: { url: "http://localhost/" },
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
    clearMocks: true,
};
