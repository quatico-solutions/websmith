import type { CompilationConfig } from "./CompilationConfig";
import { resolveCompilationConfig } from "./resolve-compiler-config";
import { resolveProjectConfig } from "./resolve-project-config";
import { resolveTargets } from "./resolve-targets";

export { resolveProjectConfig, resolveCompilationConfig, resolveTargets };
export type { CompilationConfig };
