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
import type { AddonContext } from "@websmith/addon-api";
import { ErrorMessage } from "@websmith/addon-api";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import ts from "typescript";

export const createExportCollector = (fileName: string, content: string, ctx: AddonContext): void => {
    const sf = ts.createSourceFile(fileName, content, ctx.getConfig().options.target ?? ts.ScriptTarget.Latest, true);
    const transformResult = ts.transform(sf, [createExportCollectorFactory()], ctx.getConfig().options);

    if (transformResult.diagnostics && transformResult.diagnostics.length > 0) {
        transformResult.diagnostics.forEach(it => ctx.getReporter().reportDiagnostic(new ErrorMessage(it.messageText, sf)));
    }

    if (transformResult.transformed.length < 1) {
        ctx.getReporter().reportDiagnostic(new ErrorMessage(`exportCollector failed for ${fileName} without identifiable error.`, sf));
    }
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
