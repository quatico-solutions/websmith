import { type CompilerOptions } from "./CompilerOptions";
import { ResolvedCompilerOptions } from "./ResolvedCompilerOptions";
import { type WebpackLoaderOptions } from "./WebpackLoaderOptions";

export const resolveCompilerOptions = (
    options: CompilerOptions,
    addons?: string[],
    loaderOptions?: WebpackLoaderOptions
): ResolvedCompilerOptions => {
    return new ResolvedCompilerOptions(options, addons, loaderOptions);
};
