/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
export { Compiler } from "./Compiler";
export type { AttributedOutput, CompileFragment } from "./Compiler";
export * from "./options";
export { DefaultReporter } from "./DefaultReporter";
export { checkDirectoryImport, checkEsm, checkJsonImportAttribute, checkMissingExtension, createCjsNamesCache, EsmDiagnosticCode } from "./esm";
export type { CjsNamesCache, EsmCheckContext, ImportRule, ModuleClassification, PackageTypeCache, ScanCache } from "./esm";
export { NoReporter } from "./NoReporter";
export * from "./addons";
export * from "./compilation";
export * from "./config";
export { tsDefaults, tsLibDefaults } from "./defaults";
