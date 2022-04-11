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
import * as sass from "sass";

/**
 * Default options for Sass compiler.
 * See https://github.com/sass/node-sass#importer--v200---experimental
 * for more details.
 */
export const defaultOptions: sass.Options<"sync"> = {
    // FIXME: New API syntax: "indented",
    // FIXME: New API indentWidth: 0,
    // FIXME: New API indentedSyntax: false,
    // FIXME: New API linefeed: "lf",
    // FIXME: New API omitSourceMapUrl: true,
    // FIXME: New API outputStyle: "expanded",
    // outFile: "",  // Required when sourceMap is a truthy value
    sourceMap: false,
    // FIXME: New API sourceMapContents: false,
    // FIXME: New API sourceMapEmbed: false,
    // FIXME: New API sourceMapRoot: undefined,
};
