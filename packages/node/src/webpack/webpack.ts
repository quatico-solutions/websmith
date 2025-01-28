import { type LoaderOptions as TsLoaderOptions } from "ts-loader/dist/interfaces";
import { type Configuration } from "webpack";
import { WebpackBuild, type WebsmithLoaderOptions } from "./WebpackBuild";
export const webpack = async (
    entries?: string[],
    config?: {
        webpack?: Configuration;
        tsLoader?: Partial<TsLoaderOptions>;
        websmith?: WebsmithLoaderOptions;
    }
): Promise<string> => {
    const { webpack, tsLoader, websmith } = config ?? {};
    return await new WebpackBuild(webpack).setTsLoaderOptions(tsLoader).setWebsmithLoaderOptions(websmith).build(entries);
};
