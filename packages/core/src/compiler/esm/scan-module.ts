/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import ts from "typescript";

export type CommonJsName = "require" | "module" | "exports" | "__dirname" | "__filename";

export type FreeReference = {
    name: CommonJsName;
    start: number;
    length: number;
    /** True when the reference is the root of a `module.exports = …` or `exports.x = …` assignment target. */
    commonJsExport: boolean;
};

export type ModuleScan = {
    /** The parsed file; diagnostics use it as their location. */
    file: ts.SourceFile;
    /** True when the file contains `import`/`export` declarations, `import.meta` or top-level `await`. */
    hasEsmSyntax: boolean;
    /** References to CommonJS names that no enclosing scope declares, excluding `typeof`-guarded uses. */
    freeReferences: FreeReference[];
};

/** Parses emitted JavaScript once. Replaceable by another parser without touching the ESM rules. */
export type ModuleScanner = (fileName: string, content: string) => ModuleScan;

const COMMONJS_NAMES: ReadonlySet<string> = new Set<CommonJsName>(["require", "module", "exports", "__dirname", "__filename"]);

export const scanModule: ModuleScanner = (fileName, content) => {
    const file = ts.createSourceFile(fileName, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const declarations = new Map<ts.Node, Set<string>>();
    const references: ts.Identifier[] = [];
    let hasEsmSyntax = false;

    const declare = (scope: ts.Node, name: ts.BindingName | ts.Identifier | undefined): void => {
        if (!name) {
            return;
        }
        if (ts.isIdentifier(name)) {
            if (COMMONJS_NAMES.has(name.text)) {
                declarations.set(scope, (declarations.get(scope) ?? new Set()).add(name.text));
            }
        } else {
            name.elements.forEach(cur => !ts.isOmittedExpression(cur) && declare(scope, cur.name));
        }
    };

    const visit = (node: ts.Node): void => {
        if (isEsmSyntax(node)) {
            hasEsmSyntax = true;
        }
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
        } else if (ts.isIdentifier(node) && COMMONJS_NAMES.has(node.text) && isReference(node)) {
            references.push(node);
        }
        ts.forEachChild(node, visit);
    };
    visit(file);

    const isDeclared = (node: ts.Identifier): boolean => {
        for (let cur: ts.Node | undefined = node.parent; cur; cur = cur.parent) {
            if (declarations.get(cur)?.has(node.text)) {
                return true;
            }
        }
        return false;
    };

    return {
        file,
        hasEsmSyntax,
        freeReferences: references
            .filter(cur => !isDeclared(cur) && !isTypeofGuarded(cur))
            .map(cur => ({
                name: cur.text as CommonJsName,
                start: cur.getStart(file),
                length: cur.getWidth(file),
                commonJsExport: isCommonJsExport(cur),
            })),
    };
};

const isEsmSyntax = (node: ts.Node): boolean =>
    ts.isImportDeclaration(node) ||
    ts.isExportDeclaration(node) ||
    ts.isExportAssignment(node) ||
    (ts.isMetaProperty(node) && node.keywordToken === ts.SyntaxKind.ImportKeyword) ||
    (ts.canHaveModifiers(node) && !!ts.getModifiers(node)?.some(cur => cur.kind === ts.SyntaxKind.ExportKeyword)) ||
    ((ts.isAwaitExpression(node) || (ts.isForOfStatement(node) && !!node.awaitModifier)) && ts.isSourceFile(findFunctionScope(node.parent)));

const isFunctionScope = (node: ts.Node): boolean => ts.isFunctionLike(node) || ts.isSourceFile(node) || ts.isClassStaticBlockDeclaration(node);

const isBlockScope = (node: ts.Node): boolean =>
    isFunctionScope(node) || ts.isBlock(node) || ts.isCaseBlock(node) || ts.isIterationStatement(node, false) || ts.isCatchClause(node);

const findFunctionScope = (node: ts.Node): ts.Node => findAncestor(node, isFunctionScope);

const findBlockScope = (node: ts.Node): ts.Node => findAncestor(node, isBlockScope);

const findAncestor = (node: ts.Node, predicate: (node: ts.Node) => boolean): ts.Node => {
    let cur = node;
    while (!predicate(cur) && cur.parent) {
        cur = cur.parent;
    }
    return cur;
};

/** False for identifiers that name a property, a declaration or a label instead of referencing a binding. */
const isReference = (node: ts.Identifier): boolean => {
    const parent = node.parent;
    if (ts.isShorthandPropertyAssignment(parent)) {
        return true;
    }
    return !(
        ("name" in parent && parent.name === node) ||
        ("propertyName" in parent && parent.propertyName === node) ||
        (ts.isQualifiedName(parent) && parent.right === node) ||
        ts.isLabeledStatement(parent) ||
        ts.isBreakOrContinueStatement(parent)
    );
};

/**
 * True for `typeof name`, and for uses in a branch or operand that runs only when a `typeof name` test says `name`
 * is defined. Tests whose direction cannot be read (e.g. compound conditions) guard every branch and operand.
 */
const isTypeofGuarded = (node: ts.Identifier): boolean => {
    let child: ts.Node = node;
    for (let parent = node.parent; parent; child = parent, parent = parent.parent) {
        if (ts.isTypeOfExpression(parent)) {
            return true;
        }
        if (ts.isConditionalExpression(parent) && child !== parent.condition && testsTypeof(parent.condition, node.text)) {
            const defined = readsDefined(parent.condition, node.text);
            if (defined === undefined || defined === (child === parent.whenTrue)) {
                return true;
            }
        }
        if (ts.isIfStatement(parent) && child !== parent.expression && testsTypeof(parent.expression, node.text)) {
            const defined = readsDefined(parent.expression, node.text);
            if (defined === undefined || defined === (child === parent.thenStatement)) {
                return true;
            }
        }
        if (ts.isBinaryExpression(parent) && child === parent.right && testsTypeof(parent.left, node.text)) {
            const operator = parent.operatorToken.kind;
            const defined = operator === ts.SyntaxKind.QuestionQuestionToken ? undefined : readsDefined(parent.left, node.text);
            if (isLogicalOperator(operator) && (defined === undefined || defined === (operator === ts.SyntaxKind.AmpersandAmpersandToken))) {
                return true;
            }
        }
    }
    return false;
};

const isLogicalOperator = (kind: ts.SyntaxKind): boolean =>
    kind === ts.SyntaxKind.AmpersandAmpersandToken || kind === ts.SyntaxKind.BarBarToken || kind === ts.SyntaxKind.QuestionQuestionToken;

const testsTypeof = (node: ts.Node, name: string): boolean =>
    (ts.isTypeOfExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === name) ||
    !!ts.forEachChild(node, cur => testsTypeof(cur, name) || undefined);

const EQUALITY_OPERATORS: ReadonlySet<ts.SyntaxKind> = new Set([
    ts.SyntaxKind.EqualsEqualsEqualsToken,
    ts.SyntaxKind.EqualsEqualsToken,
    ts.SyntaxKind.ExclamationEqualsEqualsToken,
    ts.SyntaxKind.ExclamationEqualsToken,
]);

/**
 * Reads a `typeof name` comparison with a string literal, optionally negated by `!`: true when the test holds if
 * `name` is defined, false when it holds if `name` is undefined, undefined when the test has another shape.
 */
const readsDefined = (test: ts.Expression, name: string): boolean | undefined => {
    const node = skipParentheses(test);
    if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.ExclamationToken) {
        const operand = readsDefined(node.operand, name);
        return operand === undefined ? undefined : !operand;
    }
    if (!ts.isBinaryExpression(node) || !EQUALITY_OPERATORS.has(node.operatorToken.kind)) {
        return undefined;
    }
    const [typeofSide, literalSide] = ts.isTypeOfExpression(skipParentheses(node.left)) ? [node.left, node.right] : [node.right, node.left];
    const typeofExpression = skipParentheses(typeofSide);
    const literal = skipParentheses(literalSide);
    if (
        !ts.isTypeOfExpression(typeofExpression) ||
        !ts.isIdentifier(typeofExpression.expression) ||
        typeofExpression.expression.text !== name ||
        !ts.isStringLiteralLike(literal)
    ) {
        return undefined;
    }
    const negated =
        node.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken || node.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsToken;
    return (literal.text !== "undefined") !== negated;
};

const skipParentheses = (node: ts.Expression): ts.Expression => (ts.isParenthesizedExpression(node) ? skipParentheses(node.expression) : node);

/** True for the `module` of `module.exports[.x] = …` and the `exports` of `exports.x = …`. */
const isCommonJsExport = (node: ts.Identifier): boolean => {
    let target: ts.Node = node;
    if (node.text === "module") {
        const parent = node.parent;
        if (!ts.isPropertyAccessExpression(parent) || parent.name.text !== "exports") {
            return false;
        }
        target = parent;
    } else if (node.text !== "exports") {
        return false;
    }
    while (ts.isPropertyAccessExpression(target.parent) || ts.isElementAccessExpression(target.parent)) {
        target = target.parent;
    }
    const assignment = target.parent;
    return (
        ts.isBinaryExpression(assignment) &&
        assignment.left === target &&
        assignment.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        target !== node
    );
};
