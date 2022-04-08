/*
 * @license
 *
 * Copyright (c) 2017-2022 Quatico Solutions AG
 * Förrlibuckstrasse 220, 8005 Zurich, Switzerland
 *
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Quatico Solutions AG, ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Quatico.
 */
import { existsSync, readFileSync, writeFileSync } from "fs";
import ts from "typescript";

/**
 * Target file path for the generated export file.
 */
const OUTPUT_FILE_PATH = "lib/output.yaml";

/**
 * Creates a transformer that collects all names of exported functions and variables.
 *
 * @param system The TS system to use.
 * @returns A TS transformer factory.
 */
export const createTransformer = (system: ts.System): ts.TransformerFactory<ts.SourceFile> => {
    return (ctx: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
        return (input: ts.SourceFile): ts.SourceFile => {
            const foundDecls: string[] = [];

            const visitor = (node: ts.Node): ts.VisitResult<ts.Node> => {
                // Visit child nodes of source files
                if (ts.isSourceFile(node)) {
                    return ts.visitEachChild(node, visitor, ctx);
                }

                // Collect node identifier if it is exported and a function or variable
                if (
                    node.modifiers?.some(it => it.kind === ts.SyntaxKind.ExportKeyword) &&
                    (ts.isVariableStatement(node) || ts.isFunctionDeclaration(node))
                ) {
                    foundDecls.push(getName(node));
                }

                return node;
            };

            input = ts.visitNode(input, visitor);

            // Write collected identifiers to hard coded output file
            writeFileSync(system.resolvePath(OUTPUT_FILE_PATH), createFileContent(input.fileName, foundDecls, system));
            return input;
        };
    };
};

/**
 * Appends the given names to the output file.
 *
 * @param filePath The path to the file.
 * @param names The names to append.
 * @param system The TS system to use.
 * @returns The new content to append to the file.
 */
const createFileContent = (filePath: string, names: string[], system: ts.System): string => {
    const fileContent = getOrCreateFile(system.resolvePath(OUTPUT_FILE_PATH));
    const existingFileContent = fileContent ? `${fileContent}\n` : "";
    const exports = names.length > 0 ? `\nexports: [${names.join(",")}]\n` : "";
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
    if (!existsSync(filePath)) {
        writeFileSync(filePath, "");
    }
    return readFileSync(filePath).toString();
};
