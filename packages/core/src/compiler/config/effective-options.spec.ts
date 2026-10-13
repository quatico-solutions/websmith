/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import ts from "typescript";
import { getEffectiveTarget } from "./effective-options";

const isTs5 = Number(ts.versionMajorMinor.split(".")[0]) < 6;
const describeOnTs5 = isTs5 ? describe : describe.skip;
const describeOnTs6 = isTs5 ? describe.skip : describe;

describe("getEffectiveTarget", () => {
    it("returns the explicit target", () => {
        const actual = getEffectiveTarget({ target: ts.ScriptTarget.ES2020 });

        expect(actual).toBe(ts.ScriptTarget.ES2020);
    });

    it("returns an explicit ES5 target with module nodenext", () => {
        const actual = getEffectiveTarget({ module: ts.ModuleKind.NodeNext, target: ts.ScriptTarget.ES5 });

        expect(actual).toBe(ts.ScriptTarget.ES5);
    });

    describeOnTs5("on TypeScript 5", () => {
        it("returns ES2022 with module node16 and no target", () => {
            const actual = getEffectiveTarget({ module: ts.ModuleKind.Node16 });

            expect(actual).toBe(ts.ScriptTarget.ES2022);
        });

        it("returns ESNext with module nodenext and no target", () => {
            const actual = getEffectiveTarget({ module: ts.ModuleKind.NodeNext });

            expect(actual).toBe(ts.ScriptTarget.ESNext);
        });
    });

    describeOnTs6("on TypeScript 6", () => {
        it.each([
            ["node16", ts.ModuleKind.Node16],
            ["nodenext", ts.ModuleKind.NodeNext],
        ])("returns the TypeScript default target with module %s and no target", (_name, module) => {
            const actual = getEffectiveTarget({ module });

            expect(actual).toBe(ts.getDefaultCompilerOptions().target);
        });
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
