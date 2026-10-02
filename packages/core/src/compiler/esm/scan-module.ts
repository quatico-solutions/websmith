/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import ts from "typescript";
import { createScopeDeclarations, findFunctionScope } from "./scopes";

export type CommonJsName = "require" | "module" | "exports" | "__dirname" | "__filename";

export type FreeReference = {
    name: CommonJsName;
    start: number;
    length: number;
    /** True when the reference is the root of a `module.exports = …` or `exports.x = …` assignment target. */
    commonJsExport: boolean;
};

/** Location of a construct in the scanned file. */
export type Span = { start: number; length: number };

export type ModuleScan = {
    /** The parsed file; diagnostics use it as their location. */
    file: ts.SourceFile;
    /** True when the file contains `import`/`export` declarations, `import.meta` or top-level `await`. */
    hasEsmSyntax: boolean;
    /** The first `import`/`export` keyword or `import.meta`, undefined when there is none; dynamic `import()` is not one. */
    esmSyntax?: Span;
    /** The first top-level `await` keyword, including the one of `for await`, undefined when there is none. */
    topLevelAwait?: Span;
    /** The first `__esModule` marker CommonJS output sets on `exports`, undefined when there is none. */
    esModuleMarker?: Span;
    /** References to CommonJS names that no enclosing scope declares, excluding `typeof`-guarded uses. */
    freeReferences: FreeReference[];
};

/** Parses emitted JavaScript once. Replaceable by another parser without touching the ESM rules. */
export type ModuleScanner = (fileName: string, content: string) => ModuleScan;

const COMMONJS_NAMES: ReadonlySet<string> = new Set<CommonJsName>(["require", "module", "exports", "__dirname", "__filename"]);

export const scanModule: ModuleScanner = (fileName, content) => {
    const file = ts.createSourceFile(fileName, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const scopes = createScopeDeclarations(file, name => COMMONJS_NAMES.has(name));
    const references: ts.Identifier[] = [];
    let esmSyntax: Span | undefined;
    let topLevelAwait: Span | undefined;
    const markers: { node: ts.Node; root: ts.Identifier }[] = [];
    const spanOf = (node: ts.Node): Span => ({ start: node.getStart(file), length: node.getWidth(file) });

    const visit = (node: ts.Node): void => {
        const esmNode = esmSyntax ? undefined : findEsmSyntax(node);
        if (esmNode) {
            esmSyntax = spanOf(esmNode);
        }
        const awaitNode = topLevelAwait ? undefined : findTopLevelAwait(node);
        if (awaitNode) {
            topLevelAwait = spanOf(awaitNode);
        }
        const markerRoot = findEsModuleMarkerRoot(node);
        if (markerRoot) {
            markers.push({ node, root: markerRoot });
        }
        scopes.visit(node);
        if (ts.isIdentifier(node) && COMMONJS_NAMES.has(node.text) && isReference(node)) {
            references.push(node);
        }
        ts.forEachChild(node, visit);
    };
    visit(file);

    const isFree = (node: ts.Identifier): boolean => !scopes.findDeclaringScope(node) && !isTypeofGuarded(node);
    const marker = markers.find(cur => isFree(cur.root));
    const esModuleMarker = marker && spanOf(marker.node);

    return {
        file,
        hasEsmSyntax: !!esmSyntax || !!topLevelAwait,
        ...(esmSyntax && { esmSyntax }),
        ...(topLevelAwait && { topLevelAwait }),
        ...(esModuleMarker && { esModuleMarker }),
        freeReferences: references.filter(isFree).map(cur => ({
            name: cur.text as CommonJsName,
            start: cur.getStart(file),
            length: cur.getWidth(file),
            commonJsExport: isCommonJsExport(cur),
        })),
    };
};

/** Returns the node to locate when `node` is ESM syntax: its `import`/`export` keyword, or `import.meta` itself. */
const findEsmSyntax = (node: ts.Node): ts.Node | undefined => {
    if (ts.isMetaProperty(node) && node.keywordToken === ts.SyntaxKind.ImportKeyword) {
        return node;
    }
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node) || ts.isExportAssignment(node)) {
        return node.getFirstToken();
    }
    return ts.canHaveModifiers(node) ? ts.getModifiers(node)?.find(cur => cur.kind === ts.SyntaxKind.ExportKeyword) : undefined;
};

/** Returns the `await` keyword when `node` is an `await` or `for await` outside any function. */
const findTopLevelAwait = (node: ts.Node): ts.Node | undefined => {
    const keyword = ts.isAwaitExpression(node) ? node.getFirstToken() : ts.isForOfStatement(node) ? node.awaitModifier : undefined;
    return keyword && ts.isSourceFile(findFunctionScope(node.parent)) ? keyword : undefined;
};

/**
 * Returns the `exports` or `module` identifier that `Object.defineProperty(exports, "__esModule", …)` or
 * `exports.__esModule = …` (also on `module.exports`) marks, undefined when `node` is no such marker.
 */
const findEsModuleMarkerRoot = (node: ts.Node): ts.Identifier | undefined => {
    if (ts.isCallExpression(node)) {
        const callee = node.expression;
        const [target, property] = node.arguments;
        const isDefineProperty =
            ts.isPropertyAccessExpression(callee) &&
            ts.isIdentifier(callee.expression) &&
            callee.expression.text === "Object" &&
            callee.name.text === "defineProperty";
        return isDefineProperty && !!property && ts.isStringLiteralLike(property) && property.text === "__esModule"
            ? findExportsRoot(target)
            : undefined;
    }
    return ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        ts.isPropertyAccessExpression(node.left) &&
        node.left.name.text === "__esModule"
        ? findExportsRoot(node.left.expression)
        : undefined;
};

/** Returns the root identifier of `exports` or `module.exports`, undefined for other expressions. */
const findExportsRoot = (node: ts.Node | undefined): ts.Identifier | undefined => {
    if (node && ts.isIdentifier(node) && node.text === "exports") {
        return node;
    }
    return node &&
        ts.isPropertyAccessExpression(node) &&
        node.name.text === "exports" &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "module"
        ? node.expression
        : undefined;
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
 * True for `typeof name`, and for uses in a branch or operand that runs only when a `typeof` test of a CommonJS name
 * says it is defined: in an ES module all five are undefined together, so a test of any of them guards every one.
 * Tests whose direction cannot be read (e.g. compound conditions) guard every branch and operand.
 */
const isTypeofGuarded = (node: ts.Identifier): boolean => {
    let child: ts.Node = node;
    for (let parent = node.parent; parent; child = parent, parent = parent.parent) {
        if (ts.isTypeOfExpression(parent)) {
            return true;
        }
        if (ts.isConditionalExpression(parent) && child !== parent.condition && testsTypeof(parent.condition, COMMONJS_NAMES)) {
            const defined = readsDefined(parent.condition, COMMONJS_NAMES);
            if (defined === undefined || defined === (child === parent.whenTrue)) {
                return true;
            }
        }
        if (ts.isIfStatement(parent) && child !== parent.expression && testsTypeof(parent.expression, COMMONJS_NAMES)) {
            const defined = readsDefined(parent.expression, COMMONJS_NAMES);
            if (defined === undefined || defined === (child === parent.thenStatement)) {
                return true;
            }
        }
        if (ts.isBinaryExpression(parent) && child === parent.right && testsTypeof(parent.left, COMMONJS_NAMES)) {
            const operator = parent.operatorToken.kind;
            const defined = operator === ts.SyntaxKind.QuestionQuestionToken ? undefined : readsDefined(parent.left, COMMONJS_NAMES);
            if (isLogicalOperator(operator) && (defined === undefined || defined === (operator === ts.SyntaxKind.AmpersandAmpersandToken))) {
                return true;
            }
        }
    }
    return false;
};

const isLogicalOperator = (kind: ts.SyntaxKind): boolean =>
    kind === ts.SyntaxKind.AmpersandAmpersandToken || kind === ts.SyntaxKind.BarBarToken || kind === ts.SyntaxKind.QuestionQuestionToken;

const testsTypeof = (node: ts.Node, names: ReadonlySet<string>): boolean =>
    (ts.isTypeOfExpression(node) && ts.isIdentifier(node.expression) && names.has(node.expression.text)) ||
    !!ts.forEachChild(node, cur => testsTypeof(cur, names) || undefined);

const EQUALITY_OPERATORS: ReadonlySet<ts.SyntaxKind> = new Set([
    ts.SyntaxKind.EqualsEqualsEqualsToken,
    ts.SyntaxKind.EqualsEqualsToken,
    ts.SyntaxKind.ExclamationEqualsEqualsToken,
    ts.SyntaxKind.ExclamationEqualsToken,
]);

/**
 * Reads a `typeof name` comparison of one of `names` with a string literal, optionally negated by `!`: true when the
 * test holds if `name` is defined, false when it holds if `name` is undefined, undefined when the test has another shape.
 */
const readsDefined = (test: ts.Expression, names: ReadonlySet<string>): boolean | undefined => {
    const node = skipParentheses(test);
    if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.ExclamationToken) {
        const operand = readsDefined(node.operand, names);
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
        !names.has(typeofExpression.expression.text) ||
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
