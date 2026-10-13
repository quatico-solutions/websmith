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

// Options whose array entries are names TypeScript converts, e.g. lib "ES2022" to "lib.es2022.d.ts"
const CONVERTED_ARRAY_OPTIONS = ["lib"];

// A lib entry that is already a file name, e.g. "lib.es2022.d.ts", TypeScript would reject it as a name
const LIB_FILE_NAME = /^lib\..+\.d\.ts$/i;

const reportInvalidValue = (key: string, value: string, location: string, error: ts.Diagnostic, reporter?: Reporter): void => {
    reporter?.reportDiagnostic(
        new ErrorMessage(`Invalid 'tsConfig.${key}' value '${value}' ${location}. ` + ts.flattenDiagnosticMessageText(error.messageText, " "))
    );
};

const convertArrayEntries = (key: string, entries: unknown[], location: string, reporter?: Reporter): unknown[] =>
    entries.flatMap(entry => {
        if (typeof entry !== "string" || LIB_FILE_NAME.test(entry)) {
            return [entry];
        }
        const { options, errors } = ts.convertCompilerOptionsFromJson({ [key]: [entry] }, "");
        const error = errors.find(cur => cur.code === TS_ERROR_CODE_INVALID_OPTION_VALUE);
        if (error) {
            reportInvalidValue(key, entry, location, error, reporter);
            return [];
        }
        const converted = options[key];
        return Array.isArray(converted) && converted.length === 1 ? converted : [entry];
    });

/**
 * Converts option names in a tsConfig, e.g. module "NodeNext", to the enum values TypeScript expects, as tsconfig.json
 * parsing does. Converts the entries of a lib array one by one to file names, e.g. "ES2022" to "lib.es2022.d.ts", and
 * keeps entries that already are file names. Drops names TypeScript doesn't know and reports them if a reporter is
 * given. Other values that are not strings pass through, so converting the result again changes nothing.
 *
 * @param tsConfig - The options to convert.
 * @param location - Where the options come from, the phrase after the value in the error message, e.g.
 *  "in profile 'client' of './websmith.config.json'" or "in the loader options".
 * @param reporter - Receives an error per unknown name; without it, unknown names are dropped silently.
 */
export const convertEnumOptions = (tsConfig: ts.CompilerOptions, location: string, reporter?: Reporter): ts.CompilerOptions =>
    Object.fromEntries(
        Object.entries(tsConfig).flatMap(([key, value]): [string, ts.CompilerOptionsValue][] => {
            if (Array.isArray(value) && CONVERTED_ARRAY_OPTIONS.includes(key)) {
                return [[key, convertArrayEntries(key, value, location, reporter) as ts.CompilerOptionsValue]];
            }
            if (typeof value !== "string") {
                return [[key, value as ts.CompilerOptionsValue]];
            }
            const { options, errors } = ts.convertCompilerOptionsFromJson({ [key]: value }, "");
            const error = errors.find(cur => cur.code === TS_ERROR_CODE_INVALID_OPTION_VALUE);
            if (error) {
                reportInvalidValue(key, value, location, error, reporter);
                return [];
            }
            return [[key, typeof options[key] === "number" ? options[key] : value]];
        })
    );
