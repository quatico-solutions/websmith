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

/**
 * Default options for Sass compiler.
 * See https://github.com/sass/node-sass#importer--v200---experimental
 * for more details.
 */
export const defaultOptions: sass.Options = {
    indentType: "space",
    indentWidth: 0,
    indentedSyntax: false,
    linefeed: "lf",
    omitSourceMapUrl: true,
    outputStyle: "expanded",
    // outFile: "",  // Required when sourceMap is a truthy value
    sourceMap: false,
    sourceMapContents: false,
    sourceMapEmbed: false,
    sourceMapRoot: undefined,
};
