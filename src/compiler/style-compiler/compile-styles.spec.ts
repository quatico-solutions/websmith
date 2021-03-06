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
// tslint:disable: object-literal-sort-keys
import * as ts from "typescript";
import { ReporterMock } from "../../__mocks__";
import { createBrowserSystem, getSourceFile } from "../../environment";
import { createStyleCompiler, resolveStyleImports, tryTransform } from "./compile-styles";
import { findStylesMethod } from "./inline-styles";

const testSystem = createBrowserSystem({
    "/two.scss": `.target { display: none; }`,
    "one.ts": "class One {}",
    "two.ts": `
        import "/two.scss"
        @customElement("my-two")
        class Two {}
    `,
    "three.ts": `
        @customElement("my-three")
        class Three {}
    `,
    "four.ts": `
        import "/two.scss"
        class Four {}
    `,
    "five.ts": `
        import "DOESNOTEXIST.scss"
        @customElement("my-five")
        class Two {}
    `,
});
const reporter = new ReporterMock(testSystem);

describe("resolveStyleImports", () => {
    it("returns absolute path with local path import", () => {
        const target = {
            fileName: "/absolute/path/target.ts",
            statements: [
                {
                    kind: ts.SyntaxKind.ImportDeclaration,
                    moduleSpecifier: {
                        text: "./target.scss",
                    },
                },
            ],
        } as any;

        const actual = resolveStyleImports(target, testSystem);

        expect(actual).toEqual(["/absolute/path/target.scss"]);
    });

    it("returns absolute path with file name import", () => {
        const target = {
            fileName: "/absolute/path/target.ts",
            statements: [
                {
                    kind: ts.SyntaxKind.ImportDeclaration,
                    moduleSpecifier: {
                        text: "target.scss",
                    },
                },
            ],
        } as any;

        const actual = resolveStyleImports(target, testSystem);

        expect(actual).toEqual(["/absolute/path/target.scss"]);
    });

    it("returns absolute path with absolute file path import", () => {
        const target = {
            fileName: "/absolute/path/target.ts",
            statements: [
                {
                    kind: ts.SyntaxKind.ImportDeclaration,
                    moduleSpecifier: {
                        text: "/foo/bar/target.scss",
                    },
                },
            ],
        } as any;

        const actual = resolveStyleImports(target, testSystem);

        expect(actual).toEqual(["/absolute/path/target.scss"]);
    });
});

describe("tryTransform", () => {
    it("does not modify styles w/o visitor", () => {
        const actual = tryTransform(".target { display: none; }", {
            reporter,
            visitor: {},
        });

        expect(actual).toBe(".target { display: none; }");
    });

    it("counts all classes with class visitor", () => {
        const createTestVisitor = () => {
            let count = 0;
            return {
                getCount: () => count,
                visitClass: () => {
                    count += 1;
                    return false;
                },
            };
        };

        const target = createTestVisitor() as any;

        tryTransform(
            `
            .one { display: none; } 
            .two { display: none; } 
            .three { display: none; } 
        `,
            { reporter, visitor: target }
        );

        expect(target.getCount()).toBe(3);
    });

    it("modifies class identifier with class start and identifier end visitor", () => {
        const actual = tryTransform(".target { display: none; }", {
            reporter,
            visitor: {
                endVisit: node => node.type === "class",
                startVisit: node => node.type === "class",
                visitIdentifier: node => {
                    node.value = `${node.value}-expected`;
                    return false;
                },
            },
        });

        expect(actual).toBe(".target-expected { display: none; }");
    });

    it("modifies class identifier with multiple classes and class end visitor", () => {
        const actual = tryTransform(
            `
            .one { display: none; } 
            .two { display: none; } 
            .three { display: none; } 
            `,
            {
                reporter,
                visitor: {
                    endVisit: node => node.type === "class",
                    startVisit: node => node.type === "class",
                    visitIdentifier: node => {
                        node.value = `${node.value}-expected`;
                        return true;
                    },
                },
            }
        );

        expect(actual).toBe(
            `
            .one-expected { display: none; } 
            .two-expected { display: none; } 
            .three-expected { display: none; } 
            `
        );
    });
});

describe("createStyleCompiler", () => {
    it("yields injected importedStyles method with style import", () => {
        const compileStyles = createStyleCompiler({ reporter, system: testSystem }, {});

        const result = compileStyles({} as any)(getSourceFile("two.ts", testSystem)!);
        const classDecl = result.statements?.filter(
            cur => cur.kind === ts.SyntaxKind.ClassDeclaration
        )[0] as ts.ClassDeclaration;
        const actual = findStylesMethod(classDecl)!.body!.statements[0] as any;

        expect(actual.expression.text).toBe(
            `.target {
display: none;
}`
        );
    });

    it("yields unmodified code w/o style import", () => {
        const compileStyles = createStyleCompiler({ reporter, system: testSystem }, {});

        const actual = compileStyles({} as any)(getSourceFile("one.ts", testSystem)!);

        expect(actual.text).toBe("class One {}");
    });

    it("yields no method w/o customElement decorator", () => {
        const compileStyles = createStyleCompiler({ reporter, system: testSystem }, {});

        const result = compileStyles({} as any)(getSourceFile("four.ts", testSystem)!);

        const classDecl = result.statements?.filter(
            cur => cur.kind === ts.SyntaxKind.ClassDeclaration
        )[0] as ts.ClassDeclaration;
        const actual = findStylesMethod(classDecl);

        expect(actual).toBeUndefined();
    });

    it("yields no method w/ non-existing style import", () => {
        const compileStyles = createStyleCompiler({ reporter, system: testSystem }, {});

        const result = compileStyles({} as any)(getSourceFile("five.ts", testSystem)!);

        const classDecl = result.statements?.filter(
            cur => cur.kind === ts.SyntaxKind.ClassDeclaration
        )[0] as ts.ClassDeclaration;
        const actual = findStylesMethod(classDecl);

        expect(actual).toBeUndefined();
    });
});
