import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import ts from "typescript";
import { AddonContext } from "../../../src/addon-api";

export const createExportCollector = (fileName: string, content: string, ctx: AddonContext) => {
    const sf = ts.createSourceFile(fileName, content, ctx.getConfig().options.target ?? ts.ScriptTarget.Latest, true);
    ts.transform(sf, [createExportCollectorFactory()], ctx.getConfig().options);
};

const createExportCollectorFactory = () => {
    return (ctx: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
        return (sf: ts.SourceFile) => {
            const exportFileContent = getOrCreateOutputFile(resolve("./output.yaml"));
            const foundDeclarations: string[] = [];

            const visitor = (node: ts.Node): ts.VisitResult<ts.Node> => {
                if (ts.isSourceFile(node)) {
                    return ts.visitEachChild(node, visitor, ctx);
                }

                if (
                    node.modifiers?.some(it => it.kind === ts.SyntaxKind.ExportKeyword) &&
                    (ts.isVariableStatement(node) || ts.isFunctionDeclaration(node))
                ) {
                    foundDeclarations.push(getIdentifier(node));
                }

                return node;
            };

            sf = ts.visitNode(sf, visitor);

            writeFileSync(resolve("./output.yaml"), getYAMLOutput(exportFileContent, sf.fileName, foundDeclarations));
            return sf;
        };
    };
};

const getYAMLOutput = (exportFileContent: string, fileName: string, foundDeclarations: string[]): string => {
    const existingFileContent = exportFileContent ? exportFileContent + "\n" : "";
    const exportedDeclarations = foundDeclarations.length > 0 ? `\nexports: [${foundDeclarations.join(",")}]\n` : "";
    return `${existingFileContent}-file: "${fileName}"${exportedDeclarations}`;
};

const getIdentifier = (node: ts.FunctionDeclaration | ts.VariableStatement): string => {
    if (ts.isFunctionDeclaration(node)) {
        return node.name?.getText() ?? "unknown";
    } else if (ts.isVariableStatement(node)) {
        return node.declarationList?.declarations[0]?.name?.getText() ?? "unknown";
    }
    return "";
};

const getOrCreateOutputFile = (fileName: string): string => {
    if (!existsSync(fileName)) {
        writeFileSync(fileName, "");
    }
    return readFileSync(fileName).toString();
};
