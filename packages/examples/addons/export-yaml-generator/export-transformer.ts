/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { AddonContext } from "@quatico/websmith-api";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import ts from "typescript";

/**
 * Creates a TS custom transformer that collects all names of exported functions and variables.
 *
 * @param system The TS system to use.
 * @returns A TS transformer factory.
 */
export const createTransformer = (context: AddonContext): ts.TransformerFactory<ts.SourceFile> => {
    return (ctx: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
        return (input: ts.SourceFile): ts.SourceFile => {
            const foundDecls: string[] = [];

            const visitor = (node: ts.Node): ts.VisitResult<ts.Node> => {
                // Collect node identifier if it is exported and a function or variable
                if (
                    node.modifiers?.some(it => it.kind === ts.SyntaxKind.ExportKeyword) &&
                    (ts.isVariableStatement(node) || ts.isFunctionDeclaration(node))
                ) {
                    foundDecls.push(getName(node));
                }

                return ts.visitEachChild(node, visitor, ctx);
            };

            input = ts.visitNode(input, visitor);

            const outPath = join(context.getConfig()?.options?.outDir ?? "", "output.yaml");
            // Write collected identifiers to hard coded output file
            writeFileSync(outPath, createFileContent(input.fileName, foundDecls, outPath));
            return input;
        };
    };
};

/**
 * Appends the given names to the output file.
 *
 * @param filePath The path to the file.
 * @param names The names to append.
 * @param outPath The path to the output file.
 * @returns The new content to append to the file.
 */
const createFileContent = (filePath: string, names: string[], outPath: string): string => {
    const fileContent = getOrCreateFile(outPath);
    const existingFileContent = fileContent ? `${fileContent}\n` : "";
    const exports = names.length > 0 ? `\nexports: [${names.join(",")}]\n` : "\nexports: []\n";
    return `${existingFileContent}-file: "${filePath}"${exports}`;
};

/**
 * Returns identifier for function or variable declaration, or empty string for nodes of different types.
 *
 * @param node The node to get the name from.
 * @returns Node name or empty string.
 */
const getName = (node: ts.Node): string => {
    if (ts.isFunctionDeclaration(node)) {
        return node.name?.getText() ?? "unknown";
    } else if (ts.isVariableStatement(node)) {
        return node.declarationList?.declarations[0]?.name?.getText() ?? "unknown";
    }
    return "";
};

/**
 * Returns the content of the file or creates a new file if it does not exist.
 *
 * @param filePath The path to the file.
 * @returns The content of the file or empty string if the file does not exist.
 */
const getOrCreateFile = (filePath: string): string => {
    if (!existsSync(dirname(filePath))) {
        mkdirSync(dirname(filePath), { recursive: true });
    }
    if (!existsSync(filePath)) {
        writeFileSync(filePath, "");
    }
    return readFileSync(filePath).toString();
};
