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
// TODO: Add support for style processors via addon
import { createStyleCompiler, StyleCompilerOptions } from "./compile-styles";
import { getBaseName, isElementDeclaration, isProjectFileName, isScriptFile, isScriptFileName, isStyleFile, isStyleFileName } from "./elements";
import { Node, parseStyles, StyleVisitor, visitNode, writeNode } from "./parse-scss";

export {
    createStyleCompiler,
    getBaseName,
    isElementDeclaration,
    isProjectFileName,
    isScriptFile,
    isScriptFileName,
    isStyleFile,
    isStyleFileName,
    parseStyles,
    StyleCompilerOptions,
    StyleVisitor,
    visitNode,
    writeNode,
};
export type { Node };
