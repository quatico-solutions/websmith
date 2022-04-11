/*
 * @license
 *
 * Copyright (c) 2017-2022 Quatico Solutions AG
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
import ts from "typescript";

/**
 * This type represents the configuration options for a target. It is used in
 * the `targets` section of the `websmith.config.json` file. You can specify
 *  - the list of addons to apply for this target
 *  - whether output files should be written to disk
 *  - specific configuration properties used by your addon
 *  - a set of compiler options for the TypeScript compiler for this target
 */
export type TargetConfig = {
    addons?: string[];
    writeFile?: boolean;
    config?: unknown;
    options?: ts.CompilerOptions;
};
