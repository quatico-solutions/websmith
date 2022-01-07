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
import ts from "typescript";
import { Generator } from "./Generator";

export type TransformerKind = "before" | "after" | "afterDeclarations";

export type Transformer = (ctx: ts.TransformationContext) => ts.Transformer<ts.SourceFile>;

export const fromGenerator = (generator: Generator, program: ts.Program): Transformer => (
    context: ts.TransformationContext
): ts.Transformer<ts.SourceFile> => (file: ts.SourceFile) => ts.visitNode(file, generator.process(program));
