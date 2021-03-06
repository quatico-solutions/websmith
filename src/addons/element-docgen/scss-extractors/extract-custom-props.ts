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
import { Reporter } from "../../../model";
import { extractStyleSheetFromJsFile } from "../docgen";
import { parseCustomPropertyNames } from "../scss-parsers/parse-custom-prop-names";

const IGNORED_STATES: string[] = ["override", "type", "state", "default", "value"];

export const extractCssProperties = (tagName: string, path: string, reporter: Reporter): string[] | undefined => {
    return extractCssPropertiesFromStyleSheet(tagName, extractStyleSheetFromJsFile(tagName, path, reporter));
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
