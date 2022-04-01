import type { TargetConfig } from "../compilation";

export type CompilationConfig = {
    // TODO: Rename to CompilationConfig
    configFilePath: string;
    addons?: string[];
    // FIXME: Introduce a new type for the CompilationConfig
    targets?: Record<string, TargetConfig>; // TODO: Resolve to TargetOptions??
};
