import { CompilationContext } from "../compilation";

export interface AddonActivator {
    (ctx: CompilationContext): void;
}
