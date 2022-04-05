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
import { resolve } from "path";

export type CacheFile = { version: number; content: string; files: ts.OutputFile[]; snapshot?: ts.IScriptSnapshot };

export const getCachedName = (fileName: string, target: string): string => {
    return `${resolve(fileName)}!!${target}`;
};
