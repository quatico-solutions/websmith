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
        "@quatico/websmith-cli": "<rootDir>/packages/cli/src",
        "@quatico/websmith-core": "<rootDir>/packages/core/src",
    },
    preset: "ts-jest",
    setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
    testRegex: "src/.*(test|spec)\\.(tsx?)$",
    testEnvironmentOptions: { url: "http://localhost/" },
    transform: {
        "^.+\\.(js|ts)$":[
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
        ] 
    },
    transformIgnorePatterns: ["node_modules"],
    resetMocks: true,
    watchman: false,
};
