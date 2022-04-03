import ts from "typescript";
import { Generator } from "./Generator";
import { TargetConfig } from "./TargetConfig";
import { Transformer } from "./Transformer";

export interface AddonContext<O extends TargetConfig = any> {
    getSystem(): ts.System;
    getConfig(): ts.ParsedCommandLine;
    getTargetConfig(): O;

    /**
     * Registers a generator with this context.
     *
     * @param generator (fileName:string, content:string) => void function that generates additional output files for the provided source code file.
     */
    registerGenerator(generator: Generator): void;

    /**
     * Registers a preEmit Transformer with this context.
     *
     * @param transformer (fileName: string, content:string) => transformedContent: string function that transformes the provided source code content.
     */
    registerPreEmitTransformer(transformer: Transformer): void;

    /**
     * Registers an emitTransformer with this context.
     *
     * @param transformer A ts.CustomTransformers object merged with all other emit transformers and used during the compilation process.
     */
    registerEmitTransformer(transformer: ts.CustomTransformers): void;
}
