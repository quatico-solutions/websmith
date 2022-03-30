import { CompilationContext } from "../../compiler";

export interface AddonActivator {
    (ctx: CompilationContext): void;
}
