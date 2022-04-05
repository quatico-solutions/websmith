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
import ts from "typescript";
import {
    getDecoration,
    isNodeExported,
    isTransformable,
    TransformationArguments,
    transformInvocableArrow,
    transformInvocableFunction,
} from "../magellan-shared";

const DECORATOR_NAME = "service";
const NAMED_IMPORTS = ["remoteInvoke"];

export const createClientTransformer = ({ libPath, functionsDir }: TransformationArguments) => {
    return (ctx: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
        return (sf: ts.SourceFile) => {
            if (sf.fileName.endsWith("/index.ts") || (functionsDir && !sf.fileName.includes(functionsDir))) {
                return sf;
            }
            let hasServiceFunctions = false;

            const visitor = (node: ts.Node): ts.VisitResult<ts.Node> => {
                if (ts.isSourceFile(node)) {
                    return ts.visitEachChild(node, visitor, ctx);
                }

                if (ts.isImportDeclaration(node)) {
                    return undefined;
                }

                if (!isTransformable(node)) {
                    return node;
                }

                if (!isNodeExported(node) || !getDecoration(sf, node, DECORATOR_NAME)) {
                    return undefined;
                }

                const [transformedNode, isServiceFunction] = transformNode(node, sf);
                hasServiceFunctions = hasServiceFunctions || isServiceFunction;
                return transformedNode ?? node;
            };

            sf = ts.visitNode(sf, visitor);
            if (hasServiceFunctions) {
                if (!hasInvokeImport(sf, libPath, NAMED_IMPORTS)) {
                    sf = ts.factory.updateSourceFile(sf, [getImportInvoke(libPath, NAMED_IMPORTS), ...sf.statements]);
                }
            }
            return sf;
        };
    };
};

export const transformNode = (node: ts.Node, sf: ts.SourceFile): [ts.Node | undefined, boolean] => {
    let updatedNode: ts.Node | undefined = undefined;
    if (ts.isVariableStatement(node)) {
        updatedNode = transformInvocableArrow(node, sf);
    }
    if (ts.isFunctionDeclaration(node)) {
        updatedNode = transformInvocableFunction(node, sf);
    }

    return [updatedNode, updatedNode !== undefined];
};

export const hasInvokeImport = (sf: ts.SourceFile, libPath: string, namedImports: string[]): boolean => {
    if (sf.statements.filter(cur => ts.isImportDeclaration(cur)).length < 1) {
        return false;
    }

    const imports = sf.statements.filter(
        cur => ts.isImportDeclaration(cur) && ts.isStringLiteral(cur.moduleSpecifier) && cur.moduleSpecifier.text === libPath
    );

    if (!imports || imports.length < 1) {
        return false;
    }
    const namedBindings = imports
        .map(cur => (cur as ts.ImportDeclaration)?.importClause?.namedBindings as ts.NamedImports)
        .filter(cur => (cur as ts.NamedImports)?.elements)
        .map(cur => cur.elements.map(nb => nb.name.text));
    const foundImport = namedBindings.some(nb => namedImports.every(elem => nb.includes(elem)));
    return foundImport;
};

export const getImportInvoke = (libPath: string, namedImports: string[]): ts.Statement => {
    return ts.factory.createImportDeclaration(
        undefined,
        undefined,
        ts.factory.createImportClause(
            false,
            undefined,
            ts.factory.createNamedImports(namedImports.map(nI => ts.factory.createImportSpecifier(false, undefined, ts.factory.createIdentifier(nI))))
        ),
        ts.factory.createStringLiteral(libPath)
    );
};
