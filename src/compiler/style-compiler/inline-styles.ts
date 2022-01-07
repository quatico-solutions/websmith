/*
 * @license
 *
 * Copyright (c) 2017-2021 Quatico Solutions AG
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
import { isStyleFileName } from "../../elements";

const STYLES_METHOD_NAME = "importedStyles";

export const inlineStyles = (file: ts.SourceFile, compiledStyles: string[]) => {
    const classDecl = getFirstClassDeclaration(file);
    const updatedClassDecl = classDecl
        ? ts.updateClassDeclaration(
              classDecl,
              classDecl.decorators,
              classDecl.modifiers,
              classDecl.name,
              classDecl.typeParameters,
              classDecl.heritageClauses,
              [...Array.from(classDecl?.members ?? []), getOrCreateStylesMethod(classDecl, compiledStyles)]
          )
        : undefined;

    // Update and emit source file with new class declaration
    if (updatedClassDecl) {
        const statements = file.statements.filter(stmt => !isStyleImport(stmt) && stmt !== classDecl).concat(updatedClassDecl);

        file = ts.updateSourceFileNode(
            file,
            statements,
            file.isDeclarationFile,
            file.referencedFiles,
            file.typeReferenceDirectives,
            file.hasNoDefaultLib,
            file.libReferenceDirectives
        );
    }
    return file;
};

export const getOrCreateStylesMethod = (classDecl: ts.ClassDeclaration | undefined, styles: string[]): ts.MethodDeclaration => {
    let classMembers = Array.from(classDecl?.members ?? []);
    let result: ts.MethodDeclaration;

    const methodBlock = ts.createBlock([ts.createReturn(ts.createStringLiteral(styles.join("\n")))]);
    const methodDecl = findStylesMethod(classDecl);
    if (methodDecl) {
        classMembers = classMembers.filter(stmt => stmt !== methodDecl);
        result = ts.updateMethod(
            methodDecl,
            methodDecl.decorators,
            methodDecl.modifiers,
            methodDecl.asteriskToken,
            methodDecl.name,
            methodDecl.questionToken,
            methodDecl.typeParameters,
            methodDecl.parameters,
            methodDecl.type,
            methodBlock
        );
    } else {
        result = ts.createMethod(
            undefined,
            [ts.createToken(ts.SyntaxKind.ProtectedKeyword)],
            undefined,
            STYLES_METHOD_NAME,
            undefined,
            undefined,
            [],
            ts.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
            methodBlock
        );
    }

    return result;
};

export const findStylesMethod = (classDecl: ts.ClassDeclaration | undefined): ts.MethodDeclaration | undefined => {
    return Array.from(classDecl?.members || []).filter(
        // @ts-ignore custom property access 'escapedText'
        cur => cur.kind === ts.SyntaxKind.MethodDeclaration && cur.name?.escapedText === STYLES_METHOD_NAME
    )[0] as ts.MethodDeclaration;
};

export const getFirstClassDeclaration = (file: ts.SourceFile): ts.ClassDeclaration | undefined => {
    return file.statements?.filter(cur => cur.kind === ts.SyntaxKind.ClassDeclaration)[0] as ts.ClassDeclaration;
};

export const isStyleImport = (stmt: ts.Statement): boolean => {
    // @ts-ignore custom property access 'text'
    const name = (stmt as ts.ImportDeclaration)?.moduleSpecifier?.text;
    return stmt.kind === ts.SyntaxKind.ImportDeclaration && isStyleFileName(name);
};
