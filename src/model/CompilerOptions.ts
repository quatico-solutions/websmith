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
import * as sass from "sass";
import ts from "typescript";
import { Reporter } from "./Reporter";

export interface CompilerOptions {
    configPath: string;
    libFiles?: { [name: string]: string };
    reporter?: Reporter;
    sassOptions?: sass.Options;
    system?: ts.System;
}
