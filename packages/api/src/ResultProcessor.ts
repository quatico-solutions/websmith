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
 * ResultProcessors consume all output files from the compilation process
 * and can create additional files. They cannot alter the output files,
 * but have access to the transformed source code and compilation results.
 * ResultProcessors are executed after all other Addon types and the actual
 * compilation is completed. All ResultProcessors are executed in order
 * of their registration once for every target.
 *
 * Use this result processor function to create additional output, such as
 * other compilation results or documentation based on your output.
 *
 * @param filePaths The paths of the output files.
 */
export type ResultProcessor = (filePaths: string[]) => void;
