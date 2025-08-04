/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import type { Config } from "jest";

export const config: Config = {
    collectCoverageFrom: ["./src/**/*.{ts,tsx}"],
    coverageDirectory: "coverage",
    coveragePathIgnorePatterns: ["index.ts"],
    moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
    modulePathIgnorePatterns: ["<rootDir>/lib/", "<rootDir>/__TEMP__/"],
    watchPathIgnorePatterns: ["<rootDir>/lib/", "<rootDir>/coverage/", "<rootDir>/test-output/", "<rootDir>/__TEMP__/", "<rootDir>/node_modules/"],
    prettierPath: null,
    setupFilesAfterEnv: ["../../jest.setup.ts"],
    testRegex: "src/.*\\.(test|spec)\\.ts$",
    transform: {
        "^.+\\.(js|ts)$": ["ts-jest", { diagnostics: false, isolatedModules: true }],
    },
    transformIgnorePatterns: ["node_modules/.pnpm/(?!cross-spawn|tildify|path-exists)/"],
    resetMocks: true,
    clearMocks: true,
};
