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
import * as fs from "fs";
import { ErrorMessage, Reporter, WarnMessage } from "../../model";
import { CssProperty, Mixin, Tag } from "./model";
import { extractCssProperties } from "./scss-extractors/extract-custom-props";

const IGNORED_STATES: string[] = ["override", "type", "state", "default", "value"];

export const transformTag = (tag: Tag, reporter: Reporter): Tag => {
    if (!tag.cssProperties) {
        tag.cssProperties = [];
    }
    const allowedCssProperties = extractCssProperties(tag.name, tag.path!, reporter);
    if (allowedCssProperties !== undefined) {
        transformCssProperties(tag.name, tag.cssProperties, allowedCssProperties, reporter);
    }
    return tag;
};

export const addMixins = (tag: Tag, mixins: Mixin[]) => {
    if (mixins.length > 0 && !tag.methods) {
        tag.methods = [];
    }
    mixins.forEach(mixin => {
        if (!tag.methods?.find(method => method.name === mixin.name)) {
            tag.methods?.push({
                description: `**Signature:** \`${mixin.type}\`\n\n${mixin.description}`,
                name: mixin.name,
                parameters: mixin.parameters,
                privacy: mixin.privacy,
            });
        }
    });
};

export const addCustomPropNames = (tag: Tag, customPropNames: string[], reporter: Reporter) => {
    if (!tag.cssProperties) {
        tag.cssProperties = [];
    }
    transformCssProperties(tag.name, tag.cssProperties, customPropNames, reporter);
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

export const extractStyleSheetFromJsFile = (tagName: string, path: string, reporter: Reporter): string | undefined => {
    if (!path) {
        return undefined;
    }

    const filePath = path.replace("src", "lib").replace(".ts", ".js");

    if (!fs.existsSync(filePath)) {
        reporter.reportDiagnostic(new ErrorMessage(`${tagName}: '${filePath}' does not exist.\n`));
        return undefined;
    }
    const script = fs.readFileSync(filePath, "utf8");
    return extractImportedStyles(script, tagName, filePath, reporter);
};

export const extractImportedStyles = (
    script: string,
    tagName: string,
    filePath: string,
    reporter: Reporter
): string | undefined => {
    const START_TAG = 'importedStyles() { return "';
    const END_TAG = '"; }';
    const stylesStart = script.indexOf(START_TAG);
    const stylesEnd = stylesStart >= 0 ? script.indexOf(END_TAG, stylesStart) : -1;
    if (stylesEnd >= 0) {
        // tslint:disable-next-line:no-eval
        return eval(`"${script.substring(stylesStart + START_TAG.length, stylesEnd)}"`);
    }
    reporter.reportDiagnostic(new ErrorMessage(`${tagName}: Error '${filePath}' does not contain styles.\n`));
    return undefined;
};

export const transformCssProperties = (
    tagName: string,
    cssProperties: CssProperty[],
    allowedProperties: string[],
    reporter: Reporter
): CssProperty[] => {
    const target: CssProperty[] = [];
    allowedProperties.forEach(property => {
        let found = false;
        for (let i = 0; i < cssProperties.length; i++) {
            const cssProperty = cssProperties[i];
            if (cssProperty.name === property) {
                target.push(cssProperty);
                if (!cssProperty.description) {
                    cssProperty.description = generateDescription(property, tagName);
                }
                if (!cssProperty.type) {
                    cssProperty.type = guessType(property);
                }
                cssProperties.splice(i, 1);
                found = true;
                break;
            }
        }
        if (!found) {
            target.push({
                description: generateDescription(property, tagName),
                name: property,
                type: guessType(property),
            });
        }
    });

    cssProperties.forEach(cssProperty => {
        reporter.reportWatchStatus(
            new WarnMessage(`${tagName}: JSDoc for [${cssProperty.name}] has no matching CSS property.\n`)
        );
    });

    // TODO: don't duplicated or non-existing css properties
    // cssProperties.splice(0, cssProperties.length);
    cssProperties.push(...target);

    return cssProperties;
};

export const generateDescription = (property: string, tagName: string) => {
    let elemName = "";
    let childName = "";
    let childPart = "";
    let elemSelector = "";
    let propName = "";
    let stateName = "";

    const elemPos = tagName.indexOf("-");
    if (elemPos >= 0) {
        elemName = tagName.substring(elemPos + 1);
    } else {
        elemName = tagName;
    }

    const propAfterCompName = property.substring(2 + tagName.length);
    const propNamePos = propAfterCompName.indexOf("__");
    if (propNamePos > 0) {
        childPart = propAfterCompName.substring(0, propNamePos);
    }

    const elemSelectorPos = childPart.lastIndexOf("-is-");
    if (elemSelectorPos >= 0) {
        elemSelector = childPart.substring(elemSelectorPos + 4);
        if (elemSelectorPos > 0) {
            childName = childPart.substring(1, elemSelectorPos);
        }
    } else if (childPart.length > 0) {
        childName = childPart.substring(1);
    }

    propName = propAfterCompName.substring(propNamePos + 2);
    const stateNamePos = propName.indexOf("--");
    if (stateNamePos > 0) {
        stateName = propName.substring(stateNamePos + 2);
        propName = propName.substring(0, stateNamePos);
    }
    if (propName.length > 0) {
        propName = propName.charAt(0).toUpperCase() + propName.substring(1);
    }

    return `**${propName}** style of the ${elemSelector ? `**${elemSelector}** ` : ``}${elemName} element${
        childName ? `'s **${childName}**` : ""
    }${stateName ? ` in **${stateName}** state` : ``}.`;
};

const guessType = (propertyName: string): string | undefined => {
    if (["background", "color"].reduce((result, cur) => result || propertyName.includes(cur), false)) {
        return "Color";
    }
    return undefined;
};
