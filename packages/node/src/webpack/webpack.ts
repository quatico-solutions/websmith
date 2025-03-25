import { type WebpackLoaderOptions } from "@quatico/websmith-core";
import { type LoaderOptions as TsLoaderOptions } from "ts-loader/dist/interfaces";
import { type Configuration } from "webpack";
import { WebpackBuild } from "./WebpackBuild";
import { type IFs } from "memfs";

export const webpack = async (
    entries?: string[],
    config?: {
        webpack?: Configuration;
        tsLoader?: Partial<TsLoaderOptions>;
        websmith?: WebpackLoaderOptions;
        outputFileSystem?: IFs;
    }
): Promise<string> => {
    const { webpack, tsLoader, websmith, outputFileSystem } = config ?? {};
    const build = new WebpackBuild(webpack).setTsLoaderOptions(tsLoader).setWebsmithLoaderOptions(websmith);
    if (outputFileSystem) {
        build.setOutputFileSystem(outputFileSystem);
    }
    return await build.build(entries);
};
