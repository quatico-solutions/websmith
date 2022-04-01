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
import { ErrorMessage, Reporter } from "../../../model";
import { parseCustomPropertyNames } from "../scss-parsers/parse-custom-prop-names";

const IGNORED_STATES: string[] = ["override", "type", "state", "default", "value"];

export const extractCssProperties = (tagName: string, path: string, reporter: Reporter, system: ts.System): string[] | undefined => {
    return extractCssPropertiesFromStyleSheet(tagName, extractStyleSheetFromJsFile(tagName, path, reporter, system));
};

export const extractCssPropertiesFromStyleSheet = (tagName: string, css?: string): string[] | undefined => {
    return css ? filterAndSortCssProperties(tagName, parseCustomPropertyNames(css)) : undefined;
};

export const filterAndSortCssProperties = (tagName: string, cssProperties: string[]) => {
    return cssProperties
        .filter(
            propertyName =>
                propertyName.startsWith("--" + tagName) &&
                propertyName.indexOf("__") >= 0 &&
                !IGNORED_STATES.some(suffix => propertyName.endsWith("--" + suffix))
        )
        .filter((value, index, self) => self.indexOf(value) === index)
        .sort(customPropertyNameCompareFn);
};

export const customPropertyNameCompareFn = (propNameA: string, propNameB: string): number => {
    return propNameA.replace(/_/g, "+") < propNameB.replace(/_/g, "+") ? -1 : 1;
};

export const extractStyleSheetFromJsFile = (tagName: string, path: string, reporter: Reporter, system: ts.System): string | undefined => {
    if (!path) {
        return undefined;
    }

    const filePath = path.replace("src", "lib").replace(".ts", ".js");

    if (!system.fileExists(filePath)) {
        reporter.reportDiagnostic(new ErrorMessage(`${tagName}: '${filePath}' does not exist.\n`));
        return undefined;
    }
    const script = system.readFile(filePath) ?? "";
    return extractImportedStyles(script, tagName, filePath, reporter);
};

export const extractImportedStyles = (script: string, tagName: string, filePath: string, reporter: Reporter): string | undefined => {
    const START_TAG = 'importedStyles() { return "';
    const END_TAG = '"; }';
    const stylesStart = script.indexOf(START_TAG);
    const stylesEnd = stylesStart >= 0 ? script.indexOf(END_TAG, stylesStart) : -1;
    if (stylesEnd >= 0) {
        return eval(`"${script.substring(stylesStart + START_TAG.length, stylesEnd)}"`);
    }
    reporter.reportDiagnostic(new ErrorMessage(`${tagName}: Error '${filePath}' does not contain styles.\n`));
    return undefined;
};
