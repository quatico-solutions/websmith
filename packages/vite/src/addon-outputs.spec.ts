/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type Reporter } from "@quatico/websmith-api";
import ts from "typescript";
import { AddonOutputs, type BundleContext, type OutputsContext } from "./addon-outputs";

const OUT_DIR = "/project/dist";

const createReporter = (): Reporter & { reportDiagnostic: jest.Mock } => ({
    reportDiagnostic: jest.fn(),
    reportWatchStatus: jest.fn(),
    indent: jest.fn(),
    unindent: jest.fn(),
});

const createOutputs = (reporter: Reporter = createReporter(), command: "build" | "serve" = "build"): AddonOutputs => {
    const testObj = new AddonOutputs(reporter);
    testObj.configure({ outDir: OUT_DIR, command });
    return testObj;
};

const createContext = (): OutputsContext & BundleContext => ({ addWatchFile: jest.fn(), emitFile: jest.fn(() => "whatever") });

const messages = (reporter: { reportDiagnostic: jest.Mock }): [ts.DiagnosticCategory, string][] =>
    reporter.reportDiagnostic.mock.calls.map(([cur]: [ts.Diagnostic]) => [cur.category, ts.flattenDiagnosticMessageText(cur.messageText, "\n")]);

const emitted = (context: BundleContext): unknown[] => (context.emitFile as jest.Mock).mock.calls.map(([cur]: [unknown]) => cur);

describe("AddonOutputs", () => {
    describe("toBundleFileName", () => {
        it("should return path as written w/ relative path", () => {
            const testObj = createOutputs();

            const actual = testObj.toBundleFileName("assets\\virtual.json", "addVirtualFile", "probe");

            expect(actual).toBe("assets/virtual.json");
        });

        it("should return path relative to outDir w/ absolute path in outDir", () => {
            const testObj = createOutputs();

            const actual = testObj.toBundleFileName(`${OUT_DIR}/nested/v.txt`, "addVirtualFile", "probe");

            expect(actual).toBe("nested/v.txt");
        });

        it("should report error w/ absolute path outside outDir", () => {
            const reporter = createReporter();
            const testObj = createOutputs(reporter);

            testObj.toBundleFileName("/project/src/virtual.ts", "addVirtualFile", "probe");

            expect(messages(reporter)).toEqual([
                [
                    ts.DiagnosticCategory.Error,
                    `addVirtualFile of addon "probe" cannot place '/project/src/virtual.ts' in the bundle: it is outside build.outDir '${OUT_DIR}'`,
                ],
            ]);
        });

        it("should return undefined w/ relative path naming outDir itself", () => {
            const testObj = createOutputs();

            const actual = testObj.toBundleFileName("nested/..", "addVirtualFile", "probe");

            expect(actual).toBeUndefined();
        });

        it("should report removal error w/ absolute path outside outDir", () => {
            const reporter = createReporter();
            const testObj = createOutputs(reporter);

            testObj.toBundleFileName("/project/src/main.js", "removeOutputFile", "probe");

            expect(messages(reporter)).toEqual([
                [
                    ts.DiagnosticCategory.Error,
                    `removeOutputFile of addon "probe" cannot remove '/project/src/main.js' from the bundle: it is outside build.outDir '${OUT_DIR}'`,
                ],
            ]);
        });

        it("should return undefined w/ relative path leaving outDir", () => {
            const testObj = createOutputs();

            const actual = testObj.toBundleFileName("../virtual.json", "addVirtualFile", "probe");

            expect(actual).toBeUndefined();
        });
    });

    describe("addWatchFile", () => {
        it("should add watch file to running hook context", () => {
            const context = createContext();
            const testObj = createOutputs();

            testObj.run(context, undefined, () => testObj.addWatchFile("/project/t.html", "addAssetDependency", "probe"));

            expect(context.addWatchFile).toHaveBeenCalledWith("/project/t.html");
        });

        it("should report error w/o running hook", () => {
            const reporter = createReporter();
            const testObj = createOutputs(reporter);

            testObj.addWatchFile("/project/t.html", "addAssetDependency", "probe");

            expect(messages(reporter)).toEqual([
                [
                    ts.DiagnosticCategory.Error,
                    `addAssetDependency of addon "probe" was called outside a Vite build hook: '/project/t.html' is not watched`,
                ],
            ]);
        });

        it("should report error after running hook returned", () => {
            const reporter = createReporter();
            const context = createContext();
            const testObj = createOutputs(reporter);
            testObj.run(context, undefined, () => undefined);

            testObj.addWatchFile("/project/t.html", "addInputFile", "probe");

            expect(context.addWatchFile).not.toHaveBeenCalled();
        });
    });

    describe("startModule", () => {
        it("should drop only entries of that module", () => {
            const context = createContext();
            const testObj = createOutputs();
            testObj.run(context, "/project/src/a.ts", () => testObj.addVirtualFile("a.json", "A", "probe"));
            testObj.run(context, "/project/src/b.ts", () => testObj.addVirtualFile("b.json", "B", "probe"));

            testObj.startModule("/project/src/a.ts");
            testObj.generateBundle(context, {}, ["/project/src/a.ts", "/project/src/b.ts"]);

            expect(emitted(context)).toEqual([{ type: "asset", fileName: "b.json", source: "B" }]);
        });
    });

    describe("startBuild", () => {
        it("should drop entries made outside a transform", () => {
            const context = createContext();
            const testObj = createOutputs();
            testObj.run(context, undefined, () => testObj.addVirtualFile("build.json", "B", "probe"));

            testObj.startBuild();
            testObj.generateBundle(context, {}, []);

            expect(emitted(context)).toEqual([]);
        });
    });

    describe("generateBundle", () => {
        it("should emit virtual files as assets w/ last content", () => {
            const context = createContext();
            const testObj = createOutputs();
            testObj.run(context, "/project/src/a.ts", () => {
                testObj.addVirtualFile("v.json", "first", "probe");
                testObj.addVirtualFile("v.json", "second", "probe");
            });
            testObj.run(context, undefined, () => testObj.addVirtualFile(`${OUT_DIR}/nested/v.txt`, "result", "probe"));

            testObj.generateBundle(context, {}, ["/project/src/a.ts"]);

            expect(emitted(context)).toEqual([
                { type: "asset", fileName: "v.json", source: "second" },
                { type: "asset", fileName: "nested/v.txt", source: "result" },
            ]);
        });

        it("should delete removed file from bundle", () => {
            const bundle = { "main.js": "whatever", "style.css": "whatever" };
            const testObj = createOutputs();
            testObj.run(createContext(), "/project/src/a.ts", () => testObj.removeOutputFile("style.css", "probe"));

            testObj.generateBundle(createContext(), bundle, ["/project/src/a.ts"]);

            expect(Object.keys(bundle)).toEqual(["main.js"]);
        });

        it("should not emit virtual file removed afterwards", () => {
            const context = createContext();
            const testObj = createOutputs();
            testObj.run(context, "/project/src/a.ts", () => testObj.addVirtualFile("v.json", "V", "probe"));
            testObj.run(context, "/project/src/b.ts", () => testObj.removeOutputFile("v.json", "other"));

            testObj.generateBundle(context, {}, ["/project/src/a.ts", "/project/src/b.ts"]);

            expect(emitted(context)).toEqual([]);
        });

        it("should warn w/ removal of file absent from bundle", () => {
            const reporter = createReporter();
            const testObj = createOutputs(reporter);
            testObj.run(createContext(), "/project/src/a.ts", () => testObj.removeOutputFile("absent.js", "probe"));

            testObj.generateBundle(createContext(), {}, ["/project/src/a.ts"]);

            expect(messages(reporter)).toEqual([
                [ts.DiagnosticCategory.Warning, `removeOutputFile of addon "probe" found no 'absent.js' in the bundle`],
            ]);
        });

        it("should apply only entries of given module ids", () => {
            const context = createContext();
            const testObj = createOutputs();
            testObj.run(context, "/project/src/a.ts", () => testObj.addVirtualFile("a.json", "A", "probe"));
            testObj.run(context, "/project/src/gone.ts", () => testObj.addVirtualFile("gone.json", "G", "probe"));

            testObj.generateBundle(context, {}, ["/project/src/a.ts"]);

            expect(emitted(context)).toEqual([{ type: "asset", fileName: "a.json", source: "A" }]);
        });

        it("should emit nothing w/ serve mode", () => {
            const context = createContext();
            const testObj = createOutputs(createReporter(), "serve");
            testObj.run(context, "/project/src/a.ts", () => testObj.addVirtualFile("a.json", "A", "probe"));

            testObj.generateBundle(context, {}, ["/project/src/a.ts"]);

            expect(emitted(context)).toEqual([]);
        });

        it("should not warn w/ serve mode and removal of absent file", () => {
            const reporter = createReporter();
            const testObj = createOutputs(reporter, "serve");
            testObj.run(createContext(), "/project/src/a.ts", () => testObj.removeOutputFile("absent.js", "probe"));

            testObj.generateBundle(createContext(), {}, ["/project/src/a.ts"]);

            expect(reporter.reportDiagnostic).not.toHaveBeenCalled();
        });
    });
});
