/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import type ts from "typescript";
import { type Generator } from "./Generator";
import { type Processor } from "./Processor";
import { type Reporter } from "./Reporter";
import { type ResultProcessor } from "./ResultProcessor";

/**
 * This type represents the context for the current compilation in which this addon is being used.
 * The context is created for a compilation profile and provides access to the specific profile
 * configuration.
 *
 * An addon is activated once per context, not per file. In the webpack loader, an addon stays active for every module
 * of a compilation and across watch rebuilds while its files and the loader options are unchanged; it is loaded and
 * activated again on the next rebuild after an edit of its files, of `websmith.config.json`, of `tsconfig.json` or of
 * a file that `tsconfig.json` extends. The Vite plugin activates its addons once per build in the same way, and again
 * after such an edit under `vite build --watch`. Addons must not rely on being activated again for each module.
 *
 * Generators, processors, transformers and result processors behave alike in every host. The methods that add or
 * remove files depend on the host, the `websmith` CLI, the webpack loader or the Vite plugin; see each method.
 */
export interface AddonContext<O = unknown> {
    /**
     * Returns the system to use for the interaction with the compiler's file system.
     */
    getSystem(): ts.System;

    /**
     * Returns the command line options used to run the compiler.
     * @deprecated Use getCompilerOptions() instead for accessing TypeScript compiler options.
     */
    getCliArgs(): ts.ParsedCommandLine;

    /**
     * Returns the TypeScript compiler options for the current compilation.
     * Use this method instead of getCliArgs().options to access clean CompilerOptions
     * without CLI implementation details.
     */
    getCompilerOptions(): ts.CompilerOptions;

    /**
     * Returns the list of file names included in the current compilation.
     * Use this method instead of getCliArgs().fileNames to access the file list
     * without CLI implementation details.
     */
    getFileNames(): string[];

    /**
     * Returns the reporter to display error, warning and info messages.
     */
    getReporter(): Reporter;

    /**
     * Returns the configuration specific for this compilation profile.
     */
    getProfileConfig(): O;

    /**
     * Adds a new code file to the compilation input. The file will be compiled with the same options as all other code files.
     *
     * - CLI: the file joins the compilation's root files and is emitted with them; in watch mode it is watched.
     * - Webpack loader: the file becomes a dependency of the module (`loaderContext.addDependency`).
     * - Vite plugin: the file joins the root files and is watched (`this.addWatchFile`); Vite bundles it only if a module
     *   imports it.
     *
     * A non-code file is an error diagnostic.
     * @param filePath: Path to the code file to add. Must have a ts(x), js(x), m[tj]s or c[tj]s file extension
     */
    addInputFile(filePath: string): void;

    /**
     * Adds a new asset dependency.
     *
     * - CLI: the dependency is recorded, so that a change of a watched `childPath` emits `parentPath` again.
     * - Webpack loader: `childPath` becomes a dependency of the module (`loaderContext.addDependency`).
     * - Vite plugin: `childPath` is watched (`this.addWatchFile`), so editing it rebuilds under `vite build --watch`.
     *
     * A code file as `childPath` is an error diagnostic.
     * @param childPath: Path to the file that is introduced as new dependency. Must not have a ts(x), js(x), m[tj]s or c[tj]s file extension.
     * @param parentPath: Path to the file that depends on the file at childPath and that requires to be updated when childPath changes.
     */
    addAssetDependency(childPath: string, parentPath: string): void;

    /**
     * Adds a new file virtually to the compilation input. The file will be compiled with the same options
     * as original files without first being created on the drive.
     *
     * - CLI: a code file joins the root files with `fileContent` and is compiled; any other extension is an error.
     * - Webpack loader: the file is emitted as an asset of the compilation (`compilation.emitAsset`), for any extension.
     * - Vite plugin: the file is emitted as an asset of the bundle in `generateBundle` (`this.emitFile`), for any
     *   extension and without compiling it. A relative path is relative to Vite's `build.outDir`, an absolute path must
     *   be inside it; a path outside it is an error diagnostic that fails the build. The dev server keeps the file in
     *   memory and does not serve it yet.
     */
    addVirtualFile(filePath: string, fileContent: string): void;

    /**
     * Removes the file from the compilation process and output. This does not impact the input file.
     *
     * - CLI: the file is dropped from the root files and the compilation's cache.
     * - Webpack loader: the asset is deleted from the compilation.
     * - Vite plugin: the file is deleted from the bundle in `generateBundle`, after the virtual files are emitted, so it
     *   can remove a virtual file or an asset Vite emits itself. Paths follow `addVirtualFile`. A file the bundle does
     *   not hold is a warning. The dev server drops it from its in-memory files.
     */
    removeOutputFile(filePath: string): void;

    /**
     * Resolves the given path relative to the current compilation's project directory, if a relative path was provided.
     */
    resolvePath(path: string): string;

    /**
     * Returns the content of the given file name, if the file is part of the compilation process. Use this function
     * to access the potentially transformed content. For `Generator` and `Processor` addons returned content is
     * unmodified.
     *
     * @param filePath Name of the file for
     * @returns The content of the file or empty string, if the file is not part of the compilation process.
     */
    getFileContent(filePath: string): string;

    /**
     * Registers a generator function with this context. Use a `Generator` to generate additional source input before
     * the actual compilation.
     *
     * @param generator Function `(fileName: string, content:string) => void`. Must not be null.
     */
    registerGenerator(generator: Generator): void;

    /**
     * Registers a processor function with this context. Use a `Processor` to manipulate the source input before
     * the actual compilation, e.g. to restructure modules or to change imports or exports.
     *
     * @param processor Function `(fileName: string, content:string) => string` that returns the transformed content. Must not be null.
     */
    registerProcessor(processor: Processor): void;

    /**
     * Registers standard TypeScript transformer functions with this context. Use this function to manipulate source input files during the
     * compilation process. This is standard TypeScript compiler functionality. See the TypeScript documentation for more information.
     *
     * @param transformer A `ts.CustomTransformers` object merged with all other transformers. Must not be null.
     */
    registerTransformer(transformer: ts.CustomTransformers): void;

    /**
     * Registers a result processor function with this context. Use a `ResultProcessor` to manipulate the compiled output after
     * the actual compilation.
     *
     * @param processor Function `(fileNames: string[]) => void` that is executed after the compilation of all files. Must not be null.
     */
    registerResultProcessor(processor: ResultProcessor): void;

    /**
     * Mark a file as having been processed by an addon.
     * This is used to track which files should be emitted when addonEmitOnly mode is enabled.
     * Use this for files that are processed but produce identical output (e.g., barrel files with re-exports).
     *
     * @param fileName Path to the file to mark as processed.
     */
    markFileAsAddonProcessed(fileName: string): void;
}
