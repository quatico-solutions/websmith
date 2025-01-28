/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import type { Config } from "jest";
import { config as baseConfig } from "../../jest-base.config";

const config: Config = {
    ...baseConfig,
    setupFilesAfterEnv: ["./test/jest.setup.ts"],
    testRegex: "(tests|src)/.+\\.spec\\.ts$",
    transform: {
        "^.+\\.(js|ts)$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.test.json", diagnostics: false, isolatedModules: true }],
    },
};

export default config;
