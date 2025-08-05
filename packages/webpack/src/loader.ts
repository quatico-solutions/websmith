/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type LoaderContext } from "webpack";
import { type CompilationQueue } from "./CompilationQueue";
import { getCompilerInstance } from "./compiler-instances";
import { getLoaderOptions } from "./loader-options";
import { processResultAndFinish } from "./result-handling";
import { type TsCompiler } from "./TsCompiler";
import { type WebsmithLoaderConfig } from "./WebsmithLoaderConfig";

export type WebpackLoaderContext = {
    dependencyCallback?: (filePath: string) => void;
    websmithCompiler: TsCompiler;
    queue: CompilationQueue;
};

export function loader(this: LoaderContext<WebsmithLoaderConfig>): void {
    this.cacheable?.();
    const options = getLoaderOptions(this);
    const instance = getCompilerInstance(options, this, (path: string) => {
        this.addDependency(path);
    });

    const fragment = instance.build(this.resourcePath);

    // Set loader version based on the file's cache version to enable proper cache invalidation
    // This ensures webpack knows when to recompile based on source file changes
    this.version = fragment.version;

    processResultAndFinish(this, fragment, instance.getProfile());
}
