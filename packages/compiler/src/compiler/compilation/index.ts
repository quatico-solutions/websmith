import { CompilationContext } from "./CompilationContext";
import { CompilationHost } from "./CompilationHost";
import type { TargetConfig } from "../../../../api/src";
import { createSharedHost } from "./shared-host";

export type { TargetConfig };
export { createSharedHost, CompilationContext, CompilationHost };
