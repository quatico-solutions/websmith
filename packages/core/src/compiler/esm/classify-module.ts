/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import type { EsmRuntime } from "@quatico/websmith-api";
import path from "node:path";
import type ts from "typescript";

export type PackageType = "module" | "commonjs";

/** The package.json nearest to a file. */
export type PackageInfo = {
    /** Path of the package.json. */
    packageJson: string;
    /** Its `"type"`, undefined when it declares none or cannot be read. */
    type?: PackageType;
};

/** Returns the package.json nearest to a file, or undefined when there is none. */
export type PackageTypeLookup = (fileName: string) => PackageInfo | undefined;

/** Receives every package.json path a lookup depends on: `exists` is false for a nearer candidate that does not exist. */
export type DependencyCallback = (fileName: string, exists: boolean) => void;

export type ModuleClassification = {
    /**
     * How the runtime loads the file: `esm` and `commonjs` as Node decides it; `esm` (webpack's `javascript/esm`),
     * `dynamic` (`javascript/dynamic`, CommonJS where ESM syntax fails) and `auto` (`javascript/auto`) for bundlers.
     */
    kind: "esm" | "commonjs" | "dynamic" | "auto";
    /** True when Node classifies the file by its syntax because no package.json `"type"` applies. */
    typeMissing: boolean;
};

/**
 * Classifies an emitted file the way its runtime loads it, never by `tsConfig.module`: that option says what
 * TypeScript emitted, not how the file is loaded.
 */
export const classifyModule = (
    fileName: string,
    runtime: EsmRuntime,
    hasEsmSyntax: boolean,
    lookupPackageType: PackageTypeLookup
): ModuleClassification => {
    const extension = path.extname(fileName).toLowerCase();
    if (extension === ".mjs") {
        return { kind: "esm", typeMissing: false };
    }
    if (extension === ".cjs") {
        return { kind: runtime === "node" ? "commonjs" : "dynamic", typeMissing: false };
    }
    const packageType = lookupPackageType(fileName)?.type;
    if (runtime === "bundler") {
        return { kind: packageType === "module" ? "esm" : packageType === "commonjs" ? "dynamic" : "auto", typeMissing: false };
    }
    if (packageType) {
        return { kind: packageType === "module" ? "esm" : "commonjs", typeMissing: false };
    }
    return { kind: hasEsmSyntax ? "esm" : "commonjs", typeMissing: true };
};

/**
 * Creates a lookup that reads every package.json at most once. Every lookup, cached or not, reports the package.json
 * paths it depends on to `onDependency`.
 */
export const createPackageTypeLookup = (system: ts.System, onDependency?: DependencyCallback): PackageTypeLookup => {
    const cache = new Map<string, { result?: PackageInfo; missing: string[] }>();

    const lookupDirectory = (dirName: string): { result?: PackageInfo; missing: string[] } => {
        const cached = cache.get(dirName);
        if (cached) {
            return cached;
        }
        const packageJson = path.join(dirName, "package.json");
        const parentDir = path.dirname(dirName);
        let entry: { result?: PackageInfo; missing: string[] };
        if (system.fileExists(packageJson)) {
            const type = readPackageType(system, packageJson);
            entry = { result: { packageJson, ...(type && { type }) }, missing: [] };
        } else if (parentDir !== dirName) {
            const parent = lookupDirectory(parentDir);
            entry = { result: parent.result, missing: [packageJson, ...parent.missing] };
        } else {
            entry = { missing: [packageJson] };
        }
        cache.set(dirName, entry);
        return entry;
    };

    return (fileName: string) => {
        const { result, missing } = lookupDirectory(path.dirname(fileName));
        missing.forEach(cur => onDependency?.(cur, false));
        if (result) {
            onDependency?.(result.packageJson, true);
        }
        return result;
    };
};

const readPackageType = (system: ts.System, packageJson: string): PackageType | undefined => {
    try {
        const { type } = JSON.parse(system.readFile(packageJson) ?? "{}") as { type?: unknown };
        return type === "module" || type === "commonjs" ? type : undefined;
    } catch {
        return undefined;
    }
};
