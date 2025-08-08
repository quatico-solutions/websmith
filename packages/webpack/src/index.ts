/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */

// Re-export core components
export { Compiler, createBrowserSystem, DefaultReporter, getVersionedFile, NoReporter } from "@quatico/websmith-core";
export type { CompilerOptions } from "@quatico/websmith-core";
export { getLoaderOptions } from "./loader-options";
export { type WebsmithLoaderConfig } from "./WebsmithLoaderConfig";

// Import and re-export the loader function as the default export (required for webpack loaders)
import { loader } from "./loader";
export default loader;
