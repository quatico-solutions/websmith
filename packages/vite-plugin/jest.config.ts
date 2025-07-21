/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import type { Config } from "jest";
import { defaults } from "../../jest-base.config";

const config: Config = {
    ...defaults,
    roots: ["<rootDir>/src", "<rootDir>/tests"],
    testEnvironment: "node",
    collectCoverageFrom: ["src/**/*.ts"],
};

export default config;
