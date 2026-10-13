/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { ErrorMessage, type Reporter } from "@quatico/websmith-api";
import ts from "typescript";

// TypeScript error code for an option value outside its allowed names, e.g. module "NodeLatest"
export const TS_ERROR_CODE_INVALID_OPTION_VALUE = 6046;

/**
 * Converts option names in a tsConfig, e.g. module "NodeNext", to the enum values TypeScript expects, as tsconfig.json
 * parsing does. Drops names TypeScript doesn't know and reports them if a reporter is given. Values that are not
 * strings pass through, so converting the result again changes nothing.
 *
 * @param tsConfig - The options to convert.
 * @param location - Where the options come from, the phrase after the value in the error message, e.g.
 *  "in profile 'client' of './websmith.config.json'" or "in the loader options".
 * @param reporter - Receives an error per unknown name; without it, unknown names are dropped silently.
 */
export const convertEnumOptions = (tsConfig: ts.CompilerOptions, location: string, reporter?: Reporter): ts.CompilerOptions =>
    Object.fromEntries(
        Object.entries(tsConfig).flatMap(([key, value]): [string, ts.CompilerOptionsValue][] => {
            if (typeof value !== "string") {
                return [[key, value as ts.CompilerOptionsValue]];
            }
            const { options, errors } = ts.convertCompilerOptionsFromJson({ [key]: value }, "");
            const error = errors.find(cur => cur.code === TS_ERROR_CODE_INVALID_OPTION_VALUE);
            if (error) {
                reporter?.reportDiagnostic(
                    new ErrorMessage(
                        `Invalid 'tsConfig.${key}' value '${value}' ${location}. ` + ts.flattenDiagnosticMessageText(error.messageText, " ")
                    )
                );
                return [];
            }
            return [[key, typeof options[key] === "number" ? options[key] : value]];
        })
    );
