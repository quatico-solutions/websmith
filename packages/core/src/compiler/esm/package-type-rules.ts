/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import path from "node:path";
import type { ModuleClassification } from "./classify-module";
import type { ModuleScan, Span } from "./scan-module";

/** Codes of the rules that compare a file's module format with how its runtime loads it. */
export const PackageTypeCode = {
    EsmSyntaxInCjsFile: 91030,
    EsmSyntaxInCommonJsPackage: 91031,
    CommonJsOutputLoadedAsEsm: 91032,
    TopLevelAwaitInCommonJs: 91033,
} as const;

export type PackageTypeFinding = Span & { code: number; message: string };

/**
 * Checks a file's module format against its classification: ESM syntax in a file loaded as CommonJS, whole-file
 * CommonJS output in a file loaded as ESM, and top-level `await` in a file loaded as CommonJS. Pure over the
 * classification and the scan, so any caller can feed its own module type.
 */
export const checkPackageType = (
    fileName: string,
    { kind, packageJson }: ModuleClassification,
    { hasEsmSyntax, esmSyntax, topLevelAwait, esModuleMarker, freeReferences }: Omit<ModuleScan, "file">
): PackageTypeFinding[] => {
    const findings: PackageTypeFinding[] = [];
    const loadedAsCommonJs = kind === "commonjs" || kind === "dynamic";

    if (loadedAsCommonJs && esmSyntax) {
        if (path.extname(fileName).toLowerCase() === ".cjs") {
            findings.push({
                code: PackageTypeCode.EsmSyntaxInCjsFile,
                message: `ES module syntax in a .cjs file, which is loaded as CommonJS; rename to ".mjs" or emit CommonJS`,
                ...esmSyntax,
            });
        } else if (packageJson) {
            findings.push({
                code: PackageTypeCode.EsmSyntaxInCommonJsPackage,
                message:
                    `ES module syntax in a .js file that "${packageJson}" declares "type": "commonjs"; ` +
                    `set "type": "module" in "${packageJson}" or rename to ".mjs"`,
                ...esmSyntax,
            });
        }
    }
    if (loadedAsCommonJs && topLevelAwait) {
        findings.push({
            code: PackageTypeCode.TopLevelAwaitInCommonJs,
            message: `top-level "await" in a file loaded as CommonJS; wrap in an async function or load as ESM`,
            ...topLevelAwait,
        });
    }
    const [commonJsExport] = [esModuleMarker, freeReferences.find(cur => cur.commonJsExport)]
        .filter((cur): cur is Span => !!cur)
        .sort((a, b) => a.start - b.start);
    if (kind === "esm" && !hasEsmSyntax && commonJsExport) {
        findings.push({
            code: PackageTypeCode.CommonJsOutputLoadedAsEsm,
            message:
                `file loaded as ES module whose output is CommonJS; set "module" to an ES module format, ` +
                `or to "NodeNext" to follow "type"`,
            start: commonJsExport.start,
            length: commonJsExport.length,
        });
    }
    return findings;
};
