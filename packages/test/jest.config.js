/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */

// @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
    preset: "ts-jest",
    moduleFileExtensions: ["ts", "js", "json", "node"],
    moduleNameMapper: {
        "@quatico/websmith-api": "<rootDir>/../api/src",
        "@quatico/websmith-core": "<rootDir>/../core/src",
        "@quatico/websmith-cli": "<rootDir>/../cli/src",
    },
    roots: ["<rootDir>/src/"],
    testEnvironment: "node",
    testMatch: ["**/cucumber.test.ts", "test/.*test\\.(jsx?|tsx?)$"],
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
};
