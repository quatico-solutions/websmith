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
import * as path from "path";
import * as ts from "typescript";

export const ELEMENT_DECORATOR = /^@customElement\(.*?\)/;
export const VALID_SCRIPT_FILES = [".js", ".ts", ".tsx", ".d.ts"];
export const VALID_STYLE_FILES = [".scss", ".css"];
export const VALID_PROJECT_FILES = [...VALID_SCRIPT_FILES, ...VALID_STYLE_FILES];

export const getBaseName = (filePath: string): string => {
    if (filePath.includes("/")) {
        const idx = filePath.lastIndexOf("/") + 1;
        return filePath.substring(idx);
    }
    return filePath;
};

export const isScriptFile = (file: ts.Node): file is ts.SourceFile => {
    return ts.isSourceFile(file) && isScriptFileName(file.fileName) && file.statements.some(stmt => isElementDeclaration(stmt));
};

export const isScriptFileName = (fileName: string): boolean => VALID_SCRIPT_FILES.some(extname => fileName.endsWith(extname));

export const isProjectFileName = (fileName: string): boolean => VALID_PROJECT_FILES.some(extname => fileName.endsWith(extname));

export const isStyleFile = (file: ts.Node, filterExported = false): file is ts.SourceFile => {
    return ts.isSourceFile(file) && isStyleFileName(file.fileName, filterExported);
};

export const isStyleFileName = (fileName: string, filterExported = false): boolean =>
    VALID_STYLE_FILES.some(extname => fileName.endsWith(extname)) && (filterExported === false || path.basename(fileName).startsWith("_"));

export const isElementDeclaration = (node: ts.Node): node is ts.ClassDeclaration => {
    const isCustomElement = (dec: ts.Decorator): boolean => {
        try {
            return !!ELEMENT_DECORATOR.test(dec.getText());
        } catch (err) {
            // @ts-ignore
            return dec.expression.expression.escapedText === "customElement";
        }
    };
    return node?.kind === ts.SyntaxKind.ClassDeclaration && !!node.decorators?.some(dec => isCustomElement(dec));
};
