import type { CompilationOptions } from "../compilation";

export type CompilerConfig = {
    configFilePath: string;
    addons?: string[];
    // FIXME: Introduce a new type for the CompilationConfig
    targets?: Record<string, CompilationOptions>;
};
