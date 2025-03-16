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
    prettierPath: null,
    setupFilesAfterEnv: ["../../jest.setup.ts"],
    testRegex: "src/.*spec\\.(tsx?)$",
    transform: {
        "^.+\\.(js|ts)$": ["ts-jest", { diagnostics: false, isolatedModules: true }],
    },
    transformIgnorePatterns: ["node_modules/.pnpm/(?!cross-spawn|tildify|path-exists)/"],
    resetMocks: true,
    clearMocks: true,
};
