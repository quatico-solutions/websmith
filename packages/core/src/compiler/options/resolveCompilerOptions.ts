import type ts from "typescript";
import { type CompilerOptions } from "./CompilerOptions";
import { ResolvedCompilerOptions } from "./ResolvedCompilerOptions";
import { type WebpackLoaderOptions } from "./WebpackLoaderOptions";

export const resolveCompilerOptions = (
    system: ts.System,
    options: CompilerOptions,
    addons?: string[],
    loaderOptions?: WebpackLoaderOptions
): ResolvedCompilerOptions => {
    return new ResolvedCompilerOptions(system, options, addons, loaderOptions);
};
