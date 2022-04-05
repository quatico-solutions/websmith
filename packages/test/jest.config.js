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
    globals: {
        "ts-jest": {
            tsconfig: "./tsconfig.test.json",
        },
    },
    moduleNameMapper: {
        "@websmith/addon-api": "<rootDir>/../addon-api/src",
        "@websmith/compiler": "<rootDir>/../compiler/src",
        "@websmith/cli": "<rootDir>/../cli/src",
    },
    moduleFileExtensions: ["ts", "js", "json", "node"],
    roots: ["<rootDir>/src/"],
    testEnvironment: "node",
    testMatch: ["**/jest-cucumber-setup.ts", "test/.*test\\.(jsx?|tsx?)$"],
    setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
    transform: {
        "^.+\\.(js|ts)$": "ts-jest",
    },
    resetMocks: true,
};
