/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type LoaderContext } from "webpack";
import { getLoaderOptions } from "./loader-options";
import { createOptions } from "./options";
import { type WebsmithLoaderConfig } from "./WebsmithLoaderConfig";

describe("getLoaderOptions", () => {
    it("should yield defaults w/ empty options", () => {
        const expected = createOptions({ instanceName: "target-instance" });
        const target = { getOptions: () => ({}) } as LoaderContext<WebsmithLoaderConfig>;

        const actual = getLoaderOptions(target);

        expect(actual).toMatchObject(expected);
    });

    it("should yield default values w/ empty options", () => {
        const target = { getOptions: () => ({}) } as LoaderContext<WebsmithLoaderConfig>;

        const actual = getLoaderOptions(target);

        expect(actual).toMatchObject({
            debug: false,
            targets: [],
            watch: false,
        });
    });
});
