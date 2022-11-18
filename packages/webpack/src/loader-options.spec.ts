import { LoaderContext } from "webpack";
import { getLoaderOptions, PluginOptions } from "./loader-options";
import Upath from "./Upath";

describe("getLoaderOptions", () => {
    it("should yield default values w/ empty options", () => {
        const target = { getOptions: () => ({}) } as LoaderContext<PluginOptions>;

        const actual = getLoaderOptions(target);

        expect(actual).toEqual({
            config: Upath.resolve("./websmith.config.json"),
            transpileOnly: false,
            webpackTarget: "*",
        });
    });
});
