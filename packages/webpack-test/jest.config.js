/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */

module.exports = {
    roots: ["<rootDir>/src/"],
    moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
    moduleNameMapper: {
        "@quatico/websmith-api": "<rootDir>/../api/lib",
        "@quatico/websmith-core": "<rootDir>/../core/lib",
        "@quatico/websmith-testing": "<rootDir>/../testing/lib",
        "@quatico/websmith-webpack": "<rootDir>/../webpack/lib",
    },
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
    restoreMocks: true,
};
