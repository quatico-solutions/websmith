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

import type { CompilationContext } from "../../compiler";
import { DocGenerator } from "./DocGenerator";

/**
 * Addon to generate the custom-elements.json using the WCA
 * (web-components-analyzer) library.
 *
 * @param context
 */
export const activate = (context: CompilationContext) => {
    context.registerGenerator(
        "docs",
        new DocGenerator({ inlineTypes: false, verbose: false, visibility: "public", reporter: context.getReporter() })
    );
};
