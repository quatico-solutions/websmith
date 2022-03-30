import type { CompilationOptions } from "../CompilationOptions";

export type CompilerConfig = {
    targets?: Record<string, CompilationOptions>;
};
