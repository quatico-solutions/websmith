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
module.exports = {
    collectCoverageFrom: ["./src/**/*.{ts,tsx}"],
    coverageDirectory: "coverage",
    coveragePathIgnorePatterns: ["index.ts"],
    globals: {
        "ts-jest": {
            tsconfig: "./tsconfig.test.json",
        },
    },
    moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
    preset: "ts-jest",
    testEnvironment: "jest-environment-jsdom-sixteen",
    setupFilesAfterEnv: ["./src/__mocks__/jest.setup.ts"],
    testRegex: "src/.*(test|spec)\\.(tsx?)$",
    testURL: "http://localhost/",
    transform: {
        "^.+\\.(js|jsx|ts|tsx)$": "ts-jest",
    },
    transformIgnorePatterns: ["node_modules"],
};
