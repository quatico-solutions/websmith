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
        "@quatico/websmith-api": "<rootDir>/../api/src",
        "@quatico/websmith-core": "<rootDir>/../core/src",
        "@quatico/websmith-node": "<rootDir>/../node/lib",
        "@quatico/websmith-testing": "<rootDir>/../testing/src",
        "websmith-loader": "<rootDir>/../webpack/lib",
    },
    testRegex: "tests/.*test\\.(tsx?)$",
};

export default config;
