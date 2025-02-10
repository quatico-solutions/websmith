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
    moduleNameMapper: {
        "@quatico/websmith-core": "<rootDir>/../core/src",
        "@quatico/websmith-webpack": "<rootDir>/../webpack/src",
    },
    setupFilesAfterEnv: ["./test/jest.setup.ts"],
    testRegex: "(tests|src)/.+\\.spec\\.ts$",
    testTimeout: 60000,
    transform: {
        "^.+\\.(js|ts)$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.test.json", diagnostics: false, isolatedModules: true }],
    },
};

export default config;
