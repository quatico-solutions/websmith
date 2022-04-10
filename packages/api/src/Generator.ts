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
 * Generators consume the unmodified source file and can create
 * additional source input or other output files unrelated to the
 * following compilation process. Generators are executed before all
 * other Addon types and thus before the actual compilation.
 *
 * Use this generator function to create additional files, such as
 * documentation based on your source code.
 */
export type Generator = (fileName: string, content: string) => void;
