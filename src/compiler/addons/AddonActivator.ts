import { CompilationContext } from "..";

export interface AddonActivator {
    (ctx: CompilationContext): void;
}
