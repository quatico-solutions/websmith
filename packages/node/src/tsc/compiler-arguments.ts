import { isArray } from "lodash";
import type ts from "typescript";
import { parseNumberValue } from "../compiler-options";

export const parseCliArguments = (tsConfig: ts.CompilerOptions, files: string[]) =>
    Object.entries(tsConfig)
        .reduce((acc: string[], [key, value]) => {
            if (value === false) {
                return acc;
            }
            if (value === true) {
                acc.push(`--${key}`);
            } else if (isArray(value)) {
                // eslint-disable-next-line @typescript-eslint/no-base-to-string
                acc.push(`--${key}`, String(value.join(",")));
            } else if (value && typeof value === "number") {
                acc.push(`--${key}`, parseNumberValue(key, value));
            } else if (value && typeof value === "string") {
                acc.push(`--${key}`, String(value));
            } else {
                throw new Error(`Unknown value type: ${typeof value}`);
            }
            return acc;
        }, [])
        .concat(files);
