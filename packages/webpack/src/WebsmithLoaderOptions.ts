import type { CompilationConfig } from "@quatico/websmith-core";
import type ts from "typescript";

export interface WebsmithLoaderOptions {
    /**
     * Relative file path to the `websmith.config.json` file to be used for compilation.
     */
    configFile?: string;
    /**
     * Websmith configuration to be used for compilation. Overrides the configuration loaded from `websmith.config.json`.
     */
    config?: CompilationConfig;
    /**
     * Enables debug mode for the compilation.
     * @default false
     */
    debug?: boolean;
    /**
     * Relative file path to the `tsconfig.json` file to be used for TypeScript compilation.
     */
    tsConfigFile?: string;
    /**
     * TypeScript compiler options to be used for compilation. Overrides the options loaded from `tsconfig.json`.
     */
    tsConfig?: ts.CompilerOptions;
    /**
     * Defines the targets to apply during webpack compilation.
     */
    targets?: string[];
    /**
     * Whether to only transpile the code without emitting any output.
     * Overrides the `transpileOnly` specified in the `config`.
     */
    transpileOnly?: boolean;
    /**
     * The target for the webpack compilation.
     */
    webpackTarget?: string;
}
