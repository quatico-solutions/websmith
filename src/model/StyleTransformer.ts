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
import { StyleVisitor } from "../compiler/style-compiler";
import { Reporter } from "./Reporter";

// FIXME: StyleTransformer fix API
export type StyleTransformerKind = "before" | "after";

export interface StyleTransformer {
    visitor: StyleVisitor;
    reporter: Reporter;
}
