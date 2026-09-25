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
    /** True when the import carries an `assert` clause instead of `with`. */
    usesAssert: boolean;
};

/** What an ES module import names: an existing file, a file without its extension, a directory or nothing. */
type ImportTarget = "file" | "missing-extension" | "directory" | "unresolved";

// Extensions Node and webpack load without further configuration; any other extension is part of the file name
const KNOWN_EXTENSIONS: ReadonlySet<string> = new Set([".js", ".mjs", ".cjs", ".json", ".node", ".wasm"]);

/** Extensionless relative import in an ES module (Node, webpack `fullySpecified`). */
export const checkMissingExtension: ImportRule = ({ file }, { kind }, context) =>
    kind !== "esm"
        ? []
        : collectRelativeImports(file)
              .filter(cur => getTarget(cur, context) === "missing-extension")
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
              .filter(cur => getTarget(cur, context) === "directory")
              .map(cur =>
                  finding(
                      ImportDiagnosticCode.DirectoryImport,
                      `relative import "${cur.specifier}" names a directory, which ES modules cannot import; ` +
                          (isFile(path.join(cur.resolved, "index.js"), context)
                              ? `import the file: "${cur.specifier.replace(/\/+$/, "")}/index.js"`
                              : "import a file inside the directory"),
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
    const resolves = (cur: RelativeImport): boolean =>
        kind === "esm"
            ? getTarget(cur, context) !== "unresolved"
            : isFile(cur.resolved, context) || AUTO_EXTENSIONS.some(ext => isFile(cur.resolved + ext, context)) || isDirectory(cur.resolved, context);
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
                      cur.usesAssert
                          ? `JSON import "${cur.specifier}" uses "assert", which Node does not support; replace "assert" with "with"`
                          : `JSON import "${cur.specifier}" has no import attribute, which Node requires; add: with { type: "json" }`,
                      cur
                  )
              );

export const IMPORT_RULES: readonly ImportRule[] = [checkMissingExtension, checkDirectoryImport, checkUnresolvedImport, checkJsonImportAttribute];

/** Runs every rule on relative imports. */
export const checkImports: ImportRule = (scan, classification, context) => IMPORT_RULES.flatMap(rule => rule(scan, classification, context));

const finding = (code: number, message: string, { start, length }: RelativeImport): ImportFinding => ({ code, message, start, length });

const targets = new WeakMap<ImportRuleContext, Map<string, ImportTarget>>();

/**
 * Tells what an import of an ES module names, once per path and context. Existing files are recognized without
 * probing for a directory; a missing name counts as extensionless when adding `.js` finds a file or its extension is
 * not one the runtime loads (e.g. `./user.service`).
 */
const getTarget = ({ specifier, resolved }: RelativeImport, context: ImportRuleContext): ImportTarget => {
    // `./utils/`, `.` and `..` name a directory even when a file of the same name exists
    const namesDirectory = /(?:^|\/)\.{0,2}$/.test(specifier);
    const key = namesDirectory ? `${resolved}${path.sep}` : resolved;
    const cached = memo(targets, context);
    let result = cached.get(key);
    if (!result) {
        if (namesDirectory) {
            result = isDirectory(resolved, context) ? "directory" : "unresolved";
        } else if (isFile(resolved, context)) {
            result = "file";
        } else if (isFile(`${resolved}.js`, context)) {
            result = "missing-extension";
        } else if (isDirectory(resolved, context)) {
            result = "directory";
        } else {
            result = KNOWN_EXTENSIONS.has(path.extname(resolved).toLowerCase()) ? "unresolved" : "missing-extension";
        }
        cached.set(key, result);
    }
    return result;
};

const memo = <T>(store: WeakMap<ImportRuleContext, Map<string, T>>, context: ImportRuleContext): Map<string, T> => {
    let result = store.get(context);
    if (!result) {
        result = new Map();
        store.set(context, result);
    }
    return result;
};

const isFile = (fileName: string, context: ImportRuleContext): boolean =>
    !!context.writtenFiles?.has(fileName) || context.system.fileExists(fileName);

const directories = new WeakMap<ImportRuleContext, Map<string, boolean>>();

/** True when a written file lies below the path or the file system has the directory, probed once per context. */
const isDirectory = (dirName: string, context: ImportRuleContext): boolean => {
    const cached = memo(directories, context);
    let result = cached.get(dirName);
    if (result === undefined) {
        result = (!!context.writtenFiles && getWrittenDirectories(context.writtenFiles).has(dirName)) || context.system.directoryExists(dirName);
        cached.set(dirName, result);
    }
    return result;
};

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
    const add = (literal: ts.Node, hasJsonAttribute: boolean, usesAssert: boolean): void => {
        if (ts.isStringLiteralLike(literal) && isRelative(literal.text)) {
            result.push({
                specifier: literal.text,
                resolved: path.resolve(path.dirname(file.fileName), literal.text),
                start: literal.getStart(file),
                length: literal.getWidth(file),
                hasJsonAttribute,
                usesAssert,
            });
        }
    };
    const visit = (node: ts.Node): void => {
        if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
            add(node.moduleSpecifier, hasStaticJsonAttribute(node.attributes), node.attributes?.token === ts.SyntaxKind.AssertKeyword);
        } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments.length > 0) {
            const options = node.arguments[1];
            add(
                node.arguments[0],
                hasDynamicJsonAttribute(options),
                !!options && ts.isObjectLiteralExpression(options) && !!findProperty(options, "assert")
            );
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
