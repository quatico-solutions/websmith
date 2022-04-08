import { AddonContext } from "@websmith/addon-api";
import { createTargetPostTransformer } from "./target-post-transformer";

export const activate = (ctx: AddonContext) => {
    ctx.registerTargetPostTransformer((fileNames: string[]) => createTargetPostTransformer(fileNames, ctx));
};
