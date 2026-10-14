/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import ts from "typescript";
import { checkTargetModule, selectConfigErrors } from "./config-errors";

const diagnostic = (category: ts.DiagnosticCategory): ts.Diagnostic => ({
    category,
    code: 1,
    file: undefined,
    start: undefined,
    length: undefined,
    messageText: "whatever",
});

describe("selectConfigErrors", () => {
    it("should return errors w/ errors in build", () => {
        const target = diagnostic(ts.DiagnosticCategory.Error);

        const actual = selectConfigErrors("build", undefined, [diagnostic(ts.DiagnosticCategory.Warning), target]);

        expect(actual).toEqual([target]);
    });

    it("should return none w/ build error", () => {
        const actual = selectConfigErrors("build", new Error("whatever"), [diagnostic(ts.DiagnosticCategory.Error)]);

        expect(actual).toEqual([]);
    });

    it("should return none w/ warnings only", () => {
        const actual = selectConfigErrors("build", undefined, [diagnostic(ts.DiagnosticCategory.Warning)]);

        expect(actual).toEqual([]);
    });

    it("should return none w/ errors in serve", () => {
        const actual = selectConfigErrors("serve", undefined, [diagnostic(ts.DiagnosticCategory.Error)]);

        expect(actual).toEqual([]);
    });
});

describe("checkTargetModule", () => {
    it.each([
        ["CommonJS", ts.ModuleKind.CommonJS],
        ["AMD", ts.ModuleKind.AMD],
        ["UMD", ts.ModuleKind.UMD],
        ["System", ts.ModuleKind.System],
    ])("should return error naming profile and module w/ module %s", (name, module) => {
        const actual = checkTargetModule("app", { module }, false)?.messageText;

        expect(actual).toBe(
            `Profile 'app' emits ${name} ('tsConfig.module' is '${name.toLowerCase()}'), which Vite cannot bundle as an ES module. Use "ESNext" or "ES2022".`
        );
    });

    it("should return error w/ unset module and target ES5", () => {
        const actual = checkTargetModule("app", { target: ts.ScriptTarget.ES5 }, false)?.messageText;

        expect(actual).toBe(`Profile 'app' emits CommonJS ('tsConfig.module' is unset and 'target' is 'ES5'), which Vite cannot bundle as an ES module. Use "ESNext" or "ES2022".`);
    });

    it("should return error category w/ commonjs module", () => {
        const actual = checkTargetModule("app", { module: ts.ModuleKind.CommonJS }, false)?.category;

        expect(actual).toBe(ts.DiagnosticCategory.Error);
    });

    it("should return none w/ unset module and target ES2022", () => {
        const actual = checkTargetModule("app", { target: ts.ScriptTarget.ES2022 }, false);

        expect(actual).toBeUndefined();
    });

    it("should return none w/ module ESNext", () => {
        const actual = checkTargetModule("app", { module: ts.ModuleKind.ESNext }, false);

        expect(actual).toBeUndefined();
    });

    it("should return none w/ commonjs module and esm set", () => {
        const actual = checkTargetModule("app", { module: ts.ModuleKind.CommonJS }, true);

        expect(actual).toBeUndefined();
    });

    it("should name default profile w/o profile", () => {
        const actual = checkTargetModule(undefined, { module: ts.ModuleKind.CommonJS }, false)?.messageText;

        expect(actual).toMatch(/^The default profile emits CommonJS/);
    });
});
