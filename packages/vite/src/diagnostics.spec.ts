/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import ts from "typescript";
import { formatDiagnostic, partitionDiagnostics, toRollupError, toRollupWarning } from "./diagnostics";

const FILE = ts.createSourceFile("/project/src/main.ts", "const a = 1;\nexport const x = ;\n", ts.ScriptTarget.ES2022);
// Position of the ";" in line 2
const START = "const a = 1;\nexport const x = ".length;

const diagnostic = (
    messageText: string | ts.DiagnosticMessageChain,
    category = ts.DiagnosticCategory.Error,
    { file, start, code = 1 }: { file?: ts.SourceFile; start?: number; code?: number } = {}
): ts.Diagnostic => ({ category, code, file, start, length: undefined, messageText });

describe("formatDiagnostic", () => {
    it("should return file with position and message w/ file and start", () => {
        const actual = formatDiagnostic(diagnostic("Expression expected.", ts.DiagnosticCategory.Error, { file: FILE, start: START }));

        expect(actual).toBe("/project/src/main.ts (2,18): Expression expected.");
    });

    it("should return message only w/o file", () => {
        const actual = formatDiagnostic(diagnostic("Unknown profile 'missing'"));

        expect(actual).toBe("Unknown profile 'missing'");
    });

    it("should flatten message chain w/ chained message", () => {
        const chain: ts.DiagnosticMessageChain = { messageText: "Outer", category: ts.DiagnosticCategory.Error, code: 1, next: [{ messageText: "Inner", category: ts.DiagnosticCategory.Error, code: 2 }] };

        const actual = formatDiagnostic(diagnostic(chain));

        expect(actual).toBe("Outer\n  Inner");
    });
});

describe("toRollupError", () => {
    it("should join every error w/ two errors", () => {
        const actual = toRollupError([diagnostic("First"), diagnostic("Second")]).message;

        expect(actual).toBe("First\nSecond");
    });

    it("should take loc of first error with position w/ file-less error first", () => {
        const actual = toRollupError([diagnostic("First"), diagnostic("Second", ts.DiagnosticCategory.Error, { file: FILE, start: START })]).loc;

        expect(actual).toEqual({ file: "/project/src/main.ts", line: 2, column: 17 });
    });

    it("should return message without position of loc error w/ positioned error", () => {
        const actual = toRollupError([diagnostic("Expression expected.", ts.DiagnosticCategory.Error, { file: FILE, start: START })]).message;

        expect(actual).toBe("Expression expected.");
    });

    it("should keep position of other errors w/ two positioned errors", () => {
        const actual = toRollupError([
            diagnostic("First", ts.DiagnosticCategory.Error, { file: FILE, start: START }),
            diagnostic("Second", ts.DiagnosticCategory.Error, { file: FILE, start: 0 }),
        ]).message;

        expect(actual).toBe("First\n/project/src/main.ts (1,1): Second");
    });

    it("should return no loc w/o positions", () => {
        const actual = toRollupError([diagnostic("First")]);

        expect(actual).not.toHaveProperty("loc");
    });
});

describe("toRollupWarning", () => {
    it("should return message without position and loc w/ position", () => {
        const actual = toRollupWarning(diagnostic("ESM91001", ts.DiagnosticCategory.Warning, { file: FILE, start: START }));

        expect(actual).toEqual({ message: "ESM91001", loc: { file: "/project/src/main.ts", line: 2, column: 17 } });
    });

    it("should return string w/o position", () => {
        const actual = toRollupWarning(diagnostic("ADDON_WARNING", ts.DiagnosticCategory.Warning));

        expect(actual).toBe("ADDON_WARNING");
    });
});

describe("partitionDiagnostics", () => {
    it("should return errors w/ error diagnostics", () => {
        const target = diagnostic("BOOM");

        const actual = partitionDiagnostics([target, diagnostic("whatever", ts.DiagnosticCategory.Warning)], false).errors;

        expect(actual).toEqual([target]);
    });

    it("should return warnings w/ warning diagnostics", () => {
        const target = diagnostic("whatever", ts.DiagnosticCategory.Warning);

        const actual = partitionDiagnostics([diagnostic("BOOM"), target], false).warnings;

        expect(actual).toEqual([target]);
    });

    it("should drop messages and suggestions w/o debug", () => {
        const actual = partitionDiagnostics([diagnostic("info", ts.DiagnosticCategory.Message), diagnostic("hint", ts.DiagnosticCategory.Suggestion)], false);

        expect(actual).toEqual({ errors: [], warnings: [] });
    });

    it("should return messages and suggestions as warnings w/ debug", () => {
        const message = diagnostic("info", ts.DiagnosticCategory.Message);
        const suggestion = diagnostic("hint", ts.DiagnosticCategory.Suggestion);

        const actual = partitionDiagnostics([message, suggestion], true).warnings;

        expect(actual).toEqual([message, suggestion]);
    });

    it("should drop duplicate warnings w/ same file, start, code and message", () => {
        const target = diagnostic("Missing addons", ts.DiagnosticCategory.Warning);

        const actual = partitionDiagnostics([target, diagnostic("Missing addons", ts.DiagnosticCategory.Warning)], false).warnings;

        expect(actual).toEqual([target]);
    });

    it("should keep warnings with different positions w/ same message", () => {
        const actual = partitionDiagnostics(
            [
                diagnostic("ESM91001", ts.DiagnosticCategory.Warning, { file: FILE, start: 0 }),
                diagnostic("ESM91001", ts.DiagnosticCategory.Warning, { file: FILE, start: START }),
            ],
            false
        ).warnings.length;

        expect(actual).toBe(2);
    });

    it("should drop duplicate errors w/ same message", () => {
        const actual = partitionDiagnostics([diagnostic("BOOM"), diagnostic("BOOM")], false).errors.length;

        expect(actual).toBe(1);
    });
});
