import type { CompilationOptions } from "../compilation";

export type CompilerConfig = {
    targets?: Record<string, CompilationOptions>;
};
