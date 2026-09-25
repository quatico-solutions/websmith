/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { InfoMessage, type EsmRuntime } from "@quatico/websmith-api";
import { initSync, parse } from "cjs-module-lexer";
import { isBuiltin } from "node:module";
import path from "node:path";
import { exports as resolveExports } from "resolve.exports";
import ts from "typescript";
import type { EsmCheckContext } from "./check-esm";
import { classifyModule, createPackageTypeLookup, type ModuleClassification } from "./classify-module";
import { scanModule } from "./scan-module";

/** Diagnostic codes of the rules on names imported from CommonJS packages. */
export const CjsNamesDiagnosticCode = {
    MissingCommonJsExport: 91020,
    DefaultImportOfEsModule: 91021,
} as const;

type Dependency = [fileName: string, exists: boolean];

type Resolution = { entry?: string; reason?: string; dependencies: Dependency[] };

/** How a resolved package entry loads: as ES module, as CommonJS with the names the lexer detects, or unknown. */
type EntryAnalysis = ({ kind: "esm" } | { kind: "commonjs"; names: ReadonlySet<string> } | { kind: "unknown"; reason: string }) & {
    dependencies: Dependency[];
};

/**
 * Per-build memo of bare-specifier resolutions, keyed by importing directory and specifier, and of export detection,
 * keyed by resolved entry. Drop it when the packages may have changed, e.g. once per compilation.
 */
export type CjsNamesCache = {
    resolutions: Map<string, Resolution>;
    entries: Map<string, EntryAnalysis>;
};

export const createCjsNamesCache = (): CjsNamesCache => ({ resolutions: new Map(), entries: new Map() });

type ReportCallback = (code: number, message: string, start: number, length: number) => void;

type ImportedName = { name: string; node: ts.Node };

/** A default import: `node` locates the diagnostic, `local` is the binding, absent for `export { default } from`. */
type DefaultImport = { node: ts.Node; local?: ts.Identifier };

const IMPORT_CONDITIONS = ["node", "import", "module-sync", "default"];
const REQUIRE_CONDITIONS = ["node", "require", "default"];
const MAX_REEXPORT_DEPTH = 32;
// Names Node provides for every CommonJS module, whatever the lexer detects
const ALWAYS_EXPORTED: ReadonlySet<string> = new Set(["default", "module.exports"]);

let lexerReady = false;

/**
 * Creates the rules on bare imports of CommonJS packages in ES module output: a named import that Node's
 * `cjs-module-lexer` does not detect in the package (91020, `node` only), and a default import from a module that
 * exports both `__esModule` and `default` and whose binding is used other than through property access (91021).
 * Imports whose package cannot be resolved or fully analyzed are skipped and listed
 * with `--debug`. Every file read is reported to `onDependency`, also when the result comes from the cache.
 */
export const createCjsNamesCheck = (
    runtime: EsmRuntime,
    context: EsmCheckContext
): ((file: ts.SourceFile, kind: ModuleClassification["kind"], report: ReportCallback) => void) => {
    const cache = context.cjsNamesCache ?? createCjsNamesCache();
    const replay = (dependencies: Dependency[]): void => dependencies.forEach(([fileName, exists]) => context.onDependency?.(fileName, exists));

    const skipped = new Set<string>();

    const analyze = (specifier: string, importer: string): EntryAnalysis => {
        const resolution = resolvePackage(specifier, path.dirname(importer), IMPORT_CONDITIONS, runtime, context.system, cache);
        replay(resolution.dependencies);
        if (!resolution.entry) {
            return { kind: "unknown", reason: resolution.reason ?? "cannot resolve the package entry", dependencies: [] };
        }
        const key = `${runtime}\0${toKey(resolution.entry)}`;
        const analysis = cache.entries.get(key) ?? analyzeEntry(resolution.entry, runtime, context.system, cache);
        cache.entries.set(key, analysis);
        replay(analysis.dependencies);
        return analysis;
    };

    return (file, kind, report) => {
        if (kind !== "esm") {
            return;
        }
        file.statements.forEach(statement => {
            const specifier = readBareSpecifier(statement);
            const { defaults: allDefaults, named } = readImportedNames(statement);
            const defaults = allDefaults.filter(cur => !cur.local || isUsedAsValue(cur.local, file));
            const checksNames = runtime === "node" && named.length > 0;
            if (!specifier || (!checksNames && defaults.length === 0)) {
                return;
            }
            const analysis = analyze(specifier, file.fileName);
            if (analysis.kind === "unknown") {
                if (context.debug && !skipped.has(specifier)) {
                    skipped.add(specifier);
                    context.reporter.reportDiagnostic(
                        new InfoMessage(`ESM check skipped "${specifier}" imported by "${file.fileName}": ${analysis.reason}.`)
                    );
                }
                return;
            }
            if (analysis.kind === "esm") {
                return;
            }
            if (analysis.names.has("__esModule") && analysis.names.has("default")) {
                defaults.forEach(({ node, local }) =>
                    report(
                        CjsNamesDiagnosticCode.DefaultImportOfEsModule,
                        `default import of CommonJS module "${specifier}", which sets "__esModule", is its whole "module.exports", ` +
                            `not its default export; read its "default" property (\`${local?.text ?? "pkg"}.default\`) or use a named import`,
                        node.getStart(file),
                        node.getWidth(file)
                    )
                );
            }
            if (checksNames) {
                named
                    .filter(cur => !ALWAYS_EXPORTED.has(cur.name) && !analysis.names.has(cur.name))
                    .forEach(cur =>
                        report(
                            CjsNamesDiagnosticCode.MissingCommonJsExport,
                            `"${cur.name}" is not a named export of CommonJS module "${specifier}" as Node detects it; ` +
                                `use a default import and read "${cur.name}" from it`,
                            cur.node.getStart(file),
                            cur.node.getWidth(file)
                        )
                    );
            }
        });
    };
};

/** Returns the specifier of an `import … from` or `export … from` declaration when it names a package. */
const readBareSpecifier = (statement: ts.Statement): string | undefined => {
    const moduleSpecifier = ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement) ? statement.moduleSpecifier : undefined;
    const specifier = moduleSpecifier && ts.isStringLiteral(moduleSpecifier) ? moduleSpecifier.text : undefined;
    return specifier && isBareSpecifier(specifier) ? specifier : undefined;
};

const isBareSpecifier = (specifier: string): boolean => !/^[./#]/.test(specifier) && !/^[a-z][a-z0-9+.-]*:/i.test(specifier) && !isBuiltin(specifier);

/** Splits the bindings of a declaration into default imports (`def`, `{ default as x }`) and other named ones. */
const readImportedNames = (statement: ts.Statement): { defaults: DefaultImport[]; named: ImportedName[] } => {
    const elements: readonly (ts.ImportSpecifier | ts.ExportSpecifier)[] =
        ts.isImportDeclaration(statement) && statement.importClause?.namedBindings && ts.isNamedImports(statement.importClause.namedBindings)
            ? statement.importClause.namedBindings.elements
            : ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)
              ? statement.exportClause.elements
              : [];
    const names = elements.map(cur => ({
        name: (cur.propertyName ?? cur.name).text,
        node: cur.propertyName ?? cur.name,
        // An export specifier re-exports the namespace object itself, which counts as a use other than property access
        local: ts.isImportSpecifier(cur) && ts.isIdentifier(cur.name) ? cur.name : undefined,
    }));
    const defaultBinding = ts.isImportDeclaration(statement) ? statement.importClause?.name : undefined;
    return {
        defaults: [
            ...(defaultBinding ? [{ node: defaultBinding, local: defaultBinding }] : []),
            ...names.filter(cur => cur.name === "default").map(({ node, local }) => ({ node, local })),
        ],
        named: names.filter(cur => cur.name !== "default").map(({ name, node }) => ({ name, node })),
    };
};

/**
 * True when a file references a binding other than as the object of a property access (`pkg.x`, `pkg["x"]`):
 * called, passed, spread, returned, compared or exported. Shadowing declarations are not told apart.
 */
const isUsedAsValue = (binding: ts.Identifier, file: ts.SourceFile): boolean => {
    const visit = (node: ts.Node): boolean => {
        if (ts.isIdentifier(node) && node !== binding && node.text === binding.text && isValueReference(node)) {
            const parent = node.parent;
            const isPropertyAccess = (ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent)) && parent.expression === node;
            if (!isPropertyAccess) {
                return true;
            }
        }
        return !!ts.forEachChild(node, cur => visit(cur) || undefined);
    };
    return visit(file);
};

/** False for identifiers that name a property, a declaration, an import binding or a label instead of a value. */
const isValueReference = (node: ts.Identifier): boolean => {
    const parent = node.parent;
    if (ts.isShorthandPropertyAssignment(parent)) {
        return true;
    }
    if (ts.isExportSpecifier(parent)) {
        return !parent.parent.parent.moduleSpecifier && (parent.propertyName ?? parent.name) === node;
    }
    return !(
        ("name" in parent && parent.name === node) ||
        ("propertyName" in parent && parent.propertyName === node) ||
        ts.isLabeledStatement(parent) ||
        ts.isBreakOrContinueStatement(parent)
    );
};

/** Cache keys use `/` so that paths spelled with `\` on Windows share an entry. */
const toKey = (fileName: string): string => fileName.replace(/\\/g, "/");

/**
 * Resolves a bare specifier like Node: the nearest `node_modules/<name>/package.json` upwards from `fromDir`, then its
 * `"exports"` with the given conditions, or without `"exports"` its `main` and `index.js`.
 */
const resolvePackage = (
    specifier: string,
    fromDir: string,
    conditions: string[],
    runtime: EsmRuntime,
    system: ts.System,
    cache: CjsNamesCache
): Resolution => {
    const key = `${runtime}\0${conditions.join(",")}\0${toKey(fromDir)}\0${specifier}`;
    const cached = cache.resolutions.get(key);
    if (cached) {
        return cached;
    }
    const dependencies: Dependency[] = [];
    const probe = (fileName: string): boolean => {
        const exists = system.fileExists(fileName);
        dependencies.push([fileName, exists]);
        return exists;
    };
    const segments = specifier.split("/");
    const nameLength = specifier.startsWith("@") ? 2 : 1;
    const name = segments.slice(0, nameLength).join("/");
    const subpath = segments.length > nameLength ? `./${segments.slice(nameLength).join("/")}` : ".";

    let result: Omit<Resolution, "dependencies"> = { reason: "package not found in node_modules" };
    for (let dir = fromDir; ; dir = path.dirname(dir)) {
        const packageDir = path.join(dir, "node_modules", name);
        const packageJson = path.join(packageDir, "package.json");
        if (path.basename(dir) !== "node_modules" && probe(packageJson)) {
            result = resolveEntry(packageDir, packageJson, subpath, conditions, runtime, system, probe);
            result = result.entry ? { entry: toRealPath(result.entry, system, dependencies) } : result;
            break;
        }
        if (path.dirname(dir) === dir) {
            break;
        }
    }
    const resolution = { ...result, dependencies };
    cache.resolutions.set(key, resolution);
    return resolution;
};

const resolveEntry = (
    packageDir: string,
    packageJson: string,
    subpath: string,
    conditions: string[],
    runtime: EsmRuntime,
    system: ts.System,
    probe: (fileName: string) => boolean
): Omit<Resolution, "dependencies"> => {
    let manifest: unknown;
    try {
        manifest = JSON.parse(system.readFile(packageJson) ?? "");
    } catch {
        manifest = undefined;
    }
    if (typeof manifest !== "object" || manifest === null) {
        return { reason: `cannot read "${packageJson}"` };
    }
    let candidates: string[];
    if ("exports" in manifest && manifest.exports !== undefined && manifest.exports !== null) {
        try {
            candidates = (resolveExports(manifest, subpath, { conditions, unsafe: true }) ?? []).slice(0, 1);
        } catch {
            return { reason: `"${subpath}" is not exported by "${packageJson}"` };
        }
    } else if (runtime === "bundler" && ("module" in manifest || "browser" in manifest)) {
        // Bundlers prefer these fields over main, and which one they pick depends on their configuration
        return { reason: `"${packageJson}" has a "module" or "browser" field and no "exports", the bundler may not load its main entry` };
    } else if (subpath === ".") {
        const main =
            "main" in manifest && typeof manifest.main === "string" && manifest.main
                ? [manifest.main, `${manifest.main}.js`, `${manifest.main}/index.js`]
                : [];
        candidates = [...main, "index.js"];
    } else {
        candidates = [subpath];
    }
    const entry = candidates.map(cur => path.join(packageDir, cur)).find(probe);
    return entry ? { entry } : { reason: `no entry file for "${subpath}" in "${packageDir}"` };
};

/**
 * Classifies a package entry with the runtime's rules and, for CommonJS, collects the export names that
 * `cjs-module-lexer` detects, following re-exports the way Node does.
 */
const analyzeEntry = (entry: string, runtime: EsmRuntime, system: ts.System, cache: CjsNamesCache): EntryAnalysis => {
    const dependencies: Dependency[] = [];
    const read = (fileName: string): string | undefined => {
        const source = system.readFile(fileName);
        dependencies.push([fileName, source !== undefined]);
        return source;
    };
    const source = read(entry);
    const extension = path.extname(entry).toLowerCase();
    if (source === undefined || ![".js", ".cjs", ".mjs"].includes(extension)) {
        return { kind: "unknown", reason: `entry "${entry}" is not a readable JavaScript file`, dependencies };
    }
    const lookupPackageType = createPackageTypeLookup(system, (fileName, exists) => dependencies.push([fileName, exists]));
    const needsSyntax = extension === ".js" && !lookupPackageType(entry)?.type;
    const hasEsmSyntax = needsSyntax && scanModule(entry, source).hasEsmSyntax;
    const { kind } = classifyModule(entry, runtime, hasEsmSyntax, lookupPackageType);
    if (kind === "esm" || (kind === "auto" && hasEsmSyntax)) {
        return { kind: "esm", dependencies };
    }

    const names = new Set<string>();
    const visited = new Set<string>();
    const visit = (fileName: string, text: string | undefined, depth: number): string | undefined => {
        if (visited.has(fileName)) {
            return undefined;
        }
        visited.add(fileName);
        if (text === undefined) {
            return `cannot read "${fileName}"`;
        }
        if (depth > MAX_REEXPORT_DEPTH) {
            return `re-exports nested deeper than ${MAX_REEXPORT_DEPTH} levels in "${fileName}"`;
        }
        let lexed: { exports: string[]; reexports: string[] };
        try {
            if (!lexerReady) {
                initSync();
                lexerReady = true;
            }
            lexed = parse(text, fileName);
        } catch {
            return `cjs-module-lexer cannot parse "${fileName}"`;
        }
        lexed.exports.forEach(cur => names.add(cur));
        for (const specifier of lexed.reexports) {
            const target = resolveReexport(specifier, fileName, runtime, system, cache, dependencies);
            if (target === undefined) {
                return `cannot resolve re-export "${specifier}" in "${fileName}"`;
            }
            // Like Node, only follow re-exports of JavaScript files; builtins and other extensions add no names
            const targetExtension = path.extname(target).toLowerCase();
            if (path.isAbsolute(target) && [".js", ".cjs", ""].includes(targetExtension) && !visited.has(target)) {
                const reason = visit(target, read(target), depth + 1);
                if (reason) {
                    return reason;
                }
            }
        }
        return undefined;
    };
    const reason = visit(entry, source, 0);
    return reason ? { kind: "unknown", reason, dependencies } : { kind: "commonjs", names, dependencies };
};

/** Resolves a re-exported specifier the way Node's `require` does from the re-exporting file. */
const resolveReexport = (
    specifier: string,
    fromFile: string,
    runtime: EsmRuntime,
    system: ts.System,
    cache: CjsNamesCache,
    dependencies: Dependency[]
): string | undefined => {
    if (isBuiltin(specifier)) {
        return specifier;
    }
    if (/^\.\.?(\/|$)/.test(specifier) || path.isAbsolute(specifier)) {
        const base = path.resolve(path.dirname(fromFile), specifier);
        const target = [base, `${base}.js`, path.join(base, "index.js")].find(cur => {
            const exists = system.fileExists(cur);
            dependencies.push([cur, exists]);
            return exists;
        });
        return target && toRealPath(target, system, dependencies);
    }
    const resolution = resolvePackage(specifier, path.dirname(fromFile), REQUIRE_CONDITIONS, runtime, system, cache);
    dependencies.push(...resolution.dependencies);
    return resolution.entry;
};

/** Follows symlinks like Node, e.g. into pnpm's `.pnpm` store, recording the real path when it differs. */
const toRealPath = (fileName: string, system: ts.System, dependencies: Dependency[]): string => {
    const realPath = system.realpath?.(fileName) ?? fileName;
    if (realPath !== fileName) {
        dependencies.push([realPath, true]);
    }
    return realPath;
};
