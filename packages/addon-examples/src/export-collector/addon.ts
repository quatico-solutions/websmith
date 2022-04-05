import { AddonContext } from "../../../src/addon-api";
import { createExportCollector } from "./export-collector";

export const activate = (ctx: AddonContext): void => {
    ctx.registerGenerator((fileName, content) => createExportCollector(fileName, content, ctx));
};
