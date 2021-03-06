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
import { escapeMarkdown, parseMixins } from "./parse-mixins";

describe("parse sass stylesheet for mixins", () => {
    it("returns a list of mixin definitions", () => {
        const sass = `
/// Generates custom properties

@mixin variants($element, $origins: ()) {
    @include prop-variants(
        $element,
        $properties,
    );
}
`;
        const actual = parseMixins(sass);

        expect(actual).toStrictEqual([
            {
                description: "Generates custom properties",
                name: "@mixin variants()",
                parameters: ["element", "origins"],
                privacy: "public",
                type: "variants($element, $origins: ()) ",
            },
        ]);
    });
    it("ignores mixins without a description", () => {
        const sass = `
@mixin variants($element, $origins: ()) {
    @include prop-variants(
        $element,
        $properties,
    );
}
`;
        const actual = parseMixins(sass);

        expect(actual).toStrictEqual([]);
    });

    it("creates nicely formatted escaped description", () => {
        const sass = `
/// Generates custom properties for
/// element.
///
/// @param {List} $defaults (optional) List of value mappings.
/// @param $fallbacks List of value mappings injected before standard fallbacks.
///
/// @example Create element styling
///        \`\`\`scss
///        @include text.variants(--my-element);
///        \`\`\`

@mixin variants($defaults: (), $fallbacks: ()) {
}
`;
        const actual = parseMixins(sass);

        expect(actual[0].description).toEqual(
            "Generates custom properties for\nelement\\.\n\n" +
                "**@param** `{List} $defaults` \\(optional\\) List of value mappings\\.\n\n" +
                "**@param** `$fallbacks` List of value mappings injected before standard fallbacks\\.\n\n" +
                "**@example** Create element styling\n\n" +
                "```\n       @include text.variants(--my-element);\n```"
        );
    });
});

describe("escapeMarkdown", () => {
    it("escapes markdown special characters", () => {
        const specialChars = "`*_{}[]()#+-.!";
        const actual = escapeMarkdown(specialChars);

        expect(actual).toBe(specialChars.replace(/(.)/g, "\\$1"));
    });
    it("doesn't escape markdown non-special characters", () => {
        const nonSpecialCharacters = "abcABC123?%&@\"'";
        const actual = escapeMarkdown(nonSpecialCharacters);

        expect(actual).toBe(nonSpecialCharacters);
    });
    it("doesn't escape non-special characters in backticked blocks", () => {
        const actual = escapeMarkdown("*`*`*`*`*");

        expect(actual).toBe("\\*`*`\\*`*`\\*");
    });
});
