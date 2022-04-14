/*
 * @license
 *
 * Copyright (c) 2017-2022 Quatico Solutions AG
 * Förrlibuckstrasse 220, 8005 Zurich, Switzerland
 *
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Quatico Solutions AG, ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Quatico.
 */
import ts from "typescript";
import { Generator } from "./Generator";
import { Processor } from "./Processor";
import { Reporter } from "./Reporter";
import { ResultProcessor } from "./ResultProcessor";
import { TargetConfig } from "./TargetConfig";

/**
 * This type represents the context for the current compilation in which this addon is being used.
 * The context is created for a compilation target and provides access to the specific target
 * configuration.
 */
export interface AddonContext<O extends TargetConfig = any> {
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
     * Adds a new file to the compilation input. The file will be compiled with the same options
     * as original files.
     */
    addInputFile(filePath: string): void;

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
