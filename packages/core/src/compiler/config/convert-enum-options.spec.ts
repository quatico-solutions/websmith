/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { ErrorMessage } from "@quatico/websmith-api";
import ts from "typescript";
import { NoReporter } from "../NoReporter";
import { convertEnumOptions, TS_ERROR_CODE_INVALID_OPTION_VALUE } from "./convert-enum-options";

const tsMessageOf = (key: string, value: string): string => {
    const error = ts.convertCompilerOptionsFromJson({ [key]: value }, "").errors.find(cur => cur.code === TS_ERROR_CODE_INVALID_OPTION_VALUE);
    return ts.flattenDiagnosticMessageText(error?.messageText, " ");
};

const tsLibMessageOf = (entry: string): string => {
    const error = ts.convertCompilerOptionsFromJson({ lib: [entry] }, "").errors.find(cur => cur.code === TS_ERROR_CODE_INVALID_OPTION_VALUE);
    return ts.flattenDiagnosticMessageText(error?.messageText, " ");
};

describe("convertEnumOptions", () => {
    it.each([
        { key: "module", value: "NodeNext", expected: ts.ModuleKind.NodeNext },
        { key: "moduleResolution", value: "Bundler", expected: ts.ModuleResolutionKind.Bundler },
        { key: "target", value: "ES2022", expected: ts.ScriptTarget.ES2022 },
        { key: "jsx", value: "react-jsx", expected: ts.JsxEmit.ReactJSX },
    ])("should return enum value $expected w/ $key $value", ({ key, value, expected }) => {
        const actual = convertEnumOptions({ [key]: value }, "in the loader options");

        expect(actual).toEqual({ [key]: expected });
    });

    it("should return numbers and non-enum strings unchanged w/ already converted options", () => {
        const actual = convertEnumOptions({ module: ts.ModuleKind.NodeNext, outDir: "./dist", strict: true }, "in the loader options");

        expect(actual).toEqual({ module: ts.ModuleKind.NodeNext, outDir: "./dist", strict: true });
    });

    it("should return lib file names w/ lib names", () => {
        const actual = convertEnumOptions({ lib: ["ES2022", "DOM"] }, "in the loader options");

        expect(actual).toEqual({ lib: ["lib.es2022.d.ts", "lib.dom.d.ts"] });
    });

    it("should return lib file names w/ mixed case lib names", () => {
        const actual = convertEnumOptions({ lib: ["es2022", "Dom.Iterable"] }, "in the loader options");

        expect(actual).toEqual({ lib: ["lib.es2022.d.ts", "lib.dom.iterable.d.ts"] });
    });

    it("should return lib file names as written and report nothing w/ lib file names", () => {
        const targetFn = jest.spyOn(NoReporter.prototype, "reportDiagnostic");

        const actual = convertEnumOptions({ lib: ["lib.es2022.d.ts", "LIB.DOM.d.ts"] }, "in the loader options", new NoReporter());

        expect(actual).toEqual({ lib: ["lib.es2022.d.ts", "LIB.DOM.d.ts"] });
        expect(targetFn).not.toHaveBeenCalled();
    });

    it("should keep the valid entries and report one error w/ unknown lib entry", () => {
        const targetFn = jest.spyOn(NoReporter.prototype, "reportDiagnostic");

        const actual = convertEnumOptions({ lib: ["ES2022", "bogus"] }, "in the loader options", new NoReporter());

        expect(actual).toEqual({ lib: ["lib.es2022.d.ts"] });
        expect(targetFn.mock.calls).toEqual([
            [new ErrorMessage(`Invalid 'tsConfig.lib' value 'bogus' in the loader options. ${tsLibMessageOf("bogus")}`)],
        ]);
    });

    it("should return an empty lib w/ only unknown lib entries", () => {
        const actual = convertEnumOptions({ lib: ["bogus"] }, "in the loader options");

        expect(actual).toEqual({ lib: [] });
    });

    it("should drop the entry silently w/o reporter and unknown lib entry", () => {
        const actual = convertEnumOptions({ lib: ["bogus", "ES2022"] }, "in the loader options");

        expect(actual).toEqual({ lib: ["lib.es2022.d.ts"] });
    });

    it("should return non-string lib entries unchanged w/ non-string lib entry", () => {
        const actual = convertEnumOptions({ lib: [42, "ES2022"] as unknown as string[] }, "in the loader options");

        expect(actual).toEqual({ lib: [42, "lib.es2022.d.ts"] });
    });

    it("should return lib unchanged w/ lib string", () => {
        const actual = convertEnumOptions({ lib: "ES2022" as unknown as string[] }, "in the loader options");

        expect(actual).toEqual({ lib: "ES2022" });
    });

    it("should return other arrays unchanged w/ rootDirs and types", () => {
        const actual = convertEnumOptions({ rootDirs: ["./a", "./b"], types: ["node"] }, "in the loader options");

        expect(actual).toEqual({ rootDirs: ["./a", "./b"], types: ["node"] });
    });

    it("should return an equal result and report nothing w/ converted output", () => {
        const targetFn = jest.spyOn(NoReporter.prototype, "reportDiagnostic");
        const converted = convertEnumOptions(
            { module: "NodeNext", target: "ES2022", outDir: "./dist", lib: ["ES2022", "DOM", "lib.webworker.d.ts"] },
            "in the loader options"
        );

        const actual = convertEnumOptions(converted, "in the loader options", new NoReporter());

        expect(actual).toEqual(converted);
        expect(targetFn).not.toHaveBeenCalled();
    });

    it("should drop the value silently w/o reporter and invalid module", () => {
        const actual = convertEnumOptions({ module: "nope", target: "ES2022" }, "in the loader options");

        expect(actual).toEqual({ target: ts.ScriptTarget.ES2022 });
    });

    it.each([
        { location: "in profile 'client' of './websmith.config.json'", phrase: "in profile 'client' of './websmith.config.json'" },
        { location: "in profile 'client' of the loader options", phrase: "in profile 'client' of the loader options" },
        { location: "in the loader options", phrase: "in the loader options" },
    ])("should report one error with the location w/ invalid module $location", ({ location, phrase }) => {
        const targetFn = jest.spyOn(NoReporter.prototype, "reportDiagnostic");

        const actual = convertEnumOptions({ module: "nope" }, location, new NoReporter());

        expect(actual).toEqual({});
        expect(targetFn.mock.calls).toEqual([
            [new ErrorMessage(`Invalid 'tsConfig.module' value 'nope' ${phrase}. ${tsMessageOf("module", "nope")}`)],
        ]);
    });
});
