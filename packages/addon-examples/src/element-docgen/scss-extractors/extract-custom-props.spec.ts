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
/* eslint-disable jest/no-mocks-import */
import { ReporterMock } from "../../../../compiler/test";
import { createBrowserSystem } from "@websmith/compiler";
import {
    extractImportedStyles,
    customPropertyNameCompareFn,
    extractCssPropertiesFromStyleSheet,
    filterAndSortCssProperties,
} from "./extract-custom-props";

const reporter = new ReporterMock(createBrowserSystem({}));

describe("extractCssPropertiesFromStyleSheet", () => {
    it("extracts distinct properties matching tagName in alphabetical order", () => {
        const actual = extractCssPropertiesFromStyleSheet(
            "qs-alert",
            ".qs-alert {\nfont-family: var(--qs-alert__font-family, var(--qs-font-family, inherit));\nfont-family: var(--qs-alert__font-family, var(--qs-font-family, inherit));\ncolor: var(--qs-alert__font-color, var(--qs-font-color, inherit));\n}"
        );
        expect(actual).toStrictEqual(["--qs-alert__font-color", "--qs-alert__font-family"]);
    });
});

describe("filterAndSortCssProperties", () => {
    it("filters properties not starting with tag name", () => {
        const actual = filterAndSortCssProperties("qs-alert", ["--qs-alert__font-color", "--qs-text__font-family"]);
        expect(actual).toStrictEqual(["--qs-alert__font-color"]);
    });
    it("filters properties ending with internal state names", () => {
        const actual = filterAndSortCssProperties("qs-alert", [
            "--qs-alert__font-color--active",
            "--qs-alert__font-color--state",
            "--qs-alert__font-color--override",
            "--qs-alert__font-color--type",
        ]);
        expect(actual).toStrictEqual(["--qs-alert__font-color--active"]);
    });
    it("sorts style names alphabetical", () => {
        const actual = filterAndSortCssProperties("qs-alert", ["--qs-alert__color", "--qs-alert__border", "--qs-alert__font-size"]);
        expect(actual).toStrictEqual(["--qs-alert__border", "--qs-alert__color", "--qs-alert__font-size"]);
    });
});

describe("extractImportedStyles", () => {
    it("extracts empty string for declaration without content", () => {
        const input = '--PRE--importedStyles() { return ""; }--POST--';
        const actual = extractImportedStyles(input, "qs-pattern", "pattern.js", reporter);
        expect(actual).toBe("");
    });
    it("unescapes extracted text", () => {
        const input = 'importedStyles() { return "\\u00c4\\n\\""; }';
        const actual = extractImportedStyles(input, "qs-pattern", "pattern.js", reporter);
        expect(actual).toBe('Ä\n"');
    });
});

describe("customPropertyNameCompareFn", () => {
    const compProp = "--qs-comp__prop";
    const compPropState = "--qs-comp__prop--state";
    const compPropAlphabeticalFollowing = "--qs-comp__pros";
    const elemProp = "--qs-comp-elem__prop";
    const elemPropState = "--qs-comp-elem__prop--state";

    it("returns negative value when comparing compProp with compPropState", () => {
        const actual = customPropertyNameCompareFn(compProp, compPropState);
        expect(actual).toBeLessThan(0);
    });
    it("returns negative value when comparing propState with alphabetical following prop", () => {
        const actual = customPropertyNameCompareFn(compPropState, compPropAlphabeticalFollowing);
        expect(actual).toBeLessThan(0);
    });
    it("returns negative value when comparing alphabetical following prop with elemProp", () => {
        const actual = customPropertyNameCompareFn(compPropAlphabeticalFollowing, elemProp);
        expect(actual).toBeLessThan(0);
    });
    it("returns negative value when comparing elemProp with elemPropState", () => {
        const actual = customPropertyNameCompareFn(elemProp, elemPropState);
        expect(actual).toBeLessThan(0);
    });
    it("returns positive value when comparing elemPropState with compProp", () => {
        const actual = customPropertyNameCompareFn(elemPropState, compProp);
        expect(actual).toBeGreaterThan(0);
    });
});
