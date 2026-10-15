/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { ErrorMessage } from "@quatico/websmith-api";
import { getEffectiveTarget, getEmittedModuleKind, isEsmModuleKind } from "@quatico/websmith-core";
import path from "node:path";
import ts from "typescript";

/**
 * Selects the diagnostics the plugin raises at the end of a build: the errors, only in a build that has not failed
 * already. A dev server calls buildEnd on close without an error, where raising would abort the closing plugins.
 */
export const selectConfigErrors = (command: "build" | "serve", buildError: unknown, diagnostics: readonly ts.Diagnostic[]): ts.Diagnostic[] =>
    command === "build" && !buildError ? diagnostics.filter(cur => cur.category === ts.DiagnosticCategory.Error) : [];

/**
 * Returns a configuration error when the profile's effective `module`, or without one its `target`, makes TypeScript
 * emit a format Vite cannot bundle as an ES module, e.g. CommonJS. Returns nothing when the profile sets `esm`, which
 * core reports for that case already.
 */
export const checkTargetModule = (profile: string | undefined, tsConfig: ts.CompilerOptions, hasEsm: boolean): ts.Diagnostic | undefined => {
    const { module } = tsConfig;
    const target = getEffectiveTarget(tsConfig);
    if (hasEsm || isEsmModuleKind(getEmittedModuleKind({ module, target }))) {
        return undefined;
    }
    const emitted = typeof module === "number" ? ts.ModuleKind[module] : (module ?? "CommonJS");
    const cause =
        module === undefined
            ? `'tsConfig.module' is unset and 'target' is '${ts.ScriptTarget[target]}'`
            : `'tsConfig.module' is '${String(emitted).toLowerCase()}'`;
    const subject = profile ? `Profile '${profile}'` : "The default profile";
    return new ErrorMessage(`${subject} emits ${emitted} (${cause}), which Vite cannot bundle as an ES module. Use "ESNext" or "ES2022".`);
};

// The nearest package.json above `fileName`, which decides the format of a .ts or .js file under node16 and nodenext
const findPackageJson = (fileName: string, system: ts.System): string | undefined => {
    for (let dir = path.dirname(fileName); ; dir = path.dirname(dir)) {
        const candidate = path.join(dir, "package.json");
        if (system.fileExists(candidate)) {
            return candidate;
        }
        if (path.dirname(dir) === dir) {
            return undefined;
        }
    }
};

/**
 * Returns a configuration error when the profile's `module` is `node16` or `nodenext` and TypeScript emits the module
 * `fileName` as CommonJS, which Vite cannot bundle as an ES module: a `.cts` file, or a file whose nearest
 * `package.json` has no `"type": "module"`. Returns that `package.json`, which decides the format, for the caller to
 * watch. Returns nothing when the profile sets `esm`, which core reports for that case already.
 */
export const checkModuleFormat = (
    profile: string | undefined,
    fileName: string,
    tsConfig: ts.CompilerOptions,
    hasEsm: boolean,
    system: ts.System,
    cache: ts.PackageJsonInfoCache
): { error?: ts.Diagnostic; packageJson?: string } => {
    const { module } = tsConfig;
    // A numeric range, since TypeScript 5.8 adds Node18 and Node20 between Node16 and NodeNext
    if (hasEsm || module === undefined || module < ts.ModuleKind.Node16 || module > ts.ModuleKind.NodeNext) {
        return {};
    }
    const isCts = /\.cts$/i.test(fileName);
    const packageJson = isCts ? undefined : findPackageJson(fileName, system);
    if (ts.getImpliedNodeFormatForFile(fileName, cache, system, tsConfig) !== ts.ModuleKind.CommonJS) {
        return packageJson ? { packageJson } : {};
    }
    const reason = isCts
        ? "the file has the .cts extension"
        : packageJson
          ? `the nearest package.json '${packageJson}' has no "type": "module"`
          : `no package.json above it has "type": "module"`;
    const subject = profile ? `Profile '${profile}'` : "The default profile";
    const kind = String(ts.ModuleKind[module]).toLowerCase();
    const error = new ErrorMessage(
        `${subject} emits CommonJS for '${fileName}' ('tsConfig.module' is '${kind}' and ${reason}), which Vite cannot bundle as an ES module. ` +
            `Set "type": "module", use the .mts extension, or use "ESNext".`,
        fileName
    );
    return { error, ...(packageJson && { packageJson }) };
};
