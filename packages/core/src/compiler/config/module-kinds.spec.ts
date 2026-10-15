/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import ts from "typescript";
import { isNodeModuleKind } from "./module-kinds";

// TypeScript gives a file a module format of its own only under a node module kind
const hasImpliedNodeFormat = (module: ts.ModuleKind): boolean =>
    ts.getImpliedNodeFormatForFile(
        "/p/a.ts",
        ts.createModuleResolutionCache("/p", name => name).getPackageJsonInfoCache(),
        { fileExists: () => false, readFile: () => undefined },
        { module }
    ) !== undefined;

const MODULE_KINDS = Object.values(ts.ModuleKind).filter((value): value is ts.ModuleKind => typeof value === "number");

describe("isNodeModuleKind", () => {
    it.each(MODULE_KINDS)("returns TypeScript's answer w/ module %d", module => {
        const expected = hasImpliedNodeFormat(module);

        const actual = isNodeModuleKind(module);

        expect(actual).toBe(expected);
    });

    it("returns false w/ a value whose member the module kinds lack", () => {
        const actual = isNodeModuleKind(101 as ts.ModuleKind, { Node16: 100, NodeNext: 199 });

        expect(actual).toBe(false);
    });

    it("returns true w/ a value of a member the module kinds have", () => {
        const actual = isNodeModuleKind(100 as ts.ModuleKind, { Node16: 100, NodeNext: 199 });

        expect(actual).toBe(true);
    });

    it("returns false w/o module", () => {
        const actual = isNodeModuleKind(undefined);

        expect(actual).toBe(false);
    });
});
