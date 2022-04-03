/*
 * @license
 *
 * Copyright (c) 2017-2021 Quatico Solutions AG
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

// @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
    preset: "ts-jest",
    coverageDirectory: "coverage",
    coveragePathIgnorePatterns: ["index.ts", "test/*"],
    globals: {
        "ts-jest": {
            tsconfig: "./tsconfig.test.json",
        },
    },
    // moduleNameMapper: {
    //     "@qs/magellan-shared": "<rootDir>/../shared/src",
    //     "@qs/magellan-client": "<rootDir>/../client/src",
    //     "@qs/magellan-server": "<rootDir>/../server/src",
    //     "@qs/magellan-compiler": "<rootDir>/../compiler/src",
    //     "@qs/magellan-cli": "<rootDir>/../cli/src",
    // },
    moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
    roots: ["<rootDir>/src/", "<rootDir>/test/"],
    testEnvironment: "node",
    testMatch: ["**/jest-cucumber-setup.ts", "test/.*test\\.(jsx?|tsx?)$"],
    setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
    transform: {
        "^.+\\.(js|jsx|ts|tsx)$": "ts-jest",
    },
    resetMocks: true,
};
