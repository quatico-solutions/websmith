import { AddonContext, TargetConfig } from "@websmith/addon-api";
import { validateRuntimeLibrary } from "../magellan-shared/addon-helpers";
import { createTransformer } from "./ClientAddon";

export const activate = (ctx: AddonContext<TargetConfig>) => {
    validateRuntimeLibrary("@qs/magellan-client");
    ctx.registerPreEmitTransformer((name: string, content: string) => createTransformer(name, content, ctx));
};
