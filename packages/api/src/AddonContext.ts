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
    getSystem(): ts.System;
    getProgram(): ts.Program;
    getConfig(): ts.ParsedCommandLine;
    getReporter(): Reporter;
    getTargetConfig(): O;
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
