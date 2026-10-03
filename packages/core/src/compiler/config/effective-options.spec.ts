/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import ts from "typescript";
import { getEffectiveTarget } from "./effective-options";

describe("getEffectiveTarget", () => {
    it("returns the explicit target", () => {
        const actual = getEffectiveTarget({ target: ts.ScriptTarget.ES2020 });

        expect(actual).toBe(ts.ScriptTarget.ES2020);
    });

    it("returns an explicit ES5 target with module nodenext", () => {
        const actual = getEffectiveTarget({ module: ts.ModuleKind.NodeNext, target: ts.ScriptTarget.ES5 });

        expect(actual).toBe(ts.ScriptTarget.ES5);
    });

    it("returns ES2022 with module node16 and no target", () => {
        const actual = getEffectiveTarget({ module: ts.ModuleKind.Node16 });

        expect(actual).toBe(ts.ScriptTarget.ES2022);
    });

    it("returns ESNext with module nodenext and no target", () => {
        const actual = getEffectiveTarget({ module: ts.ModuleKind.NodeNext });

        expect(actual).toBe(ts.ScriptTarget.ESNext);
    });

    it.each([
        ["preserve", ts.ModuleKind.Preserve],
        ["commonjs", ts.ModuleKind.CommonJS],
        ["esnext", ts.ModuleKind.ESNext],
        ["unset", undefined],
    ])("returns the TypeScript default target with module %s and no target", (_name, module) => {
        const actual = getEffectiveTarget({ module });

        expect(actual).toBe(ts.getDefaultCompilerOptions().target);
    });
});
