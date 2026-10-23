/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import path from "node:path";
import ts from "typescript";

// The language service reuses unchanged source files across Programs, so each file version is walked once
const edgesCache = new WeakMap<ts.SourceFile, string[]>();
const globalFilesCache = new WeakMap<ts.Program, string[]>();

/**
 * Returns the project files the type check of `fileName` in `program` reads: the files it imports transitively, for
 * values or for types only, also through re-exports, and the global files of the Program, i.e. its scripts, ambient
 * declaration files and modules with a `declare global` or `declare module "…"`. A project file is a source file of the
 * Program that is no default library and has no `node_modules` segment. `fileName` itself is not listed.
 */
export const getTypeDependencies = (program: ts.Program, fileName: string): string[] => {
    const start = program.getSourceFile(fileName);
    if (!start) {
        return [];
    }
    const result = new Set<string>();
    const visited = new Set<ts.SourceFile>([start]);
    const queue = [start];
    while (queue.length > 0) {
        const cur = queue.shift() as ts.SourceFile;
        for (const name of getEdges(program, cur)) {
            const next = program.getSourceFile(name);
            if (next && !visited.has(next) && isProjectFile(program, next)) {
                visited.add(next);
                result.add(next.fileName);
                queue.push(next);
            }
        }
    }
    getGlobalFiles(program)
        .filter(cur => cur !== start.fileName)
        .forEach(cur => result.add(cur));
    return [...result];
};

const isProjectFile = (program: ts.Program, file: ts.SourceFile): boolean =>
    !program.isSourceFileDefaultLibrary(file) && !/[\\/]node_modules[\\/]/.test(file.fileName);

const getGlobalFiles = (program: ts.Program): string[] => {
    let result = globalFilesCache.get(program);
    if (!result) {
        result = program
            .getSourceFiles()
            .filter(cur => isProjectFile(program, cur) && !/\.json$/i.test(cur.fileName) && (!ts.isExternalModule(cur) || hasAugmentation(cur)))
            .map(cur => cur.fileName);
        globalFilesCache.set(program, result);
    }
    return result;
};

/** True when a top-level statement of `file` is a `declare global` or a `declare module "…"`. */
const hasAugmentation = (file: ts.SourceFile): boolean =>
    file.statements.some(
        cur =>
            ts.isModuleDeclaration(cur) &&
            (ts.isStringLiteral(cur.name) || (cur.flags & ts.NodeFlags.GlobalAugmentation) !== 0 || cur.name.text === "global")
    );

/** Returns the files the module specifiers and reference paths of `file` resolve to in `program`. */
const getEdges = (program: ts.Program, file: ts.SourceFile): string[] => {
    let result = edgesCache.get(file);
    if (!result) {
        const checker = program.getTypeChecker();
        const names = new Set<string>();
        const add = (specifier: ts.Expression | undefined): void => {
            if (specifier && ts.isStringLiteralLike(specifier)) {
                const target = checker.getSymbolAtLocation(specifier)?.declarations?.[0]?.getSourceFile();
                if (target && target !== file) {
                    names.add(target.fileName);
                }
            }
        };
        for (const cur of file.statements) {
            if (ts.isImportDeclaration(cur) || ts.isExportDeclaration(cur)) {
                add(cur.moduleSpecifier);
            } else if (ts.isImportEqualsDeclaration(cur) && ts.isExternalModuleReference(cur.moduleReference)) {
                add(cur.moduleReference.expression);
            }
        }
        if (file.text.includes("import(")) {
            const visit = (node: ts.Node): void => {
                if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
                    add(node.argument.literal);
                } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
                    add(node.arguments[0]);
                }
                ts.forEachChild(node, visit);
            };
            visit(file);
        }
        for (const cur of file.referencedFiles) {
            const target = program.getSourceFile(path.posix.resolve(path.posix.dirname(file.fileName), cur.fileName));
            if (target) {
                names.add(target.fileName);
            }
        }
        result = [...names];
        edgesCache.set(file, result);
    }
    return result;
};
