/*
 * @license
 *
 * Copyright (c) 2017-2021 Quatico Solutions AG
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
import { getBaseName, isElementDeclaration, isScriptFile, isStyleFile } from "./elements";

describe("getBaseName", () => {
    it('returns filePath w/o "/" in path', () => {
        expect(getBaseName("one.ts")).toBe("one.ts");
    });

    it('returns name with single "/" in path', () => {
        expect(getBaseName("/one.ts")).toBe("one.ts");
    });

    it('returns name with multiple "/" in path', () => {
        expect(getBaseName("/zip/zap/zup/one.ts")).toBe("one.ts");
    });

    it('returns name with double "/" in path', () => {
        expect(getBaseName("//one.ts")).toBe("one.ts");
    });
});

describe("isElementDeclaration", () => {
    it("returns true with ClassDeclaration and custom element decorator", () => {
        const target = {
            decorators: [{ getText: () => `@customElement("whatever")` }],
            kind: ts.SyntaxKind.ClassDeclaration,
        } as any;

        const actual = isElementDeclaration(target);

        expect(actual).toBe(true);
    });

    it("returns false without ClassDeclaration", () => {
        const target = {
            decorators: [{ getText: () => `@customElement("whatever")` }],
            kind: ts.SyntaxKind.MethodDeclaration,
        } as any;

        const actual = isElementDeclaration(target);

        expect(actual).toBe(false);
    });

    it("returns false with ClassDeclaration and no decorator", () => {
        const target = {
            kind: ts.SyntaxKind.ClassDeclaration,
        } as any;

        const actual = isElementDeclaration(target);

        expect(actual).toBe(false);
    });

    it("returns true with single-quote decorator", () => {
        const target = {
            decorators: [{ getText: () => `@customElement('whatever')` }],
            kind: ts.SyntaxKind.ClassDeclaration,
        } as any;

        const actual = isElementDeclaration(target);

        expect(actual).toBe(true);
    });

    it("returns false with other decorator", () => {
        const target = {
            decorators: [{ getText: () => `@otherElement('whatever')` }],
            kind: ts.SyntaxKind.ClassDeclaration,
        } as any;

        const actual = isElementDeclaration(target);

        expect(actual).toBe(false);
    });

    it("returns false without decorators", () => {
        const target = {} as any;

        const actual = isElementDeclaration(target);

        expect(actual).toBe(false);
    });
});

describe("isScriptFile", () => {
    it("returns true for SourceFile with ClassDeclaration and custom element decorator", () => {
        const target = {
            fileName: "whatever.ts",
            kind: ts.SyntaxKind.SourceFile,
            statements: [
                {
                    decorators: [{ getText: () => `@customElement("whatever")` }],
                    kind: ts.SyntaxKind.ClassDeclaration,
                },
            ],
        } as any;

        const actual = isScriptFile(target);

        expect(actual).toBe(true);
    });

    it("returns false for SourceFile without ClassDeclaration", () => {
        const target = {
            fileName: "whatever.ts",
            kind: ts.SyntaxKind.SourceFile,
            statements: [
                {
                    decorators: [{ getText: () => `@customElement("whatever")` }],
                    kind: ts.SyntaxKind.MethodDeclaration,
                },
            ],
        } as any;

        const actual = isScriptFile(target);

        expect(actual).toBe(false);
    });

    it("returns false for not SourceFile", () => {
        const target = {
            fileName: "whatever.ts",
            kind: ts.SyntaxKind.AnyKeyword,
            statements: [
                {
                    decorators: [{ getText: () => `@customElement("whatever")` }],
                    kind: ts.SyntaxKind.ClassDeclaration,
                },
            ],
        } as any;

        const actual = isScriptFile(target);

        expect(actual).toBe(false);
    });

    it("returns false for SourceFile with ClassDeclaration and no decorator", () => {
        const target = {
            fileName: "whatever.ts",
            kind: ts.SyntaxKind.SourceFile,
            statements: [
                {
                    kind: ts.SyntaxKind.ClassDeclaration,
                },
            ],
        } as any;

        const actual = isScriptFile(target);

        expect(actual).toBe(false);
    });

    it("returns true for SourceFile with single-quote decorator", () => {
        const target = {
            fileName: "whatever.ts",
            kind: ts.SyntaxKind.SourceFile,
            statements: [
                {
                    decorators: [{ getText: () => `@customElement('whatever')` }],
                    kind: ts.SyntaxKind.ClassDeclaration,
                },
            ],
        } as any;

        const actual = isScriptFile(target);

        expect(actual).toBe(true);
    });

    it("returns false with other decorator", () => {
        const target = {
            fileName: "whatever.ts",
            kind: ts.SyntaxKind.AnyKeyword,
            statements: [
                {
                    decorators: [{ getText: () => `@otherElement('whatever')` }],
                    kind: ts.SyntaxKind.ClassDeclaration,
                },
            ],
        } as any;

        const actual = isScriptFile(target);

        expect(actual).toBe(false);
    });

    it("returns false without decorators", () => {
        const target = {} as any;

        const actual = isScriptFile(target);

        expect(actual).toBe(false);
    });
});

describe("isStyleFile", () => {
    it("returns true for style file w/ underscore name", () => {
        const target = {
            fileName: "_whatever.css",
            kind: ts.SyntaxKind.SourceFile,
        } as any;

        const actual = isStyleFile(target);

        expect(actual).toBe(true);
    });

    it("returns true for style file w/o underscore name", () => {
        const target = {
            fileName: "whatever.css",
            kind: ts.SyntaxKind.SourceFile,
        } as any;

        const actual = isStyleFile(target);

        expect(actual).toBe(true);
    });

    it("returns false for style file w/o underscore name and true", () => {
        const target = {
            fileName: "whatever.css",
            kind: ts.SyntaxKind.SourceFile,
        } as any;

        const actual = isStyleFile(target, true);

        expect(actual).toBe(false);
    });
});
