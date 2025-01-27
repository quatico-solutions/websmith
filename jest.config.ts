/*
 * @license
 *
 * Copyright (c) 2017-2024 Quatico Solutions AG
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
import type { Config } from "jest";

const config: Config = {
    rootDir: "./",
    projects: ["<rootDir>/packages/*/jest.config.ts"],
    collectCoverage: false,
};

export default config;
