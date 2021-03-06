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
import { Node } from "scss-parser";
import {
    isNameEnd,
    isNamePart,
    isNameStart,
    parseCustomPropertyNames,
    parseNodeValue,
} from "./parse-custom-prop-names";

describe("parseCustomPropertyNames with stylesheet", () => {
    it("returns empty array with empty string", () => {
        const actual = parseCustomPropertyNames("");

        expect(actual).toEqual([]);
    });

    it("returns empty array with no custom properties", () => {
        const actual = parseCustomPropertyNames(".my-element { display: none; }");

        expect(actual).toEqual([]);
    });

    it("returns empty array with no custom properties", () => {
        const actual = parseCustomPropertyNames(".my-element { display: none; }");

        expect(actual).toEqual([]);
    });

    it("returns variables with complete properties", () => {
        const input = `@charset \"UTF-8\";\n\n\n\n\n\n\n:host {\ndisplay: block;\n}\n\n.qs-alert {\ncolor: var(--qs-alert__font-color, var(--qs-font-color, inherit));\nfont-family: var(--qs-alert__font-family, var(--qs-font-family, inherit));\nfont-size: var(--qs-alert__font-size, var(--qs-font-size, inherit));\nfont-style: var(--qs-alert__font-style, var(--qs-font-style, inherit));\nfont-weight: var(--qs-alert__font-weight, var(--qs-font-weight, inherit));\nline-height: var(--qs-alert__line-height, var(--qs-line-height, inherit));\nletter-spacing: var(--qs-alert__letter-spacing, var(--qs-letter-spacing, inherit));\n--qs-alert__bezel--default: var(--qs-alert__bezel--type, var(--qs-alert__bezel, var(--qs-bezel, 20px)));\npadding-left: var(--qs-alert__bezel-x-start--type, var(--qs-alert__bezel-x-start, var(--qs-alert__bezel-x, var(--qs-alert__bezel--default))));\npadding-inline-start: var(--qs-alert__bezel-x-start--type, var(--qs-alert__bezel-x-start, var(--qs-alert__bezel-x, var(--qs-alert__bezel--default))));\npadding-right: var(--qs-alert__bezel-x-end--type, var(--qs-alert__bezel-x-end, var(--qs-alert__bezel-x, var(--qs-alert__bezel--default))));\npadding-inline-end: var(--qs-alert__bezel-x-end--type, var(--qs-alert__bezel-x-end, var(--qs-alert__bezel-x, var(--qs-alert__bezel--default))));\npadding-top: var(--qs-alert__bezel-y-start--type, var(--qs-alert__bezel-y-start, var(--qs-alert__bezel-y, var(--qs-alert__bezel--default))));\npadding-block-start: var(--qs-alert__bezel-y-start--type, var(--qs-alert__bezel-y-start, var(--qs-alert__bezel-y, var(--qs-alert__bezel--default))));\npadding-bottom: var(--qs-alert__bezel-y-end--type, var(--qs-alert__bezel-y-end, var(--qs-alert__bezel-y, var(--qs-alert__bezel--default))));\npadding-block-end: var(--qs-alert__bezel-y-end--type, var(--qs-alert__bezel-y-end, var(--qs-alert__bezel-y, var(--qs-alert__bezel--default))));\n--qs-alert__border--default: var(--qs-alert__border--type, var(--qs-alert__border, var(--qs-border, none)));\nborder-left: var(--qs-alert__border-x-start--type, var(--qs-alert__border-x-start, var(--qs-alert__border-x, var(--qs-alert__border--default))));\nborder-inline-start: var(--qs-alert__border-x-start--type, var(--qs-alert__border-x-start, var(--qs-alert__border-x, var(--qs-alert__border--default))));\nborder-right: var(--qs-alert__border-x-end--type, var(--qs-alert__border-x-end, var(--qs-alert__border-x, var(--qs-alert__border--default))));\nborder-inline-end: var(--qs-alert__border-x-end--type, var(--qs-alert__border-x-end, var(--qs-alert__border-x, var(--qs-alert__border--default))));\nborder-top: var(--qs-alert__border-y-start--type, var(--qs-alert__border-y-start, var(--qs-alert__border-y, var(--qs-alert__border--default))));\nborder-block-start: var(--qs-alert__border-y-start--type, var(--qs-alert__border-y-start, var(--qs-alert__border-y, var(--qs-alert__border--default))));\nborder-bottom: var(--qs-alert__border-y-end--type, var(--qs-alert__border-y-end, var(--qs-alert__border-y, var(--qs-alert__border--default))));\nborder-block-end: var(--qs-alert__border-y-end--type, var(--qs-alert__border-y-end, var(--qs-alert__border-y, var(--qs-alert__border--default))));\nbackground: var(--qs-alert__background--type, var(--qs-alert__background, var(--qs-color-background, initial)));\nborder-radius: var(--qs-alert__border-radius--type, var(--qs-alert__border-radius, var(--qs-border-radius, initial)));\nbox-shadow: var(--qs-alert__box-shadow--type, var(--qs-alert__box-shadow, var(--qs-box-shadow, initial)));\noutline: var(--qs-alert__outline--type, var(--qs-alert__outline, var(--qs-outline, initial)));\nbox-sizing: border-box;\nheight: 100%;\nposition: relative;\n}\n.qs-alert--closed {\ndisplay: none;\n}\n.qs-alert--info {\n--qs-alert__bezel--type: var(--qs-alert-is-info__bezel);\n--qs-alert__bezel-x-start--type: var(--qs-alert-is-info__bezel-x-start);\n--qs-alert__bezel-x-end--type: var(--qs-alert-is-info__bezel-x-end);\n--qs-alert__bezel-y-start--type: var(--qs-alert-is-info__bezel-y-start);\n--qs-alert__bezel-y-end--type: var(--qs-alert-is-info__bezel-y-end);\n--qs-alert__border--type: var(--qs-alert-is-info__border);\n--qs-alert__border-x-start--type: var(--qs-alert-is-info__border-x-start);\n--qs-alert__border-x-end--type: var(--qs-alert-is-info__border-x-end);\n--qs-alert__border-y-start--type: var(--qs-alert-is-info__border-y-start);\n--qs-alert__border-y-end--type: var(--qs-alert-is-info__border-y-end);\n--qs-alert__background--type: var(--qs-alert-is-info__background, var(--qs-color-info--light));\n--qs-alert__border-radius--type: var(--qs-alert-is-info__border-radius);\n--qs-alert__box-shadow--type: var(--qs-alert-is-info__box-shadow);\n--qs-alert__outline--type: var(--qs-alert-is-info__outline);\n}\n.qs-alert--success {\n--qs-alert__bezel--type: var(--qs-alert-is-success__bezel);\n--qs-alert__bezel-x-start--type: var(--qs-alert-is-success__bezel-x-start);\n--qs-alert__bezel-x-end--type: var(--qs-alert-is-success__bezel-x-end);\n--qs-alert__bezel-y-start--type: var(--qs-alert-is-success__bezel-y-start);\n--qs-alert__bezel-y-end--type: var(--qs-alert-is-success__bezel-y-end);\n--qs-alert__border--type: var(--qs-alert-is-success__border);\n--qs-alert__border-x-start--type: var(--qs-alert-is-success__border-x-start);\n--qs-alert__border-x-end--type: var(--qs-alert-is-success__border-x-end);\n--qs-alert__border-y-start--type: var(--qs-alert-is-success__border-y-start);\n--qs-alert__border-y-end--type: var(--qs-alert-is-success__border-y-end);\n--qs-alert__background--type: var(--qs-alert-is-success__background, var(--qs-color-success--light));\n--qs-alert__border-radius--type: var(--qs-alert-is-success__border-radius);\n--qs-alert__box-shadow--type: var(--qs-alert-is-success__box-shadow);\n--qs-alert__outline--type: var(--qs-alert-is-success__outline);\n}\n.qs-alert--warning {\n--qs-alert__bezel--type: var(--qs-alert-is-warning__bezel);\n--qs-alert__bezel-x-start--type: var(--qs-alert-is-warning__bezel-x-start);\n--qs-alert__bezel-x-end--type: var(--qs-alert-is-warning__bezel-x-end);\n--qs-alert__bezel-y-start--type: var(--qs-alert-is-warning__bezel-y-start);\n--qs-alert__bezel-y-end--type: var(--qs-alert-is-warning__bezel-y-end);\n--qs-alert__border--type: var(--qs-alert-is-warning__border);\n--qs-alert__border-x-start--type: var(--qs-alert-is-warning__border-x-start);\n--qs-alert__border-x-end--type: var(--qs-alert-is-warning__border-x-end);\n--qs-alert__border-y-start--type: var(--qs-alert-is-warning__border-y-start);\n--qs-alert__border-y-end--type: var(--qs-alert-is-warning__border-y-end);\n--qs-alert__background--type: var(--qs-alert-is-warning__background, var(--qs-color-warning--light));\n--qs-alert__border-radius--type: var(--qs-alert-is-warning__border-radius);\n--qs-alert__box-shadow--type: var(--qs-alert-is-warning__box-shadow);\n--qs-alert__outline--type: var(--qs-alert-is-warning__outline);\n}\n.qs-alert--error {\n--qs-alert__bezel--type: var(--qs-alert-is-error__bezel);\n--qs-alert__bezel-x-start--type: var(--qs-alert-is-error__bezel-x-start);\n--qs-alert__bezel-x-end--type: var(--qs-alert-is-error__bezel-x-end);\n--qs-alert__bezel-y-start--type: var(--qs-alert-is-error__bezel-y-start);\n--qs-alert__bezel-y-end--type: var(--qs-alert-is-error__bezel-y-end);\n--qs-alert__border--type: var(--qs-alert-is-error__border);\n--qs-alert__border-x-start--type: var(--qs-alert-is-error__border-x-start);\n--qs-alert__border-x-end--type: var(--qs-alert-is-error__border-x-end);\n--qs-alert__border-y-start--type: var(--qs-alert-is-error__border-y-start);\n--qs-alert__border-y-end--type: var(--qs-alert-is-error__border-y-end);\n--qs-alert__background--type: var(--qs-alert-is-error__background, var(--qs-color-error--light));\n--qs-alert__border-radius--type: var(--qs-alert-is-error__border-radius);\n--qs-alert__box-shadow--type: var(--qs-alert-is-error__box-shadow);\n--qs-alert__outline--type: var(--qs-alert-is-error__outline);\n}\n.qs-alert__close-button {\nposition: absolute;\ntop: var(--qs-alert-close-button__position-top, 10px);\nright: var(--qs-alert-close-button__position-right, 10px);\n}`;

        const actual = parseCustomPropertyNames(input);

        expect(actual).toEqual([
            "--qs-alert__font-color",
            "--qs-font-color",
            "--qs-alert__font-family",
            "--qs-font-family",
            "--qs-alert__font-size",
            "--qs-font-size",
            "--qs-alert__font-style",
            "--qs-font-style",
            "--qs-alert__font-weight",
            "--qs-font-weight",
            "--qs-alert__line-height",
            "--qs-line-height",
            "--qs-alert__letter-spacing",
            "--qs-letter-spacing",
            "--qs-alert__bezel--default",
            "--qs-alert__bezel--type",
            "--qs-alert__bezel",
            "--qs-bezel",
            "--qs-alert__bezel-x-start--type",
            "--qs-alert__bezel-x-start",
            "--qs-alert__bezel-x",
            "--qs-alert__bezel-x-end--type",
            "--qs-alert__bezel-x-end",
            "--qs-alert__bezel-y-start--type",
            "--qs-alert__bezel-y-start",
            "--qs-alert__bezel-y",
            "--qs-alert__bezel-y-end--type",
            "--qs-alert__bezel-y-end",
            "--qs-alert__border--default",
            "--qs-alert__border--type",
            "--qs-alert__border",
            "--qs-border",
            "--qs-alert__border-x-start--type",
            "--qs-alert__border-x-start",
            "--qs-alert__border-x",
            "--qs-alert__border-x-end--type",
            "--qs-alert__border-x-end",
            "--qs-alert__border-y-start--type",
            "--qs-alert__border-y-start",
            "--qs-alert__border-y",
            "--qs-alert__border-y-end--type",
            "--qs-alert__border-y-end",
            "--qs-alert__background--type",
            "--qs-alert__background",
            "--qs-color-background",
            "--qs-alert__border-radius--type",
            "--qs-alert__border-radius",
            "--qs-border-radius",
            "--qs-alert__box-shadow--type",
            "--qs-alert__box-shadow",
            "--qs-box-shadow",
            "--qs-alert__outline--type",
            "--qs-alert__outline",
            "--qs-outline",
            "--qs-alert-is-info__bezel",
            "--qs-alert-is-info__bezel-x-start",
            "--qs-alert-is-info__bezel-x-end",
            "--qs-alert-is-info__bezel-y-start",
            "--qs-alert-is-info__bezel-y-end",
            "--qs-alert-is-info__border",
            "--qs-alert-is-info__border-x-start",
            "--qs-alert-is-info__border-x-end",
            "--qs-alert-is-info__border-y-start",
            "--qs-alert-is-info__border-y-end",
            "--qs-alert-is-info__background",
            "--qs-color-info--light",
            "--qs-alert-is-info__border-radius",
            "--qs-alert-is-info__box-shadow",
            "--qs-alert-is-info__outline",
            "--qs-alert-is-success__bezel",
            "--qs-alert-is-success__bezel-x-start",
            "--qs-alert-is-success__bezel-x-end",
            "--qs-alert-is-success__bezel-y-start",
            "--qs-alert-is-success__bezel-y-end",
            "--qs-alert-is-success__border",
            "--qs-alert-is-success__border-x-start",
            "--qs-alert-is-success__border-x-end",
            "--qs-alert-is-success__border-y-start",
            "--qs-alert-is-success__border-y-end",
            "--qs-alert-is-success__background",
            "--qs-color-success--light",
            "--qs-alert-is-success__border-radius",
            "--qs-alert-is-success__box-shadow",
            "--qs-alert-is-success__outline",
            "--qs-alert-is-warning__bezel",
            "--qs-alert-is-warning__bezel-x-start",
            "--qs-alert-is-warning__bezel-x-end",
            "--qs-alert-is-warning__bezel-y-start",
            "--qs-alert-is-warning__bezel-y-end",
            "--qs-alert-is-warning__border",
            "--qs-alert-is-warning__border-x-start",
            "--qs-alert-is-warning__border-x-end",
            "--qs-alert-is-warning__border-y-start",
            "--qs-alert-is-warning__border-y-end",
            "--qs-alert-is-warning__background",
            "--qs-color-warning--light",
            "--qs-alert-is-warning__border-radius",
            "--qs-alert-is-warning__box-shadow",
            "--qs-alert-is-warning__outline",
            "--qs-alert-is-error__bezel",
            "--qs-alert-is-error__bezel-x-start",
            "--qs-alert-is-error__bezel-x-end",
            "--qs-alert-is-error__bezel-y-start",
            "--qs-alert-is-error__bezel-y-end",
            "--qs-alert-is-error__border",
            "--qs-alert-is-error__border-x-start",
            "--qs-alert-is-error__border-x-end",
            "--qs-alert-is-error__border-y-start",
            "--qs-alert-is-error__border-y-end",
            "--qs-alert-is-error__background",
            "--qs-color-error--light",
            "--qs-alert-is-error__border-radius",
            "--qs-alert-is-error__box-shadow",
            "--qs-alert-is-error__outline",
            "--qs-alert-close-button__position-top",
            "--qs-alert-close-button__position-right",
        ]);
    });
});

describe("parseCustomPropertyNames with declaration", () => {
    it("returns names with custom property declaration", () => {
        const actual = parseCustomPropertyNames(".my-element { --my-expected: none; }");

        expect(actual).toEqual(["--my-expected"]);
    });

    it("returns names with custom property declaration and '__' in name", () => {
        const actual = parseCustomPropertyNames(".my-element { --my-expected__prop: none; }");

        expect(actual).toEqual(["--my-expected__prop"]);
    });

    it("returns names with custom properties in declaration and value", () => {
        const actual = parseCustomPropertyNames(
            ".my-element { --qs-alert__border-radius--type: var(--qs-alert__border-radius--one); }"
        );

        expect(actual).toEqual(["--qs-alert__border-radius--type", "--qs-alert__border-radius--one"]);
    });

    it("returns names with custom properties in declaration and value of same", () => {
        const actual = parseCustomPropertyNames(
            `.my-one { --qs-alert__outline--type: var(--qs-alert-is-info__outline); }
             .my-two { outline: var(--qs-alert__outline--type, var(--qs-alert__outline, var(--qs-outline, initial))); }`
        );

        expect(actual).toEqual([
            "--qs-alert__outline--type",
            "--qs-alert-is-info__outline",
            "--qs-alert__outline",
            "--qs-outline",
        ]);
    });

    it("returns names with composed custom properties in declaration and value", () => {
        const actual = parseCustomPropertyNames(
            ".my-element { --my-expected-one: 2px solid var(--my-expected-two, var(--my-expected-three, white)); }"
        );

        expect(actual).toEqual(["--my-expected-one", "--my-expected-two", "--my-expected-three"]);
    });

    it("returns names with composed custom properties in declaration and value with '--' in name", () => {
        const actual = parseCustomPropertyNames(
            ".my-element { --my-expected--one: 2px solid var(--my-expected--two, var(--my-expected--three, white)); }"
        );

        expect(actual).toEqual(["--my-expected--one", "--my-expected--two", "--my-expected--three"]);
    });
});

describe("parseCustomPropertyNames with var arguments", () => {
    it("returns names with one custom property as value", () => {
        const actual = parseCustomPropertyNames(".my-element { display: var(--my-expected); }");

        expect(actual).toEqual(["--my-expected"]);
    });

    it("returns names with one custom property as value with fallback", () => {
        const actual = parseCustomPropertyNames(".my-element { display: var(--my-expected, 0); }");

        expect(actual).toEqual(["--my-expected"]);
    });

    it("returns names with one custom property as value with illegal space", () => {
        const actual = parseCustomPropertyNames(".my-element { display: var(--my-expected , 0); }");

        expect(actual).toEqual(["--my-expected"]);
    });

    it("returns names with one custom property as value with % value", () => {
        const actual = parseCustomPropertyNames(".my-element { width: var(--my-expected, 100%); }");

        expect(actual).toEqual(["--my-expected"]);
    });

    it("returns names with one custom property as value with '--' in name", () => {
        const actual = parseCustomPropertyNames(".my-element { width: var(--my-expected--type); }");

        expect(actual).toEqual(["--my-expected--type"]);
    });

    it("returns names with composed custom property as value", () => {
        const actual = parseCustomPropertyNames(
            ".my-element { border: var(--my-expected-one) solid var(--my-expected-two, var(--my-expected-three, white)); }"
        );

        expect(actual).toEqual(["--my-expected-one", "--my-expected-two", "--my-expected-three"]);
    });

    it("returns names with multiple custom properties as value", () => {
        const actual = parseCustomPropertyNames(
            ".my-element { display: var(--my-expected-one, var(--my-expected-two, var(--my-expected-three, none))); }"
        );

        expect(actual).toEqual(["--my-expected-one", "--my-expected-two", "--my-expected-three"]);
    });
});

describe("parseCustomPropertyNames with calc arguments", () => {
    it("returns names with one custom property as value", () => {
        const actual = parseCustomPropertyNames(".my-element { display: calc(var(--my-expected) - 2px); }");

        expect(actual).toEqual(["--my-expected"]);
    });

    it("returns names with one custom property as value and fallback", () => {
        const actual = parseCustomPropertyNames(".my-element { display: calc(var(--my-expected, 0) - 2px); }");

        expect(actual).toEqual(["--my-expected"]);
    });

    it("returns names with one custom property as value and illegal space", () => {
        const actual = parseCustomPropertyNames(".my-element { display: calc(var(--my-expected , 0) - 2px); }");

        expect(actual).toEqual(["--my-expected"]);
    });

    it("returns names with multiple custom properties as value", () => {
        const actual = parseCustomPropertyNames(
            ".my-element { display: calc(var(--my-expected-one, var(--my-expected-two, calc(var(--my-expected-three, 10rem) - 2px)), 0) - 2px); }"
        );

        expect(actual).toEqual(["--my-expected-one", "--my-expected-two", "--my-expected-three"]);
    });
});

describe("parseCustomPropertyNames with declaration", () => {
    it("returns names with one custom property declaration", () => {
        const actual = parseCustomPropertyNames(".my-element { --my-expected: 100%; }");

        expect(actual).toEqual(["--my-expected"]);
    });

    it("returns names with one custom property declaration with '--' in name", () => {
        const actual = parseCustomPropertyNames(".my-element { --my-expected--one: 100%; }");

        expect(actual).toEqual(["--my-expected--one"]);
    });

    it("returns names with three custom properties in one declaration", () => {
        const actual = parseCustomPropertyNames(
            ".my-element { --expected--one: var(--expected--two, var(--expected--three, var(--expected--four, 20px))); }"
        );

        expect(actual).toEqual(["--expected--one", "--expected--two", "--expected--three", "--expected--four"]);
    });
});

describe("parseNodeValue", () => {
    it("returns empty string with empty string and no prevValues", () => {
        const target = {
            value: "",
        } as Node;

        expect(parseNodeValue(target, [])).toEqual([""]);
    });

    it("returns empty string with value empty string and empty string prevValues", () => {
        const target = {
            value: "",
        } as Node;

        expect(parseNodeValue(target, [""])).toEqual([""]);
    });

    it("returns node value with 'minus' operator node and no prevValues", () => {
        const target = {
            type: "operator",
            value: "-",
        } as Node;

        expect(parseNodeValue(target, [])).toEqual(["-"]);
    });

    it("returns empty string with 'minus' operator node and some preValues", () => {
        const target = {
            type: "operator",
            value: "-",
        } as Node;

        expect(parseNodeValue(target, ["whatever"])).toEqual([""]);
    });

    it("returns namePart + node value with identifier node and '--'", () => {
        const target = {
            type: "identifier",
            value: "expected",
        } as Node;

        expect(parseNodeValue(target, ["--"])).toEqual(["--expected"]);
    });

    it("returns namePart + node value with operator node and '-'", () => {
        const target = {
            type: "operator",
            value: "-",
        } as Node;

        expect(parseNodeValue(target, ["-"])).toEqual(["--"]);
    });

    it("returns namePart + node value with operator node and ''", () => {
        const target = {
            type: "operator",
            value: "-",
        } as Node;

        expect(parseNodeValue(target, [""])).toEqual(["-"]);
    });

    it("returns namePart and '' with parentheses node and non-empty string", () => {
        const target = {
            type: "parentheses",
            value: "(",
        } as Node;

        expect(parseNodeValue(target, ["--expected"])).toEqual(["--expected", ""]);
    });

    it("returns namePart and '' with punctuation node and non-empty string", () => {
        const target = {
            type: "punctuation",
            value: ".",
        } as Node;

        expect(parseNodeValue(target, ["--expected"])).toEqual(["--expected", ""]);
    });

    it("returns namePart and '' with space node and non-empty string", () => {
        const target = {
            type: "space",
            value: " ",
        } as Node;

        expect(parseNodeValue(target, ["--expected"])).toEqual(["--expected", ""]);
    });

    it("returns child nodes with non-string value", () => {
        const target = {
            type: "whatever",
            value: [
                {
                    type: "parentheses",
                    value: "(",
                },
            ],
        } as Node;

        expect(parseNodeValue(target, ["--expected"])).toEqual(["--expected"]);
    });

    it("returns child nodes with non-string value", () => {
        const target = {
            type: "whatever",
            value: [
                {
                    type: "parentheses",
                    value: "(",
                },
            ],
        } as Node;

        expect(parseNodeValue(target, ["--expected"])).toEqual(["--expected"]);
    });

    it("returns prevValues with no value", () => {
        const target = {
            type: "whatever",
        } as Node;

        expect(parseNodeValue(target, ["--expected"])).toEqual(["--expected"]);
    });
});

describe("isNamePart", () => {
    it('returns true with type "identifier" and namePart "--"', () => {
        const target = {
            type: "identifier",
        } as Node;

        expect(isNamePart(target, "--")).toBe(true);
    });

    it('returns true with minus "operator" and namePart "-"', () => {
        const target = {
            type: "operator",
            value: "-",
        } as Node;

        expect(isNamePart(target, "-")).toBe(true);
    });

    it('returns true with minus "operator" and empty namePart', () => {
        const target = {
            type: "operator",
            value: "-",
        } as Node;

        expect(isNamePart(target, "")).toBe(true);
    });

    it('returns false with type "operator" and namePart "-"', () => {
        const target = {
            type: "operator",
        } as Node;

        expect(isNamePart(target, "--")).toBe(false);
    });

    it('returns false with type "OTHER" and namePart "-"', () => {
        const target = {
            type: "OTHER",
        } as Node;

        expect(isNamePart(target, "--")).toBe(false);
    });
});

describe("isNameStart", () => {
    it('returns true with type "operator", value "-" and empty namePart', () => {
        const target = {
            type: "operator",
            value: "-",
        } as Node;

        expect(isNameStart(target, "")).toBe(true);
    });

    it('returns false with type "operator", value "--" and empty namePart', () => {
        const target = {
            type: "operator",
            value: "--",
        } as Node;

        expect(isNameStart(target, "")).toBe(false);
    });

    it('returns false with type "operator", value "-" and non-empty namePart', () => {
        const target = {
            type: "operator",
            value: "-",
        } as Node;

        expect(isNameStart(target, "whatever")).toBe(false);
    });

    it('returns false with type "OTHER", value "-" and empty namePart', () => {
        const target = {
            type: "OTHER",
            value: "-",
        } as Node;

        expect(isNameStart(target, "")).toBe(false);
    });
});

describe("isNameEnd", () => {
    it('returns true with type "parentheses" and non-empty namePart', () => {
        const target = {
            type: "parentheses",
        } as Node;

        expect(isNameEnd(target, "whatever")).toBe(true);
    });

    it('returns true with type "punctuation" and non-empty namePart', () => {
        const target = {
            type: "punctuation",
        } as Node;

        expect(isNameEnd(target, "whatever")).toBe(true);
    });

    it('returns true with type "punctuation" and non-empty namePart', () => {
        const target = {
            type: "punctuation",
        } as Node;

        expect(isNameEnd(target, "whatever")).toBe(true);
    });

    it('returns true with type "space" and non-empty namePart', () => {
        const target = {
            type: "space",
        } as Node;

        expect(isNameEnd(target, "whatever")).toBe(true);
    });

    it('returns false with type "space" and empty namePart', () => {
        const target = {
            type: "space",
        } as Node;

        expect(isNameEnd(target, "")).toBe(false);
    });

    it('returns false with type "OTHER" and non-empty namePart', () => {
        const target = {
            type: "OTHER",
        } as Node;

        expect(isNameEnd(target, "whatever")).toBe(false);
    });
});
