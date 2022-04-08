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
import { Reporter } from "./Reporter";
import { Generator } from "./Generator";
import { TargetPostTransformer } from "./TargetPostTransformer";
import { TargetConfig } from "./TargetConfig";
import { Processor } from "./Processor";

export interface AddonContext<O extends TargetConfig = any> {
    /**
     * The system to use for the interaction with the file system.
     */
    getSystem(): ts.System;

    /**
     * The program executing the current compilation process.
     */
    getProgram(): ts.Program;

    /**
     * The compiler command line options for the current compilation process.
     */
    getConfig(): ts.ParsedCommandLine;

    /**
     * The reporter to use for reporting error, warning and info messages.
     */
    getReporter(): Reporter;

    /**
     * The specific configuration of the current target.
     */
    getTargetConfig(): O;

    /**
     * Gets the file content for the given file name if the file is part of the compilation process, otherwise ""
     *
     * @param fileName The file name for which we want to get the potentially transformed source content within the current target.
     * @returns The content of the file. This is untransformed in Generators and Processors but transformed afterwards
     */
    getFileContent(fileName: string): string;

    /**
     * Registers a generator with this context.
     *
     * @param generator (fileName:string, content:string) => void function that generates additional output files for the provided source code file.
     */
    registerGenerator(generator: Generator): void;

    /**
     * Registers a processor with this context.
     *
     * @param processor (fileName: string, content:string) => transformedContent: string function that transformes the provided source code content.
     */
    registerProcessor(processor: Processor): void;

    /**
     * Registers an transformer with this context.
     *
     * @param transformer A ts.CustomTransformers object merged with all other transformers and used during the compilation process.
     */
    registerTransformer(transformer: ts.CustomTransformers): void;

    /**
     * Registers an target post transformer with this context.
     *
     * @param targetPostTransformer (fileNames: string[]) => void: A function that is executed after the compilation of all files is completed.
     */
    registerTargetPostTransformer(targetPostTransformer: TargetPostTransformer): void;
}
