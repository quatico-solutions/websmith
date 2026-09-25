/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { InfoMessage, type EsmProfileOptions, type Reporter } from "@quatico/websmith-api";
import path from "node:path";
import ts from "typescript";
import { CjsNamesDiagnosticCode, createCjsNamesCheck, type CjsNamesCache } from "./cjs-names";
import { classifyModule, createPackageTypeLookup, type DependencyCallback } from "./classify-module";
import { scanModule, type FreeReference } from "./scan-module";

export type EsmCheckContext = {
    /** File system used to read package.json files. */
    system: ts.System;
    /** Receives the `--debug` listing of ignored files. */
    reporter: Reporter;
    /** Directory that `esm.ignore` patterns are relative to. */
    projectDir: string;
    debug?: boolean;
    /** Profile and active addons, named in every diagnostic. */
    profile?: string;
    addons?: string[];
    /** Receives every package.json path the classification depends on, `exists` false for missing candidates. */
    onDependency?: DependencyCallback;
    /** Platform whose file name rules `esm.ignore` follows, defaults to `process.platform`. */
    platform?: NodeJS.Platform;
    /** Per-build memo of package resolution and CommonJS export detection, created per call when absent. */
    cjsNamesCache?: CjsNamesCache;
};

/** Stable diagnostic codes of the ESM check, one per rule (range 91000–91099). */
export const EsmDiagnosticCode = {
    FreeRequire: 91001,
    FreeModuleOrExports: 91002,
    FreeDirnameOrFilename: 91003,
    MixedCommonJsExport: 91004,
    MissingPackageType: 91005,
    ...CjsNamesDiagnosticCode,
} as const;

const JS_FILE = /\.[cm]?js$/i;

// ts.ModuleKind None, CommonJS, AMD, UMD, System: formats that cannot be loaded as ES modules
const NON_ESM_MODULE_KINDS = ["none", "commonjs", "amd", "umd", "system", "0", "1", "2", "3", "4"];

/** False when a `module` compiler option, given as name or `ts.ModuleKind`, emits a format that is not ESM. */
export const isEsmModuleKind = (module: ts.ModuleKind | string | undefined): boolean =>
    module === undefined || !NON_ESM_MODULE_KINDS.includes(String(module).toLowerCase());

const SCRIPT_TARGETS: ReadonlyMap<string, ts.ScriptTarget> = new Map([
    ...Object.entries(ts.ScriptTarget)
        .filter((cur): cur is [string, ts.ScriptTarget] => typeof cur[1] === "number")
        .map(([name, value]): [string, ts.ScriptTarget] => [name.toLowerCase(), value]),
    ["es6", ts.ScriptTarget.ES2015],
]);

/**
 * Returns the module format TypeScript emits for compiler options whose `module` and `target` are given as names
 * or enum values: `module` when set, otherwise ES2015 for a `target` of ES2015 or later and CommonJS below.
 */
export const getEmittedModuleKind = (options: { module?: ts.ModuleKind | string; target?: ts.ScriptTarget | string }): ts.ModuleKind | string => {
    if (options.module !== undefined) {
        return options.module;
    }
    const target = typeof options.target === "string" ? SCRIPT_TARGETS.get(options.target.toLowerCase()) : options.target;
    return (target ?? ts.ScriptTarget.ES5) >= ts.ScriptTarget.ES2015 ? ts.ModuleKind.ES2015 : ts.ModuleKind.CommonJS;
};

/**
 * Checks emitted JavaScript files for constructs that fail when the profile's runtime loads them as ES modules.
 * Files other than `.js`, `.mjs` and `.cjs` are skipped, as are files matching `esm.ignore`.
 */
export const checkEsm = (files: readonly ts.OutputFile[], esm: EsmProfileOptions, context: EsmCheckContext): ts.Diagnostic[] => {
    if (esm.check === "off" || (esm.runtime !== "node" && esm.runtime !== "bundler")) {
        return [];
    }
    const category = esm.check === "warn" ? ts.DiagnosticCategory.Warning : ts.DiagnosticCategory.Error;
    const suffix = describeOrigin(context);
    const lookupPackageType = createPackageTypeLookup(context.system, context.onDependency);
    const isIgnored = createIgnoreMatcher(esm.ignore, context);
    const checkCjsNames = createCjsNamesCheck(esm.runtime, context);

    return files
        .filter(cur => JS_FILE.test(cur.name) && !isIgnored(cur.name))
        .flatMap(cur => {
            const { file, hasEsmSyntax, freeReferences } = scanModule(cur.name, cur.text);
            const { kind, typeMissing } = classifyModule(cur.name, esm.runtime, hasEsmSyntax, lookupPackageType);
            const diagnostics: ts.Diagnostic[] = [];
            const report = (code: number, message: string, cat: ts.DiagnosticCategory, start = 0, length = 0) =>
                diagnostics.push({ category: cat, code, file, start, length, messageText: `ESM${code}: ${message}${suffix}.` });

            if (typeMissing) {
                report(
                    EsmDiagnosticCode.MissingPackageType,
                    `no "type" in the nearest package.json, Node detects the module format of this file from its syntax; ` +
                        `add "type": "module" to package.json`,
                    ts.DiagnosticCategory.Warning
                );
            }
            freeReferences.forEach(ref => {
                if (ref.commonJsExport && hasEsmSyntax && kind !== "commonjs") {
                    report(EsmDiagnosticCode.MixedCommonJsExport, describeMixedExport(ref), category, ref.start, ref.length);
                } else if (kind === "esm") {
                    const [code, message] = describeFreeReference(ref);
                    report(code, message, category, ref.start, ref.length);
                }
            });
            checkCjsNames(file, kind, (code, message, start, length) => report(code, message, category, start, length));
            return diagnostics;
        });
};

const describeFreeReference = ({ name }: FreeReference): [number, string] => {
    switch (name) {
        case "require":
            return [
                EsmDiagnosticCode.FreeRequire,
                `"require" is not defined in ES module output; use "import" or "createRequire(import.meta.url)" instead`,
            ];
        case "module":
        case "exports":
            return [EsmDiagnosticCode.FreeModuleOrExports, `"${name}" is not defined in ES module output; use "export" instead`];
        default:
            return [
                EsmDiagnosticCode.FreeDirnameOrFilename,
                `"${name}" is not defined in ES module output; use "fileURLToPath(import.meta.url)" from "node:url" instead`,
            ];
    }
};

const describeMixedExport = ({ name }: FreeReference): string => {
    const construct = name === "module" ? "module.exports" : "exports.x";
    return `ES module syntax mixed with a CommonJS "${construct} =" assignment, which fails at runtime; use "export" instead`;
};

const describeOrigin = ({ profile, addons = [] }: EsmCheckContext): string => {
    const parts = [...(profile ? [`profile "${profile}"`] : []), ...(addons.length ? [`addons: ${addons.join(", ")}`] : [])];
    return parts.length ? ` (${parts.join(", ")})` : "";
};

/**
 * Compiles the `esm.ignore` patterns once. Absolute patterns match the file name, others its path relative to the
 * project directory; a backslash counts as `/`, and on Windows the match ignores case.
 */
const createIgnoreMatcher = (patterns: unknown, context: EsmCheckContext): ((fileName: string) => boolean) => {
    const isWindows = (context.platform ?? process.platform) === "win32";
    const normalize = (value: string): string => {
        const result = value.replace(/\\/g, "/");
        return isWindows ? result.toLowerCase() : result;
    };
    const isAbsolute = (pattern: string): boolean => (isWindows ? path.win32 : path.posix).isAbsolute(pattern);
    const projectDir = normalize(context.projectDir);
    const matchers = (Array.isArray(patterns) ? patterns : [])
        .filter((cur): cur is string => typeof cur === "string")
        .map(pattern => ({ pattern, absolute: isAbsolute(pattern), regExp: globToRegExp(normalize(pattern)) }));

    return (fileName: string): boolean => {
        if (matchers.length === 0) {
            return false;
        }
        const file = normalize(fileName);
        const relativePath = path.posix.relative(projectDir, file);
        const match = matchers.find(cur => cur.regExp.test(cur.absolute ? file : relativePath));
        if (match && context.debug) {
            context.reporter.reportDiagnostic(new InfoMessage(`ESM check skipped "${fileName}": matches esm.ignore pattern "${match.pattern}".`));
        }
        return match !== undefined;
    };
};

/** Supports `**`, `*` and `?`; a leading `./` is ignored. */
const globToRegExp = (pattern: string): RegExp => {
    const glob = pattern.replace(/^\.\//, "");
    let result = "";
    for (let i = 0; i < glob.length; i++) {
        const char = glob[i];
        if (char === "*" && glob[i + 1] === "*") {
            const isSegment = glob[i + 2] === "/";
            result += isSegment ? "(?:.*/)?" : ".*";
            i += isSegment ? 2 : 1;
        } else if (char === "*") {
            result += "[^/]*";
        } else if (char === "?") {
            result += "[^/]";
        } else {
            result += char.replace(/[.+^${}()|[\]\\]/g, "\\$&");
        }
    }
    return new RegExp(`^${result}$`);
};
