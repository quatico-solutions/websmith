/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { LoaderContext } from "webpack";
import { getLoaderOptions, WebsmithLoaderConfig } from "./loader-options";

describe("getLoaderOptions", () => {
    it("should yield default values w/ empty options", () => {
        const target = { getOptions: () => ({}) } as LoaderContext<WebsmithLoaderConfig>;

        const actual = getLoaderOptions(target);

        expect(actual).toEqual({
            webpackTarget: "*",
        });
    });
});
