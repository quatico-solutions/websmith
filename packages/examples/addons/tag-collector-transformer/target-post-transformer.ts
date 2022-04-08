import { AddonContext } from "@websmith/addon-api";
import { join } from "path";
import ts from "typescript";

/**
 * Gets the output file path for the given output directory.
 *
 * @param outDir The output directory for the generated files.
 * @returns The output file path.
 */
const getOutputFilePath = (outDir: string) => join(outDir, "annotatedFunctions.yaml");

/**
 * Creates a TargetPostProcessor that collects all functions and arrow functions with a // @service() comment.
 *
 * @param fileNames The file names of the current target to process.
 * @param ctx The addon context for the compilation.
 * @returns A websmith TargetPostTransformer factory function.
 */
export const createTargetPostTransformer = (fileNames: string[], ctx: AddonContext) => {
    const outDir = ctx.getConfig().options.outDir ?? process.cwd();
    ctx.getSystem().writeFile(join(outDir, "serviceFunctions.yaml"), "");
    fileNames
        .filter(fn => fn.match(/\.tsx?/gi))
        .map(fn => {
            const sf = ts.createSourceFile(fn, ctx.getFileContent(fn), ctx.getConfig().options.target ?? ts.ScriptTarget.Latest);
            ts.transform(sf, [createTransformerFactory(ctx.getSystem(), outDir)], ctx.getConfig().options);
        });
};

/**
 * Create a transformer that collects all functions and arrow functions with a // @service() comment.
 *
 * @param sys The ts.System for the transformation.
 * @param outDir The output directory for the generated files.
 * @returns A TS TransformerFactory.
 */
const createTransformerFactory = (sys: ts.System, outDir: string): ts.TransformerFactory<ts.SourceFile> => {
    return (ctx: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
        return (sf: ts.SourceFile) => {
            const output =
                sys
                    .readFile(getOutputFilePath(outDir))
                    ?.split("\n")
                    .filter(line => line !== undefined && line.length > 0) ?? [];

            const visitor = (node: ts.Node): ts.VisitResult<ts.Node> => {
                if (ts.isSourceFile(node)) {
                    ts.visitEachChild(node, visitor, ctx);
                }

                if (isAnnotated(node, sf)) {
                    if (ts.isFunctionDeclaration(node)) {
                        output.push(`- ${node.name?.getText(sf) ?? "unknown"}`);
                    } else if (ts.isVariableStatement(node)) {
                        output.push(`- ${getVariableName(node, sf)}`);
                    }
                }

                return node;
            };

            sf = ts.visitNode(sf, visitor);

            sys.writeFile(getOutputFilePath(outDir), `${output.join("\n")}`);
            return sf;
        };
    };
};

const isAnnotated = (node: ts.Node, sf: ts.SourceFile) => {
    return node.getFullText(sf).match(/\/\/.*@annotated\(.*\)/gi);
};

/**
 * Gets the name of the given variable statement.
 *
 * @param variableStatement The TS VariableStatement to get the name from.
 * @param sf The TS SourceFile that contains this variable statement.
 * @returns The name of the variable in the given statement.
 */
const getVariableName = (variableStatement: ts.VariableStatement, sf: ts.SourceFile): string => {
    return variableStatement.declarationList.declarations[0].name.getText(sf);
};
