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
import ts from "typescript";
import { createBrowserSystem, getVersionedFile } from "../../environment";
import { findStylesMethod, getFirstClassDeclaration, getOrCreateStylesMethod, inlineStyles, isStyleImport } from "./inline-styles";

const testSystem = createBrowserSystem({
    "one.ts": `class One {
        importedStyles() { return ""; }
    }`,
    "two.ts": `class Two {}`,
    "three.ts": `
        class One {}
        class Two {}
    `,
});

describe("findStylesMethod,", () => {
    it("returns style method with locally defined style method", () => {
        const file = getVersionedFile("one.ts", testSystem)!;
        const target = file.statements?.filter(cur => cur.kind === ts.SyntaxKind.ClassDeclaration)[0] as ts.ClassDeclaration;

        const actual = findStylesMethod(target)!;

        expect(actual.name).toEqual(expect.objectContaining({ escapedText: "importedStyles" }));
    });

    it("returns undefined with non-existing importedStyles method", () => {
        const file = getVersionedFile("two.ts", testSystem)!;
        const target = file.statements?.filter(cur => cur.kind === ts.SyntaxKind.ClassDeclaration)[0] as ts.ClassDeclaration;

        const actual = findStylesMethod(target);

        expect(actual).toBeUndefined();
    });
});

describe("getFirstClassDeclaration", () => {
    it("return class declaration with one locally defined class", () => {
        const target = getVersionedFile("two.ts", testSystem)!;

        const actual = getFirstClassDeclaration(target)!;

        expect(actual.name).toEqual(expect.objectContaining({ escapedText: "Two" }));
    });

    it("return first class declaration with multiple locally defined class", () => {
        const target = getVersionedFile("three.ts", testSystem)!;

        const actual = getFirstClassDeclaration(target)!;

        expect(actual.name).toEqual(expect.objectContaining({ escapedText: "One" }));
    });
});

describe("getOrCreateStylesMethod", () => {
    it("returns method declaration with non-existing importedStyle method", () => {
        const file = getVersionedFile("two.ts", testSystem)!;
        const target = file.statements?.filter(cur => cur.kind === ts.SyntaxKind.ClassDeclaration)[0] as ts.ClassDeclaration;

        const actual = getOrCreateStylesMethod(target, ["whatever"]);

        expect(actual.name).toEqual(expect.objectContaining({ escapedText: "importedStyles" }));
    });

    it("returns method declaration with existing importedStyle method", () => {
        const file = getVersionedFile("one.ts", testSystem)!;
        const target = file.statements?.filter(cur => cur.kind === ts.SyntaxKind.ClassDeclaration)[0] as ts.ClassDeclaration;

        const actual = getOrCreateStylesMethod(target, ["whatever"]);

        expect(actual.name).toEqual(expect.objectContaining({ escapedText: "importedStyles" }));
    });

    it("returns styles in method body with existing importedStyle method", () => {
        const file = getVersionedFile("one.ts", testSystem)!;
        const target = file.statements?.filter(cur => cur.kind === ts.SyntaxKind.ClassDeclaration)[0] as ts.ClassDeclaration;

        const actual = getOrCreateStylesMethod(target, ["expected"]).body?.statements[0] as any;

        expect(actual.expression).toEqual(expect.objectContaining({ text: "expected" }));
    });
});

describe("inlineStyles", () => {
    it("returns SourceFile with same class declaration", () => {
        const target = getVersionedFile("one.ts", testSystem)!;
        const compiledStyles = ["expected"];

        const result = inlineStyles(target, compiledStyles);

        const actual = result.statements?.filter(cur => cur.kind === ts.SyntaxKind.ClassDeclaration)[0] as ts.ClassDeclaration;
        expect(actual.name).toEqual(expect.objectContaining({ escapedText: "One" }));
    });

    it("returns SourceFile and defined method with existing importedStyles method", () => {
        const target = getVersionedFile("one.ts", testSystem)!;
        const compiledStyles = ["expected"];

        const result = inlineStyles(target, compiledStyles);

        const classDecl = result.statements?.filter(cur => cur.kind === ts.SyntaxKind.ClassDeclaration)[0] as ts.ClassDeclaration;
        const actual = findStylesMethod(classDecl)?.body?.statements[0] as any;

        expect(actual.expression).toEqual(expect.objectContaining({ text: "" }));
    });

    it("returns SourceFile and newly created method declaration with non-existing importedStyles method", () => {
        const target = getVersionedFile("two.ts", testSystem)!;
        const compiledStyles = ["expected"];

        const result = inlineStyles(target, compiledStyles);

        const classDecl = result.statements?.filter(cur => cur.kind === ts.SyntaxKind.ClassDeclaration)[0] as ts.ClassDeclaration;
        const actual = findStylesMethod(classDecl)?.body?.statements[0] as any;

        expect(actual.expression).toEqual(expect.objectContaining({ text: "expected" }));
    });
});

describe("isStyleImport", () => {
    it("returns true with import decl and style name", () => {
        const target = {
            kind: ts.SyntaxKind.ImportDeclaration,
            moduleSpecifier: {
                text: "target.scss",
            },
        } as any;

        expect(isStyleImport(target)).toBe(true);
    });

    it("returns true with import decl and style path", () => {
        const target = {
            kind: ts.SyntaxKind.ImportDeclaration,
            moduleSpecifier: {
                text: "./target.scss",
            },
        } as any;

        expect(isStyleImport(target)).toBe(true);
    });

    it("returns true with other kind and style name", () => {
        const target = {
            kind: ts.SyntaxKind.AbstractKeyword,
            moduleSpecifier: {
                text: "target.scss",
            },
        } as any;

        expect(isStyleImport(target)).toBe(false);
    });

    it("returns false with import decl and non-style name", () => {
        const target = {
            kind: ts.SyntaxKind.ImportDeclaration,
            moduleSpecifier: {
                text: "target.ts",
            },
        } as any;

        expect(isStyleImport(target)).toBe(false);
    });
});
