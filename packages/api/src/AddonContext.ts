/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import ts from "typescript";
import { Generator } from "./Generator";
import { Processor } from "./Processor";
import { Reporter } from "./Reporter";
import { ResultProcessor } from "./ResultProcessor";

/**
 * This type represents the context for the current compilation in which this addon is being used.
 * The context is created for a compilation target and provides access to the specific target
 * configuration.
 */
export interface AddonContext<O = unknown> {
    /**
     * Returns the system to use for the interaction with the compiler's file system.
     */
    getSystem(): ts.System;

    /**
     * Returns the program executing the current compilation process.
     */
    getProgram(): ts.Program;

    /**
     * Returns the command line options used to run the compiler.
     */
    getConfig(): ts.ParsedCommandLine;

    /**
     * Returns the reporter to display error, warning and info messages.
     */
    getReporter(): Reporter;

    /**
     * Returns the configuration specific for this compilation target.
     */
    getTargetConfig(): O;

    /**
     * Adds a new code file to the compilation input. The file will be compiled with the same options as all other code files.
     * @param filePath: Path to the code file to add. Must have a ts(x), js(x), m[tj]s or c[tj]s file extension
     */
    addInputFile(filePath: string): void;

    /**
     * Adds a new asset dependency.
     * @param childPath: Path to the file that is introduced as new dependency. Must not have a ts(x), js(x), m[tj]s or c[tj]s file extension.
     * @param parentPath: Path to the file that depends on the file at childPath and that requires to be updated when childPath changes.
     */
    addAssetDependency(childPath: string, parentPath: string): void;

    /**
     * Adds a new file virtually to the compilation input. The file will be compiled with the same options
     * as original files without first being created on the drive.
     */
    addVirtualFile(filePath: string, fileContent: string): void;

    /**
     * Removes the file from the compilation process and output. This does not impact the input file.
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
}
