import { AddonContext, TargetConfig } from "@websmith/addon-api";
import { validateRuntimeLibrary } from "../magellan-shared/addon-helpers";
import { createTransformer } from "./ServerAddon";

export const activate = (ctx: AddonContext<TargetConfig>) => {
    validateRuntimeLibrary("@qs/magellan-server");
    ctx.registerPreEmitTransformer((name: string, content: string) => createTransformer(name, content, ctx));
};
