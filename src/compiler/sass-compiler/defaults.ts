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
import sass from "sass";

/**
 * Default options for Sass compiler.
 * See https://github.com/sass/node-sass#importer--v200---experimental
 * for more details.
 */
export const defaultOptions: sass.Options<"sync"> = {
    sourceMap: false,
};
