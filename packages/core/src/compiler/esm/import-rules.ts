/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import type { EsmRuntime } from "@quatico/websmith-api";
import path from "node:path";
import ts from "typescript";
import type { ModuleClassification } from "./classify-module";
import type { ModuleScan } from "./scan-module";

/** Stable diagnostic codes of the rules on relative imports. */
export const ImportDiagnosticCode = {
    MissingExtension: 91010,
    DirectoryImport: 91011,
    UnresolvedImport: 91012,
    MissingJsonAttribute: 91013,
} as const;

export type ImportRuleContext = {
    runtime: EsmRuntime;
    /** The only way the rules read the file system, so a caller can wrap it to register dependencies. */
    system: ts.System;
    /** Resolved paths of the files written in this run: they count as existing even when not on disk yet. */
    writtenFiles?: ReadonlySet<string>;
};

export type ImportFinding = { code: number; message: string; start: number; length: number };

/** A rule over one scanned file: separately callable, so a caller can skip a rule without touching the others. */
export type ImportRule = (
    scan: Pick<ModuleScan, "file">,
    classification: Pick<ModuleClassification, "kind">,
    context: ImportRuleContext
) => ImportFinding[];

type RelativeImport = {
    specifier: string;
    /** Absolute path the specifier names, relative to the importing file. */
    resolved: string;
    start: number;
    length: number;
    /** True when the import carries `with { type: "json" }`. */
    hasJsonAttribute: boolean;
};

/** Extensionless relative import in an ES module (Node, webpack `fullySpecified`). */
export const checkMissingExtension: ImportRule = ({ file }, { kind }, context) =>
    kind !== "esm"
        ? []
        : collectRelativeImports(file)
              .filter(cur => !hasExtension(cur.specifier) && !isDirectory(cur.resolved, context))
              .map(cur =>
                  finding(
                      ImportDiagnosticCode.MissingExtension,
                      `relative import "${cur.specifier}" has no file extension, which ES modules require; add the extension: "${cur.specifier}.js"`,
                      cur
                  )
              );

/** Relative import of a directory in an ES module (`ERR_UNSUPPORTED_DIR_IMPORT`). */
export const checkDirectoryImport: ImportRule = ({ file }, { kind }, context) =>
    kind !== "esm"
        ? []
        : collectRelativeImports(file)
              .filter(cur => isDirectory(cur.resolved, context))
              .map(cur =>
                  finding(
                      ImportDiagnosticCode.DirectoryImport,
                      `relative import "${cur.specifier}" names a directory, which ES modules cannot import; ` +
                          `import the file: "${cur.specifier.replace(/\/+$/, "")}/index.js"`,
                      cur
                  )
              );

// Candidates webpack tries for `javascript/auto`, where specifiers need not be fully specified
const AUTO_EXTENSIONS = [".js", ".mjs", ".cjs", ".json"];

/**
 * Relative import that resolves to no file written in this run or on disk. Extensionless and directory imports of
 * ES modules are left to 91010 and 91011; `javascript/auto` files resolve them like webpack does.
 */
export const checkUnresolvedImport: ImportRule = ({ file }, { kind }, context) => {
    if (kind !== "esm" && kind !== "auto") {
        return [];
    }
    const resolves = (cur: RelativeImport): boolean => {
        if (isDirectory(cur.resolved, context)) {
            return true;
        }
        if (kind === "esm") {
            return !hasExtension(cur.specifier) || isFile(cur.resolved, context);
        }
        return isFile(cur.resolved, context) || AUTO_EXTENSIONS.some(ext => isFile(cur.resolved + ext, context));
    };
    return collectRelativeImports(file)
        .filter(cur => !resolves(cur))
        .map(cur =>
            finding(
                ImportDiagnosticCode.UnresolvedImport,
                `relative import "${cur.specifier}" resolves to no file written by this build or on disk`,
                cur
            )
        );
};

/** JSON import without `with { type: "json" }` in a Node ES module (`ERR_IMPORT_ATTRIBUTE_MISSING`). */
export const checkJsonImportAttribute: ImportRule = ({ file }, { kind }, context) =>
    kind !== "esm" || context.runtime !== "node"
        ? []
        : collectRelativeImports(file)
              .filter(cur => /\.json$/i.test(cur.specifier) && !cur.hasJsonAttribute)
              .map(cur =>
                  finding(
                      ImportDiagnosticCode.MissingJsonAttribute,
                      `JSON import "${cur.specifier}" has no import attribute, which Node requires; add: with { type: "json" }`,
                      cur
                  )
              );

export const IMPORT_RULES: readonly ImportRule[] = [checkMissingExtension, checkDirectoryImport, checkUnresolvedImport, checkJsonImportAttribute];

/** Runs every rule on relative imports. */
export const checkImports: ImportRule = (scan, classification, context) => IMPORT_RULES.flatMap(rule => rule(scan, classification, context));

const finding = (code: number, message: string, { start, length }: RelativeImport): ImportFinding => ({ code, message, start, length });

const hasExtension = (specifier: string): boolean => path.posix.extname(specifier) !== "";

const isFile = (fileName: string, context: ImportRuleContext): boolean =>
    !!context.writtenFiles?.has(fileName) || context.system.fileExists(fileName);

const isDirectory = (dirName: string, context: ImportRuleContext): boolean =>
    (!!context.writtenFiles && getWrittenDirectories(context.writtenFiles).has(dirName)) || context.system.directoryExists(dirName);

const writtenDirectories = new WeakMap<ReadonlySet<string>, Set<string>>();

/** Every directory that contains a written file, computed once per set of written files. */
const getWrittenDirectories = (writtenFiles: ReadonlySet<string>): Set<string> => {
    let result = writtenDirectories.get(writtenFiles);
    if (!result) {
        result = new Set();
        for (const fileName of writtenFiles) {
            for (let dir = path.dirname(fileName); !result.has(dir); dir = path.dirname(dir)) {
                result.add(dir);
            }
        }
        writtenDirectories.set(writtenFiles, result);
    }
    return result;
};

const isRelative = (specifier: string): boolean => /^\.\.?(?:\/|$)/.test(specifier);

const cache = new WeakMap<ts.SourceFile, RelativeImport[]>();

/** Relative specifiers of static imports, re-exports and `import()` with a string literal, in source order. */
const collectRelativeImports = (file: ts.SourceFile): RelativeImport[] => {
    const cached = cache.get(file);
    if (cached) {
        return cached;
    }
    const result: RelativeImport[] = [];
    const add = (literal: ts.Node, hasJsonAttribute: boolean): void => {
        if (ts.isStringLiteralLike(literal) && isRelative(literal.text)) {
            result.push({
                specifier: literal.text,
                resolved: path.resolve(path.dirname(file.fileName), literal.text),
                start: literal.getStart(file),
                length: literal.getWidth(file),
                hasJsonAttribute,
            });
        }
    };
    const visit = (node: ts.Node): void => {
        if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
            add(node.moduleSpecifier, hasStaticJsonAttribute(node.attributes));
        } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments.length > 0) {
            add(node.arguments[0], hasDynamicJsonAttribute(node.arguments[1]));
        }
        ts.forEachChild(node, visit);
    };
    visit(file);
    cache.set(file, result);
    return result;
};

const hasStaticJsonAttribute = (attributes: ts.ImportAttributes | undefined): boolean =>
    attributes?.token === ts.SyntaxKind.WithKeyword &&
    attributes.elements.some(cur => cur.name.text === "type" && ts.isStringLiteralLike(cur.value) && cur.value.text === "json");

/** True for `import(…, { with: { type: "json" } })`. */
const hasDynamicJsonAttribute = (options: ts.Expression | undefined): boolean => {
    const withValue = options && ts.isObjectLiteralExpression(options) ? findProperty(options, "with") : undefined;
    const typeValue = withValue && ts.isObjectLiteralExpression(withValue) ? findProperty(withValue, "type") : undefined;
    return !!typeValue && ts.isStringLiteralLike(typeValue) && typeValue.text === "json";
};

const findProperty = (object: ts.ObjectLiteralExpression, name: string): ts.Expression | undefined =>
    object.properties
        .filter(ts.isPropertyAssignment)
        .find(cur => (ts.isIdentifier(cur.name) || ts.isStringLiteralLike(cur.name)) && cur.name.text === name)?.initializer;
