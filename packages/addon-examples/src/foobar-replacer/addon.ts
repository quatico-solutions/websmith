import { AddonContext } from "../../../addon-api/src";
import { createFoobarReplacerTransformer } from "./foobar-replacer";

export const activate = (ctx: AddonContext): void => {
    ctx.registerPreEmitTransformer((fileName, content) => createFoobarReplacerTransformer(fileName, content, ctx));
};
