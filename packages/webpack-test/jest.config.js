/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */

module.exports = {
    collectCoverageFrom: ["./src/**/*.{ts,tsx}"],
    coverageDirectory: "coverage",
    moduleNameMapper: {
        "@quatico/websmith-api": "<rootDir>/../api/src",
        "@quatico/websmith-compiler": "<rootDir>/../compiler/src",
        "@quatico/websmith-core": "<rootDir>/../core/src",
        "@quatico/websmith-webpack": "<rootDir>/../webpack/src",
    },
    roots: ["<rootDir>/src/"],
    moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
    testEnvironment: "node",
    testRegex: ".+\\.test\\.ts",
    testTimeout: 25000,
    transform: {
        "^.+\\.(j|t)s$": [
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
    resetMocks: true,
};
