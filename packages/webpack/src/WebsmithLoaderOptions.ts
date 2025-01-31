import type { CompilationConfig } from "@quatico/websmith-core";
import type ts from "typescript";

export interface WebsmithLoaderOptions {
    addons?: string[];
    addonsDir?: string;
    buildDir?: string;
    configFile?: string;
    config?: CompilationConfig;
    debug?: boolean;
    project?: string;
    targets?: string[];
    transpileOnly?: boolean;
    tsConfig?: ts.CompilerOptions;
    webpackTarget?: string;
}
