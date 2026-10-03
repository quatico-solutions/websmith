/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
export { resolveCompilationConfig, resolvePaths, resolvePath, TS_ERROR_CODE_INVALID_OPTION_VALUE } from "./resolve-compiler-config";
export { parsedCommandLine, scriptTargetToString } from "./parsed-command-line";
export { resolveProfile } from "./resolve-profile";
export { PROJECT_FILE_NAME, projectFileDiagnostic, resolveProjectFile } from "./resolve-project-file";
export { getEffectiveTarget } from "./effective-options";
export { getProfileClosure, type ProfileClosure, type ProfileClosureOrder } from "./profile-closure";
