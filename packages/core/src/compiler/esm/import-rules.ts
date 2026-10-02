/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import type { EsmRuntime } from "@quatico/websmith-api";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import { createCjsNamesCache, IMPORT_CONDITIONS, isBareSpecifier, resolvePackage, type CjsNamesCache } from "./cjs-names";
import type { DependencyCallback, ModuleClassification } from "./classify-module";
import type { ModuleScan } from "./scan-module";

/** Stable diagnostic codes of the rules on relative imports and, for 91013, bare imports. */
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
    /** Receives every file a bare specifier's resolution probed, also when the resolution comes from the cache. */
    onDependency?: DependencyCallback;
    /** Per-build memo of package resolution, created per context when absent. */
    cjsNamesCache?: CjsNamesCache;
};

export type ImportFinding = { code: number; message: string; start: number; length: number };

/** A rule over one scanned file: separately callable, so a caller can skip a rule without touching the others. */
export type ImportRule = (
    scan: Pick<ModuleScan, "file">,
    classification: Pick<ModuleClassification, "kind">,
    context: ImportRuleContext
) => ImportFinding[];

type CollectedImport = {
    specifier: string;
    /** True for a specifier that names a package, which only 91013 checks. */
    bare: boolean;
    /** True for `import()`, the only import a Node CommonJS file loads as ES module. */
    dynamic: boolean;
    start: number;
    length: number;
    /** True when the import carries `with { type: "json" }`. */
    hasJsonAttribute: boolean;
    /** True when the import carries an `assert` clause instead of `with`. */
    usesAssert: boolean;
};

/** A relative import with the file path the runtime derives from its specifier. */
type ResolvedImport = CollectedImport & {
    /** Absolute path the specifier names, undefined when the runtime rejects the specifier. */
    resolved?: string;
    /** The part of the specifier that names the path, without the query or fragment the runtime ignores. */
    specifierPath: string;
    /** The query and fragment the runtime ignores, kept by fix hints, empty when there are none. */
    specifierSuffix: string;
};

type SpecifierResolution = Omit<ResolvedImport, keyof CollectedImport>;

/** What an ES module import names: an existing file, a file without its extension, a directory or nothing. */
type ImportTarget = "file" | "missing-extension" | "directory" | "unresolved";

// Extensions Node and webpack load without further configuration; any other extension may be part of the file name
const KNOWN_EXTENSIONS: ReadonlySet<string> = new Set([".js", ".mjs", ".cjs", ".json", ".node", ".wasm"]);

/** Extensionless relative import in an ES module (Node, webpack `fullySpecified`) or a Node CommonJS `import()`. */
export const checkMissingExtension: ImportRule = ({ file }, { kind }, context) =>
    resolveImports(file, kind, context, ["esm"])
        .filter(cur => getTarget(cur, context) === "missing-extension")
        .map(cur =>
            finding(
                ImportDiagnosticCode.MissingExtension,
                `relative import "${cur.specifier}" has no file extension, which ES modules require; ` +
                    `add the extension: "${cur.specifierPath}.js${cur.specifierSuffix}"`,
                cur
            )
        );

/** Relative import of a directory in an ES module or a Node CommonJS `import()` (`ERR_UNSUPPORTED_DIR_IMPORT`). */
export const checkDirectoryImport: ImportRule = ({ file }, { kind }, context) =>
    resolveImports(file, kind, context, ["esm"])
        .filter(cur => getTarget(cur, context) === "directory")
        .map(cur =>
            finding(
                ImportDiagnosticCode.DirectoryImport,
                `relative import "${cur.specifier}" names a directory, which ES modules cannot import; ` +
                    (cur.resolved !== undefined && isFile(path.join(cur.resolved, "index.js"), context)
                        ? `import the file: "${cur.specifierPath.replace(/\/+$/, "")}/index.js${cur.specifierSuffix}"`
                        : "import a file inside the directory"),
                cur
            )
        );

// Candidates webpack tries for `javascript/auto`, where specifiers need not be fully specified
const AUTO_EXTENSIONS = [".js", ".mjs", ".cjs", ".json"];

const hasAutoExtension = (fileName: string, context: ImportRuleContext): boolean => AUTO_EXTENSIONS.some(ext => isFile(fileName + ext, context));

/**
 * Relative import that resolves to no file written in this run or on disk. Extensionless and directory imports of
 * ES modules are left to 91010 and 91011; `javascript/auto` files resolve them like webpack does, a directory only
 * when it holds an index file or a package.json with an entry field.
 */
export const checkUnresolvedImport: ImportRule = ({ file }, { kind }, context) =>
    resolveImports(file, kind, context, ["esm", "auto"]).flatMap(cur => {
        const target = kind === "auto" ? getAutoTarget(cur, context) : getTarget(cur, context);
        if (target === "entryless-directory") {
            return [
                finding(
                    ImportDiagnosticCode.UnresolvedImport,
                    `relative import "${cur.specifier}" names a directory with no index file and no package.json entry; ` +
                        'if your webpack config sets `resolve.mainFiles` or `resolve.mainFields`, use `esm.ignore` or `check: "warn"`',
                    cur
                ),
            ];
        }
        return target === "unresolved"
            ? [
                  finding(
                      ImportDiagnosticCode.UnresolvedImport,
                      `relative import "${cur.specifier}" resolves to no file written by this build or on disk`,
                      cur
                  ),
              ]
            : [];
    });

const JSON_FILE = /\.json$/i;

/**
 * JSON import without `with { type: "json" }` in a Node ES module or a Node CommonJS `import()`
 * (`ERR_IMPORT_ATTRIBUTE_MISSING`). A bare specifier imports JSON when its name ends in `.json` or its package
 * resolves it to a `.json` file.
 */
export const checkJsonImportAttribute: ImportRule = ({ file }, { kind }, context) =>
    context.runtime !== "node"
        ? []
        : selectImports(file, kind, context, ["esm"])
              .filter(
                  cur =>
                      !cur.hasJsonAttribute &&
                      (cur.bare
                          ? importsPackageJson(cur.specifier, file.fileName, context)
                          : JSON_FILE.test(resolveImport(cur, file, kind, context).resolved ?? ""))
              )
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

const finding = (code: number, message: string, { start, length }: CollectedImport): ImportFinding => ({ code, message, start, length });

const targets = new WeakMap<ImportRuleContext, Map<string, ImportTarget>>();

/**
 * Tells what an import of an ES module names, once per path and context. Existing files are recognized without
 * probing for a directory. A missing name counts as extensionless when it has no extension, or when its extension is
 * not one the runtime loads and adding `.js` finds a file (e.g. `./user.service`); otherwise it is unresolved.
 */
const getTarget = ({ specifierPath, resolved }: ResolvedImport, context: ImportRuleContext): ImportTarget => {
    if (resolved === undefined) {
        return "unresolved";
    }
    // `./utils/`, `.` and `..` name a directory even when a file of the same name exists
    const namesDirectory = /(?:^|\/)\.{0,2}$/.test(specifierPath);
    const key = namesDirectory ? `${resolved}${path.sep}` : resolved;
    const cached = memo(targets, context);
    let result = cached.get(key);
    if (!result) {
        if (namesDirectory) {
            result = isDirectory(resolved, context) ? "directory" : "unresolved";
        } else if (isFile(resolved, context)) {
            result = "file";
        } else if (!KNOWN_EXTENSIONS.has(path.extname(resolved).toLowerCase()) && isFile(`${resolved}.js`, context)) {
            result = "missing-extension";
        } else if (isDirectory(resolved, context)) {
            result = "directory";
        } else {
            result = path.extname(resolved) === "" ? "missing-extension" : "unresolved";
        }
        cached.set(key, result);
    }
    return result;
};

/** What a `javascript/auto` import names for webpack: a file, a directory it loads or not, or nothing. */
type AutoTarget = "file" | "directory" | "entryless-directory" | "unresolved";

/**
 * Tells what an import of a `javascript/auto` file names with webpack's default resolution. A directory resolves when
 * it holds an index file or a package.json with an entry field; whether that entry exists is not probed.
 */
const getAutoTarget = ({ resolved }: ResolvedImport, context: ImportRuleContext): AutoTarget => {
    if (resolved === undefined) {
        return "unresolved";
    }
    if (isFile(resolved, context) || hasAutoExtension(resolved, context)) {
        return "file";
    }
    if (!isDirectory(resolved, context)) {
        return "unresolved";
    }
    return hasAutoExtension(path.join(resolved, "index"), context) || hasEntryField(path.join(resolved, "package.json"), context)
        ? "directory"
        : "entryless-directory";
};

// Fields webpack reads a directory's entry from by default
const ENTRY_FIELDS = ["main", "module", "browser"];

/** True when a package.json has a non-empty string in an entry field; a missing or unparsable file has none. */
const hasEntryField = (packageJson: string, context: ImportRuleContext): boolean => {
    let manifest: unknown;
    try {
        manifest = JSON.parse(context.system.readFile(packageJson) ?? "");
    } catch {
        return false;
    }
    return (
        typeof manifest === "object" &&
        manifest !== null &&
        ENTRY_FIELDS.some(cur => {
            const value = (manifest as Record<string, unknown>)[cur];
            return typeof value === "string" && value !== "";
        })
    );
};

const packageCaches = new WeakMap<ImportRuleContext, CjsNamesCache>();

/**
 * True when Node loads a bare specifier as JSON: its name ends in `.json`, or its package resolves it to a `.json`
 * file with Node's import conditions. The files the resolution probed are replayed to `onDependency`.
 */
const importsPackageJson = (specifier: string, importer: string, context: ImportRuleContext): boolean => {
    if (JSON_FILE.test(specifier)) {
        return true;
    }
    let cache = context.cjsNamesCache ?? packageCaches.get(context);
    if (!cache) {
        cache = createCjsNamesCache();
        packageCaches.set(context, cache);
    }
    const resolution = resolvePackage(specifier, path.dirname(importer), IMPORT_CONDITIONS, context.runtime, context.system, cache);
    resolution.dependencies.forEach(([fileName, exists]) => context.onDependency?.(fileName, exists));
    return resolution.entry !== undefined && JSON_FILE.test(resolution.entry);
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

const cache = new WeakMap<ts.SourceFile, CollectedImport[]>();

/** Relative and bare specifiers of static imports, re-exports and `import()` with a string literal, in source order. */
const collectImports = (file: ts.SourceFile): CollectedImport[] => {
    const cached = cache.get(file);
    if (cached) {
        return cached;
    }
    const result: CollectedImport[] = [];
    const add = (literal: ts.Node, dynamic: boolean, hasJsonAttribute: boolean, usesAssert: boolean): void => {
        if (ts.isStringLiteralLike(literal) && (isRelative(literal.text) || isBareSpecifier(literal.text))) {
            result.push({
                specifier: literal.text,
                bare: !isRelative(literal.text),
                dynamic,
                start: literal.getStart(file),
                length: literal.getWidth(file),
                hasJsonAttribute,
                usesAssert,
            });
        }
    };
    const visit = (node: ts.Node): void => {
        if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
            add(node.moduleSpecifier, false, hasStaticJsonAttribute(node.attributes), node.attributes?.token === ts.SyntaxKind.AssertKeyword);
        } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments.length > 0) {
            const options = node.arguments[1];
            add(
                node.arguments[0],
                true,
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

const resolutions = new WeakMap<ImportRuleContext, Map<string, SpecifierResolution>>();

/**
 * The imports of a file a rule checks: every one in a file of the given kinds, only `import()` in a Node CommonJS file,
 * which Node loads as ES module whatever the importing file is.
 */
const selectImports = (
    file: ts.SourceFile,
    kind: ModuleClassification["kind"],
    context: ImportRuleContext,
    kinds: readonly ModuleClassification["kind"][]
): CollectedImport[] =>
    collectImports(file).filter(cur => kinds.includes(kind) || (kind === "commonjs" && context.runtime === "node" && cur.dynamic));

/** The relative imports a rule checks, with the paths the context's runtime derives from them. */
const resolveImports = (
    file: ts.SourceFile,
    kind: ModuleClassification["kind"],
    context: ImportRuleContext,
    kinds: readonly ModuleClassification["kind"][]
): ResolvedImport[] =>
    selectImports(file, kind, context, kinds)
        .filter(cur => !cur.bare)
        .map(cur => resolveImport(cur, file, kind, context));

/** A relative import with the path the context's runtime derives from it, resolved once per context. */
const resolveImport = (cur: CollectedImport, file: ts.SourceFile, kind: ModuleClassification["kind"], context: ImportRuleContext): ResolvedImport => {
    const cached = memo(resolutions, context);
    const key = `${kind}\0${file.fileName}\0${cur.specifier}`;
    let result = cached.get(key);
    if (!result) {
        result =
            context.runtime === "node"
                ? resolveNodeSpecifier(cur.specifier, file.fileName)
                : resolveBundlerSpecifier(cur.specifier, file.fileName, kind, context);
        cached.set(key, result);
    }
    return { ...cur, ...result };
};

const splitSpecifier = (specifier: string): { specifierPath: string; specifierSuffix: string } => {
    const index = specifier.search(/[?#]/);
    return index < 0
        ? { specifierPath: specifier, specifierSuffix: "" }
        : { specifierPath: specifier.slice(0, index), specifierSuffix: specifier.slice(index) };
};

/**
 * Derives the path like Node: the specifier is a URL relative to the importing file, so the query and fragment are
 * dropped, percent-encoding is decoded and dot segments are normalized. Node rejects an encoded `/` or `\`.
 */
const resolveNodeSpecifier = (specifier: string, importer: string): SpecifierResolution => {
    const parts = splitSpecifier(specifier);
    if (/%2f|%5c/i.test(parts.specifierPath)) {
        return parts;
    }
    try {
        return { ...parts, resolved: path.resolve(fileURLToPath(new URL(specifier, pathToFileURL(importer)))) };
    } catch {
        return parts;
    }
};

/**
 * Derives the path like webpack: the specifier as written when it names an existing file or directory (in
 * `javascript/auto` also with an added extension), otherwise without query and fragment. Nothing is decoded.
 */
const resolveBundlerSpecifier = (
    specifier: string,
    importer: string,
    kind: ModuleClassification["kind"],
    context: ImportRuleContext
): SpecifierResolution => {
    const asWritten = path.resolve(path.dirname(importer), specifier);
    const parts = splitSpecifier(specifier);
    const exists = (): boolean =>
        isFile(asWritten, context) || isDirectory(asWritten, context) || (kind === "auto" && hasAutoExtension(asWritten, context));
    return parts.specifierSuffix === "" || exists()
        ? { resolved: asWritten, specifierPath: specifier, specifierSuffix: "" }
        : { ...parts, resolved: path.resolve(path.dirname(importer), parts.specifierPath) };
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
