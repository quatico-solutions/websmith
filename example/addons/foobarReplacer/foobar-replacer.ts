import ts from "typescript";
import type { AddonContext } from "../../../src/addon-api";
import { ErrorMessage } from "../../../src/compiler";

export const createFoobarReplacerTransformer = (fileName: string, content: string, ctx: AddonContext): string => {
    const sf = ts.createSourceFile(fileName, content, ctx.getConfig().options.target ?? ts.ScriptTarget.Latest, true);
    const transformResult = ts.transform(sf, [createFoobarReplacerFactory()], ctx.getConfig().options);
    if (transformResult.diagnostics && transformResult.diagnostics.length > 0) {
        transformResult.diagnostics.forEach(it => ctx.getReporter().reportDiagnostic(new ErrorMessage(it.messageText, sf)));
        return "";
    }

    if (transformResult.transformed.length > 0) {
        return ts.createPrinter().printFile(transformResult.transformed[0]);
    }

    ctx.getReporter().reportDiagnostic(new ErrorMessage(`foobarReplacer failed for ${fileName} without identifiable error.`, sf));
    return "";
};

export const createFoobarReplacerFactory = () => {
    return (ctx: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
        return (sf: ts.SourceFile) => {
            const visitor = (node: ts.Node): ts.VisitResult<ts.Node> => {
                if (ts.isSourceFile(node)) {
                    return ts.visitEachChild(node, visitor, ctx);
                }

                if (ts.isIdentifier(node)) {
                    const identifier = node.getText();
                    if (identifier.match(/foobar/gi)) {
                        return ctx.factory.createIdentifier(identifier.replace(/foobar/gi, "barfoo"));
                    }
                    if (identifier.match(/barfoo/gi)) {
                        return ctx.factory.createIdentifier(identifier.replace(/barfoo/gi, "foobar"));
                    }
                }

                return ts.visitEachChild(node, visitor, ctx);
            };

            return ts.visitNode(sf, visitor);
        };
    };
};
