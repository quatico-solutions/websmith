/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
module.exports = {
    collectCoverageFrom: ["./src/**/*.ts"],
    coverageDirectory: "coverage",
    coveragePathIgnorePatterns: ["index.ts"],
    moduleFileExtensions: ["ts", "js", "json", "node"],
    moduleNameMapper: {
        "@quatico/websmith-api": "<rootDir>/../api/src",
        "@quatico/websmith-core": "<rootDir>/../core/src",
    },
    prettierPath: null,
    testRegex: "src/.*spec\\.(js|ts)$",
    setupFilesAfterEnv: ["<rootDir>/../../jest.setup.ts"],
    transform: {
        "^.+\\.(js|ts)$": ["ts-jest", { diagnostics: false, isolatedModules: true }],
    },
    resetMocks: true,
    restoreMocks: true,
};
