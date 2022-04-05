import { AddonContext } from "../../../src/addon-api";
import { createFoobarReplacerFactory } from "../foobar-replacer/foobar-replacer";

export const activate = (ctx: AddonContext): void => {
    ctx.registerEmitTransformer({ before: [createFoobarReplacerFactory()] });
};
