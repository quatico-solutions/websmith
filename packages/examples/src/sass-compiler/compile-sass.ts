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
import { ErrorMessage, Reporter } from "@websmith/addon-api";
import sass from "sass";
import { defaultOptions } from "./defaults";

export const CONFIG_FILE_NAME_SASS = "sass.config.js";

export const createSass =
    (options: sass.Options<"sync">, reporter: Reporter) =>
    (styles?: string): string => {
        try {
            if (styles) {
                const compiled = sass.compileString(styles, { ...defaultOptions, ...options });
                return removeComments(compiled.css.toString());
            }
        } catch (err) {
            reporter.reportDiagnostic(new ErrorMessage(err.message));
        }
        return "";
    };

export const removeComments = (source: string): string =>
    source
        .replace(/\/\*[^*]*\*+([^/][^*]*\*+)*\//g, "")
        .replace(/:var/g, ": var")
        .replace(/@charset+.*;[\n]+/, "");
