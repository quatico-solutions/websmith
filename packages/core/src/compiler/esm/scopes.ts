/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import ts from "typescript";

/** Records where a file declares names and finds the scope a reference resolves to. */
export type ScopeDeclarations = {
    /** Records the names in the filter that `node` declares; call it for every node of the file before resolving. */
    visit: (node: ts.Node) => void;
    /** The nearest scope enclosing `reference` that declares its name, undefined when no scope does. */
    findDeclaringScope: (reference: ts.Identifier) => ts.Node | undefined;
};

/**
 * Tracks declarations of the names `filter` accepts with JavaScript's scope rules: `var` is function-scoped,
 * `let`, `const`, functions and classes are block-scoped, parameters, named function and class expressions and
 * catch clauses declare in their own node, and imports declare in the file.
 */
export const createScopeDeclarations = (file: ts.SourceFile, filter: (name: string) => boolean): ScopeDeclarations => {
    const declarations = new Map<ts.Node, Set<string>>();

    const declare = (scope: ts.Node, name: ts.BindingName | ts.Identifier | undefined): void => {
        if (!name) {
            return;
        }
        if (ts.isIdentifier(name)) {
            if (filter(name.text)) {
                declarations.set(scope, (declarations.get(scope) ?? new Set()).add(name.text));
            }
        } else {
            name.elements.forEach(cur => !ts.isOmittedExpression(cur) && declare(scope, cur.name));
        }
    };

    return {
        visit: node => {
            if (ts.isVariableDeclaration(node)) {
                if (ts.isVariableDeclarationList(node.parent)) {
                    const isBlockScoped = (node.parent.flags & ts.NodeFlags.BlockScoped) !== 0;
                    declare(isBlockScoped ? findBlockScope(node.parent) : findFunctionScope(node.parent), node.name);
                } else {
                    declare(node.parent, node.name);
                }
            } else if (ts.isParameter(node)) {
                declare(node.parent, node.name);
            } else if (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) {
                declare(findBlockScope(node.parent), node.name);
            } else if (ts.isFunctionExpression(node) || ts.isClassExpression(node)) {
                declare(node, node.name);
            } else if (ts.isImportClause(node) || ts.isNamespaceImport(node) || ts.isImportSpecifier(node) || ts.isImportEqualsDeclaration(node)) {
                declare(file, node.name);
            }
        },
        findDeclaringScope: reference => {
            for (let cur: ts.Node | undefined = reference.parent; cur; cur = cur.parent) {
                if (declarations.get(cur)?.has(reference.text)) {
                    return cur;
                }
            }
            return undefined;
        },
    };
};

const isFunctionScope = (node: ts.Node): boolean => ts.isFunctionLike(node) || ts.isSourceFile(node) || ts.isClassStaticBlockDeclaration(node);

const isBlockScope = (node: ts.Node): boolean =>
    isFunctionScope(node) || ts.isBlock(node) || ts.isCaseBlock(node) || ts.isIterationStatement(node, false) || ts.isCatchClause(node);

/** The nearest function, class static block or file enclosing or being `node`. */
export const findFunctionScope = (node: ts.Node): ts.Node => findAncestor(node, isFunctionScope);

const findBlockScope = (node: ts.Node): ts.Node => findAncestor(node, isBlockScope);

const findAncestor = (node: ts.Node, predicate: (node: ts.Node) => boolean): ts.Node => {
    let cur = node;
    while (!predicate(cur) && cur.parent) {
        cur = cur.parent;
    }
    return cur;
};
