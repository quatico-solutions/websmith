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

// import ts from "typescript";
// export type Transformer = (ctx: ts.TransformationContext) => ts.Transformer<ts.SourceFile>;

// FIXME: Seems not to be good enough
export type Transformer = (fileName: string, content: string) => string | never;
