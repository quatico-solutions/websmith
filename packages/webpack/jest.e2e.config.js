/*
 * @license
 *
 * Copyright (c) 2017-2022 Quatico Solutions AG
 * Förrlibuckstrasse 220, 8005 Zurich, Switzerland
 *
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Quatico Solutions AG, ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Quatico.
 */

module.exports = {
    preset: "ts-jest",
    collectCoverageFrom: ["./src/**/*.{ts,tsx}"],
    coverageDirectory: "coverage",
    moduleNameMapper: {
        "@quatico/websmith-api": "<rootDir>/../api/src",
        "@quatico/websmith-cli": "<rootDir>/../cli/src",
        "@quatico/websmith-core": "<rootDir>/../core/src",
    },
    roots: ["<rootDir>/test/"],
    moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
    testEnvironment: "node",
    testRegex: ".+\\.test\\.ts",
    testTimeout: 25000,
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
    resetMocks: true,
};
