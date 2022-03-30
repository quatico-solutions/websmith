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
import type { CompilerOptions } from "../compiler";
import type { CompilerAddon } from "./CompilerAddon";
import type { EmitTransformer, EmitTransformerKind } from "./EmitTransformer";
import type { Transformer, TransformerKind } from "./Transformer";
import type { StyleTransformer, StyleTransformerKind } from "./StyleTransformer";
import type { Generator, GeneratorKind } from "./Generator";
import { Processor, ProcessorKind } from "./Processor";
import { aggregateMessages, ErrorMessage, InfoMessage, messageToString, WarnMessage } from "./Reporter";
import type { Reporter } from "./Reporter";
import type { VersionedFile } from "./VersionedFile";
import type { PreEmitTransformer } from "./PreEmitTransformer";

export { aggregateMessages, ErrorMessage, InfoMessage, messageToString, WarnMessage };

export type {
    CompilerAddon,
    CompilerOptions,
    EmitTransformer,
    EmitTransformerKind,
    Generator,
    GeneratorKind,
    PreEmitTransformer,
    Processor,
    ProcessorKind,
    Reporter,
    StyleTransformer,
    StyleTransformerKind,
    Transformer,
    TransformerKind,
    VersionedFile,
};
