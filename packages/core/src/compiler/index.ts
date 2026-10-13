/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
export { Compiler } from "./Compiler";
export type { CompileFragment } from "./Compiler";
export * from "./options";
export { DefaultReporter } from "./DefaultReporter";
export { ErrorTrackingReporter } from "./ErrorTrackingReporter";
export { checkDirectoryImport, checkEsm, checkJsonImportAttribute, checkMissingExtension, createCjsNamesCache, EsmDiagnosticCode } from "./esm";
export type { EsmCheckContext, ImportRule, ModuleClassification, ScanCache } from "./esm";
export { CompilationScanCache, MISSING_SYSTEM_ERROR, ModuleCompiler } from "./ModuleCompiler";
export type { ModuleBuildOptions, ModuleBuildResult, ModuleCompilerHost } from "./ModuleCompiler";
export { NoReporter } from "./NoReporter";
export * from "./addons";
export * from "./compilation";
export * from "./config";
export { tsDefaults, tsLibDefaults } from "./defaults";
