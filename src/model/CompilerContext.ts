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
import { CompilerOptions } from "./CompilerOptions";
import { Generator, GeneratorKind } from "./Generator";
import { Processor, ProcessorKind } from "./Processor";
import { Reporter } from "./Reporter";
import { StyleTransformer, StyleTransformerKind } from "./StyleTransformer";
import { Transformer, TransformerKind } from "./Transformer";

export interface CompilerContext {
    compilerOptions: CompilerOptions;
    system: ts.System;
    reporter: Reporter;
    program?: ts.Program;
    registerStyleTransformer(kind: StyleTransformerKind, transformer: StyleTransformer): this;
    registerTransformer(kind: TransformerKind, transformer: Transformer): this;
    registerGenerator(kind: GeneratorKind, generator: Generator): this;
    registerProcessor(kind: ProcessorKind, processor: Processor): this;
}
