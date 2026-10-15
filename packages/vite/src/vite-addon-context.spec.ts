/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type Reporter } from "@quatico/websmith-api";
import { createSystem } from "@quatico/websmith-core";
import ts from "typescript";
import { type AddonOutputs } from "./addon-outputs";
import { ViteAddonContext } from "./vite-addon-context";

type OutputsStub = Pick<AddonOutputs, "addWatchFile" | "addVirtualFile" | "removeOutputFile" | "startActivation"> & {
    addWatchFile: jest.Mock;
    addVirtualFile: jest.Mock;
    removeOutputFile: jest.Mock;
    startActivation: jest.Mock;
};

const createReporter = (): Reporter & { reportDiagnostic: jest.Mock } => ({
    reportDiagnostic: jest.fn(),
    reportWatchStatus: jest.fn(),
    indent: jest.fn(),
    unindent: jest.fn(),
});

const createOutputs = (): OutputsStub => ({
    addWatchFile: jest.fn(),
    addVirtualFile: jest.fn(),
    removeOutputFile: jest.fn(),
    startActivation: jest.fn(),
});

const createTestObj = (outputs: OutputsStub = createOutputs(), reporter: Reporter = createReporter()): ViteAddonContext => {
    const system = createSystem({}, { virtual: true });
    return new ViteAddonContext({ tsConfig: {}, projectDir: "/project", reporter, rootFiles: [], system }, outputs as unknown as AddonOutputs);
};

const errors = (reporter: { reportDiagnostic: jest.Mock }): string[] =>
    reporter.reportDiagnostic.mock.calls
        .map(([cur]: [ts.Diagnostic]) => cur)
        .filter(cur => cur.category === ts.DiagnosticCategory.Error)
        .map(cur => ts.flattenDiagnosticMessageText(cur.messageText, "\n"));

describe("ViteAddonContext", () => {
    describe("constructor", () => {
        it("should drop outputs of last activation", () => {
            const outputs = createOutputs();

            createTestObj(outputs);

            expect(outputs.startActivation).toHaveBeenCalledTimes(1);
        });
    });

    describe("addInputFile", () => {
        it("should add resolved code file as watch file", () => {
            const outputs = createOutputs();
            const testObj = createTestObj(outputs);

            testObj.runAsAddon("probe", () => testObj.addInputFile("src/extra.ts"));

            expect(outputs.addWatchFile).toHaveBeenCalledWith("/project/src/extra.ts", "addInputFile", "probe");
        });

        it("should report core error w/ non-code file", () => {
            const reporter = createReporter();
            const testObj = createTestObj(createOutputs(), reporter);

            testObj.addInputFile("/project/data.json");

            expect(errors(reporter)).toEqual([
                "Only code files are supported for addInputFile. .json of /project/data.json is no valid code file extension.",
            ]);
        });

        it("should not add watch file w/ non-code file", () => {
            const outputs = createOutputs();
            const testObj = createTestObj(outputs);

            testObj.addInputFile("/project/data.json");

            expect(outputs.addWatchFile).not.toHaveBeenCalled();
        });
    });

    describe("addAssetDependency", () => {
        it("should add resolved child as watch file", () => {
            const outputs = createOutputs();
            const testObj = createTestObj(outputs);

            testObj.runAsAddon("probe", () => testObj.addAssetDependency("templates/t.html", "/project/src/main.ts"));

            expect(outputs.addWatchFile).toHaveBeenCalledWith("/project/templates/t.html", "addAssetDependency", "probe");
        });

        it("should report error w/ code file child", () => {
            const reporter = createReporter();
            const testObj = createTestObj(createOutputs(), reporter);

            testObj.addAssetDependency("/project/src/b.ts", "/project/src/main.ts");

            expect(errors(reporter)).toEqual([
                "Only non-code files are supported for addAssetDependency. .ts of /project/src/b.ts is a code file extension.",
            ]);
        });

        it("should not add watch file w/ code file child", () => {
            const outputs = createOutputs();
            const testObj = createTestObj(outputs);

            testObj.addAssetDependency("/project/src/b.ts", "/project/src/main.ts");

            expect(outputs.addWatchFile).not.toHaveBeenCalled();
        });
    });

    describe("addVirtualFile", () => {
        it("should add virtual file to outputs w/ running addon", () => {
            const outputs = createOutputs();
            const testObj = createTestObj(outputs);

            testObj.runAsAddon("probe", () => testObj.addVirtualFile("virtual.json", "{}"));

            expect(outputs.addVirtualFile).toHaveBeenCalledWith("virtual.json", "{}", "probe");
        });

        it("should add virtual file to outputs w/ unknown addon outside addon", () => {
            const outputs = createOutputs();
            const testObj = createTestObj(outputs);

            testObj.addVirtualFile("virtual.json", "{}");

            expect(outputs.addVirtualFile).toHaveBeenCalledWith("virtual.json", "{}", "unknown addon");
        });

        it("should not report error w/ non-code file", () => {
            const reporter = createReporter();
            const testObj = createTestObj(createOutputs(), reporter);

            testObj.addVirtualFile("virtual.json", "{}");

            expect(errors(reporter)).toEqual([]);
        });
    });

    describe("removeOutputFile", () => {
        it("should remove output file from outputs w/ running addon", () => {
            const outputs = createOutputs();
            const testObj = createTestObj(outputs);

            testObj.runAsAddon("probe", () => testObj.removeOutputFile("style.css"));

            expect(outputs.removeOutputFile).toHaveBeenCalledWith("style.css", "probe");
        });
    });

    describe("runAsAddon", () => {
        it("should restore previous addon after nested run", () => {
            const outputs = createOutputs();
            const testObj = createTestObj(outputs);

            testObj.runAsAddon("outer", () => {
                testObj.runAsAddon("inner", () => undefined);
                testObj.addVirtualFile("virtual.json", "{}");
            });

            expect(outputs.addVirtualFile).toHaveBeenCalledWith("virtual.json", "{}", "outer");
        });

        it("should return result of function", () => {
            const testObj = createTestObj();

            const actual = testObj.runAsAddon("probe", () => 42);

            expect(actual).toBe(42);
        });
    });
});
