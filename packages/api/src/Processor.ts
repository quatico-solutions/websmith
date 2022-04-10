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

/**
 * Processors consume the unmodified source files, or input files created
 * by Generators. A processor can modify the input files before the actual
 * compilation, i.e., it can change module dependencies or add additional
 * imports/exports.
 *
 * Use this processor function to modify input files before the actual
 * compilation.
 */
export type Processor = (fileName: string, content: string) => string | never;
