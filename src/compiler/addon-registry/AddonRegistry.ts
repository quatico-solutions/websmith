/*
 * @license
 *
 * Copyright (c) 2017-2021 Quatico Solutions AG
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
import * as ts from "typescript";
import {
    CompilerContext,
    CompilerOptions,
    Generator,
    GeneratorKind,
    Processor,
    ProcessorKind,
    Reporter,
    StyleTransformer,
    StyleTransformerKind,
    Transformer,
    TransformerKind,
} from "../../model";
import { concat } from "../collections";

// FIXME: Separate registry from context, Only compiler should have direct access to registry
export class AddonRegistry implements CompilerContext {
    public readonly compilerOptions: CompilerOptions;
    public readonly system: ts.System;
    public readonly reporter: Reporter;

    private _transformers: ts.CustomTransformers;
    private _styleTransformers: CustomStyleTransformers;
    private _generators: CustomGenerators;
    private _processors: CustomProcessors;

    constructor(options: CompilerOptions, reporter: Reporter, system: ts.System) {
        this._styleTransformers = {};
        this._transformers = {};
        this._generators = {};
        this._processors = {};
        this.reporter = reporter;
        this.system = system;
        this.compilerOptions = options;
    }

    public registerStyleTransformer(kind: StyleTransformerKind, trans: StyleTransformer): this {
        this._styleTransformers[kind] = concat(this._transformers[kind] as any, [trans]) as any;
        return this;
    }

    public registerTransformer(kind: TransformerKind, trans: Transformer): this {
        this._transformers[kind] = concat(this._transformers[kind] as any, [trans]) as any;
        return this;
    }

    public registerGenerator(kind: GeneratorKind, gen: Generator): this {
        this._generators[kind] = concat(this._generators[kind], [gen]);
        return this;
    }

    public registerProcessor(kind: ProcessorKind, proc: Processor): this {
        this._processors[kind] = concat(this._processors[kind], [proc]);
        return this;
    }

    public get styleTransformers(): CustomStyleTransformers {
        return this._styleTransformers;
    }

    public get transformers(): ts.CustomTransformers {
        return this._transformers;
    }

    public get generators(): CustomGenerators {
        return this._generators;
    }

    public get processors(): CustomProcessors {
        return this._processors;
    }
}
export interface CustomProcessors {
    element?: Processor[];
    styles?: Processor[];
}

export interface CustomStyleTransformers {
    after?: StyleTransformer[];
    before?: StyleTransformer[];
}

export interface CustomGenerators {
    docs?: Generator[];
    source?: Generator[];
    binary?: Generator[];
}
