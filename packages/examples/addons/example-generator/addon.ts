import { AddonContext, Generator, InfoMessage } from "@websmith/addon-api";
import ts from "typescript";

export const activate = (ctx: AddonContext) => {
    ctx.registerGenerator(createGenerator(ctx));
};

const createGenerator =
    (ctx: AddonContext): Generator =>
    (fileName: string, fileContent: string): void => {
        const sf = ts.createSourceFile(fileName, fileContent, ctx.getConfig().project?.target ?? ts.ScriptTarget.Latest);
        ctx.getReporter().reportDiagnostic(new InfoMessage(`Example Addon processing ${fileName}`, sf));
    };
