/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { createSystem } from "../../environment";
import ts from "typescript";
import { projectFileDiagnostic, resolveProjectFile } from "./resolve-project-file";

describe("resolveProjectFile", () => {
    it("yields absolute file path w/ existing tsconfig file", () => {
        const target = createSystem({ "/project/tsconfig.build.json": "{}" }, { virtual: true });

        const actual = resolveProjectFile(target, "./project/tsconfig.build.json");

        expect(actual).toBe("/project/tsconfig.build.json");
    });

    it("yields tsconfig.json in directory w/ directory path", () => {
        const target = createSystem({ "/project/tsconfig.json": "{}" }, { virtual: true });

        const actual = resolveProjectFile(target, "./project");

        expect(actual).toBe("/project/tsconfig.json");
    });

    it("yields tsconfig.json in current directory w/ current directory path", () => {
        const target = createSystem({ "/tsconfig.json": "{}" }, { virtual: true });

        const actual = resolveProjectFile(target, "./");

        expect(actual).toBe("/tsconfig.json");
    });

    it("yields tsconfig.json in directory w/ directory without tsconfig.json", () => {
        const target = createSystem({ "/project/src/index.ts": "export {};" }, { virtual: true });

        const actual = resolveProjectFile(target, "./project");

        expect(actual).toBe("/project/tsconfig.json");
    });

    it("yields absolute path w/ missing path", () => {
        const target = createSystem({}, { virtual: true });

        const actual = resolveProjectFile(target, "./missing.json");

        expect(actual).toBe("/missing.json");
    });

    it("yields same path w/ already resolved directory", () => {
        const target = createSystem({ "/project/src/index.ts": "export {};" }, { virtual: true });

        const actual = resolveProjectFile(target, resolveProjectFile(target, "./project"));

        expect(actual).toBe("/project/tsconfig.json");
    });

    it("yields same path w/ already resolved file", () => {
        const target = createSystem({ "/project/tsconfig.json": "{}" }, { virtual: true });

        const actual = resolveProjectFile(target, resolveProjectFile(target, "/project/tsconfig.json"));

        expect(actual).toBe("/project/tsconfig.json");
    });
});

describe("projectFileDiagnostic", () => {
    it("yields undefined w/ existing tsconfig file", () => {
        const target = createSystem({ "/project/tsconfig.json": "{}" }, { virtual: true });

        const actual = projectFileDiagnostic(target, "./project/tsconfig.json");

        expect(actual).toBeUndefined();
    });

    it("yields undefined w/ directory containing tsconfig.json", () => {
        const target = createSystem({ "/project/tsconfig.json": "{}" }, { virtual: true });

        const actual = projectFileDiagnostic(target, "./project");

        expect(actual).toBeUndefined();
    });

    it("yields 5058 with absolute path w/ missing file", () => {
        const target = createSystem({}, { virtual: true });

        const actual = projectFileDiagnostic(target, "./missing.json");

        expect(actual).toEqual(
            expect.objectContaining({
                category: ts.DiagnosticCategory.Error,
                code: 5058,
                file: undefined,
                messageText: "The specified path does not exist: '/missing.json'.",
            })
        );
    });

    it("yields 5058 w/ missing tsconfig.json in current directory given as file", () => {
        const target = createSystem({ "/src/index.ts": "export {};" }, { virtual: true });

        const actual1 = projectFileDiagnostic(target, "tsconfig.json");
        const actual2 = projectFileDiagnostic(target, "./tsconfig.json");

        expect(actual1).toEqual(expect.objectContaining({ code: 5058, messageText: "The specified path does not exist: '/tsconfig.json'." }));
        expect(actual2).toEqual(expect.objectContaining({ code: 5058, messageText: "The specified path does not exist: '/tsconfig.json'." }));
    });

    it("yields 5058 w/ missing tsconfig.json in existing directory given as file", () => {
        const target = createSystem({ "/project/src/index.ts": "export {};" }, { virtual: true });

        const actual = projectFileDiagnostic(target, "./project/tsconfig.json");

        expect(actual).toEqual(expect.objectContaining({ code: 5058, messageText: "The specified path does not exist: '/project/tsconfig.json'." }));
    });

    it("yields 5057 with absolute path w/ directory without tsconfig.json", () => {
        const target = createSystem({ "/emptydir/src/index.ts": "export {};" }, { virtual: true });

        const actual = projectFileDiagnostic(target, "./emptydir");

        expect(actual).toEqual(
            expect.objectContaining({
                category: ts.DiagnosticCategory.Error,
                code: 5057,
                file: undefined,
                messageText: "Cannot find a tsconfig.json file at the specified directory: '/emptydir'.",
            })
        );
    });

    it("yields 5057 w/ current directory without tsconfig.json", () => {
        const target = createSystem({ "/src/index.ts": "export {};" }, { virtual: true });

        const actual1 = projectFileDiagnostic(target, ".");
        const actual2 = projectFileDiagnostic(target, "./");

        expect(actual1).toEqual(expect.objectContaining({ code: 5057, messageText: "Cannot find a tsconfig.json file at the specified directory: '/'." }));
        expect(actual2).toEqual(expect.objectContaining({ code: 5057 }));
    });
});
