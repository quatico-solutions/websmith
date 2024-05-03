/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { WarnMessage } from "@quatico/websmith-api";
import ts from "typescript";
import { ReporterMock, compileSystem } from "../../../test";
import { AddonRegistry } from "./AddonRegistry";

let system: ts.System;
let reporter: ReporterMock;
beforeEach(() => {
    system = compileSystem({}, { withDefaultFiles: false }).fileSystem;
    reporter = new ReporterMock(system);
});

describe("Ctor", () => {
    it("reports warning w/ non-existing addons directory", () => {
        reporter.reportDiagnostic = jest.fn();
        expect(system.directoryExists("./addons")).toBe(false);

        new AddonRegistry({ addonsDir: "./addons", reporter, system });

        expect(reporter.reportDiagnostic).toHaveBeenCalledWith(new WarnMessage('Addons directory "./addons" does not exist.'));
    });

    it("does not report warning w/ empty addons directory", () => {
        system.createDirectory("./addons");
        reporter.reportDiagnostic = jest.fn();

        new AddonRegistry({ addonsDir: "./addons", reporter, system });

        expect(reporter.reportDiagnostic).not.toHaveBeenCalled();
    });

    it("yields addons w/o addons property", () => {
        const testObj = new AddonRegistry({} as any);

        // @ts-expect-error private property access
        expect(testObj.addons).toEqual([]);
    });

    it("yields addons w/ addons property", () => {
        const testObj = new AddonRegistry({ addons: "zip,zap, zup" } as any);

        // @ts-expect-error private property access
        expect(testObj.addons).toEqual(["zip", "zap", "zup"]);
    });
});

describe("getAddons", () => {
    it("returns empty addons w/ empty addons directory", () => {
        const testObj = new AddonRegistry({ addonsDir: "./addons", reporter, system });

        expect(testObj.getAvailableAddons()).toHaveLength(0);
    });

    it("returns addons w/ single addon in addon directory", () => {
        createAddon("addons/expected/addon");

        const testObj = new AddonRegistry({ addonsDir: "./addons", reporter, system });

        expect(testObj.getAvailableAddons().getNames()).toEqual(["expected"]);
    });

    it("returns addons w/ multiple addons in addon directory", () => {
        createAddon("addons/one/addon");
        createAddon("addons/two/addon");
        createAddon("addons/three/addon");

        const testObj = new AddonRegistry({ addonsDir: "./addons", reporter, system });

        expect(testObj.getAvailableAddons().getNames()).toEqual(["one", "two", "three"]);
    });

    it("returns valid addons w/ invalid and valid addons in addon directory", () => {
        createAddon("addons/expected/addon");
        createAddon("addons/invalid/addon", "export const whatever = () => {};", { whatever: jest.fn() });

        const testObj = new AddonRegistry({ addonsDir: "./addons", reporter, system });

        expect(testObj.getAvailableAddons().getNames()).toEqual(["expected"]);
    });

    it("returns no addons w/ empty files in addon directory", () => {
        createAddon("addons/empty/addon", "", {});

        const testObj = new AddonRegistry({ addonsDir: "./addons", reporter, system });

        expect(testObj.getAvailableAddons()).toHaveLength(0);
    });

    it("reports warning w/ non-existing addons name", () => {
        system.createDirectory("./addons");
        reporter.reportDiagnostic = jest.fn();

        new AddonRegistry({
            addonsDir: "./addons",
            config: { addons: ["does-not-exist"], configFilePath: "" },
            reporter,
            system,
        }).getAvailableAddons();

        expect(reporter.reportDiagnostic).toHaveBeenCalledWith(new WarnMessage('Missing addons: "does-not-exist".'));
    });

    it("reports warning w/ target config and non-existing addons name", () => {
        system.createDirectory("./addons");
        reporter.reportDiagnostic = jest.fn();

        new AddonRegistry({
            addonsDir: "./addons",
            config: { targets: { target: { addons: ["does-not-exist"] } }, configFilePath: "" },
            reporter,
            system,
        }).getAvailableAddons("target");

        expect(reporter.reportDiagnostic).toHaveBeenCalledWith(new WarnMessage('Missing addons for target "target": "does-not-exist".'));
    });
});

describe("getAddonsDir", () => {
    it("returns addons directory with addonsDir config", () => {
        const testObj = new AddonRegistry({ addonsDir: "./addons", reporter, system });

        expect(testObj.getAddonsDir()).toEqual("./addons");
    });

    it("returns undefined w/o addons directory", () => {
        const testObj = new AddonRegistry({ reporter, system } as any);

        expect(testObj.getAddonsDir()).toBeUndefined();
    });
});

describe("refresh", () => {
    it("refreshes addons w/ new addons", () => {
        createAddon("addons/expected/addon");

        const testObj = new AddonRegistry({ addonsDir: "./addons", reporter, system });

        expect(testObj.getAvailableAddons().getNames()).toEqual(["expected"]);

        createAddon("addons/new/addon");

        testObj.refresh();

        expect(testObj.getAvailableAddons().getNames()).toEqual(["expected", "new"]);
    });

    it("refreshes addons w/o new addons", () => {
        createAddon("addons/expected/addon");

        const testObj = new AddonRegistry({ addonsDir: "./addons", reporter, system });

        expect(testObj.getAvailableAddons().getNames()).toEqual(["expected"]);

        testObj.refresh();

        expect(testObj.getAvailableAddons().getNames()).toEqual(["expected"]);
    });

    it("refreshes addons w/ removed addons", () => {
        createAddon("addons/expected/addon");
        createAddon("addons/removed/addon");

        const testObj = new AddonRegistry({ addonsDir: "./addons", reporter, system });

        expect(testObj.getAvailableAddons().getNames()).toEqual(["expected", "removed"]);

        removeAddon("addons/removed/addon");

        testObj.refresh();

        expect(testObj.getAvailableAddons().getNames()).toEqual(["expected"]);
    });

    it("refreshes addons w/ empty addons directory", () => {
        createAddon("addons/expected/addon");

        const testObj = new AddonRegistry({ addonsDir: "./addons", reporter, system });

        expect(testObj.getAvailableAddons().getNames()).toEqual(["expected"]);

        removeAddon("addons/expected/addon");

        testObj.refresh();

        expect(testObj.getAvailableAddons()).toHaveLength(0);
    });
});

describe("reportMissingAddons", () => {
    it("reports missing addons directory", () => {
        reporter.reportDiagnostic = jest.fn();

        const testObj = new AddonRegistry({ addonsDir: "./expected", reporter, system });

        // @ts-expect-error private property access
        testObj.reportMissingAddons(undefined, []);

        expect(reporter.reportDiagnostic).toHaveBeenCalledWith(new WarnMessage('Addons directory "./expected" does not exist.'));
    });

    it("reports missing addons w/ target", () => {
        system.createDirectory("./addons");
        reporter.reportDiagnostic = jest.fn();

        const testObj = new AddonRegistry({ addonsDir: "./addons", reporter, system });

        // @ts-expect-error private property access
        testObj.reportMissingAddons("my-target", ["missing"]);

        expect(reporter.reportDiagnostic).toHaveBeenCalledWith(new WarnMessage('Missing addons for target "my-target": "missing".'));
    });

    it("reports missing addons w/o target", () => {
        system.createDirectory("./addons");
        reporter.reportDiagnostic = jest.fn();

        const testObj = new AddonRegistry({ addonsDir: "./addons", reporter, system });

        // @ts-expect-error private property access
        testObj.reportMissingAddons(undefined, ["missing"]);

        expect(reporter.reportDiagnostic).toHaveBeenCalledWith(new WarnMessage('Missing addons: "missing".'));
    });

    it("does not report missing addons w/o missing addons", () => {
        system.createDirectory("./addons");
        reporter.reportDiagnostic = jest.fn();

        const testObj = new AddonRegistry({ addonsDir: "./addons", reporter, system });

        // @ts-expect-error private property access
        testObj.reportMissingAddons(undefined, []);

        expect(reporter.reportDiagnostic).not.toHaveBeenCalled();
    });
});

describe("findAddons", () => {
    it("finds addons w/ single addon in addons directory", () => {
        createAddon("addons/expected/addon");

        const testObj = new AddonRegistry({ addonsDir: "./addons", reporter, system });

        expect(testObj.getAvailableAddons().getNames()).toEqual(["expected"]);
    });

    it("finds addons w/ multiple addons in addons directory", () => {
        createAddon("addons/one/addon");
        createAddon("addons/two/addon");
        createAddon("addons/three/addon");

        const testObj = new AddonRegistry({ addonsDir: "./addons", reporter, system });

        expect(testObj.getAvailableAddons().getNames()).toEqual(["one", "two", "three"]);
    });

    it("finds valid addons w/ invalid and valid addons in addons directory", () => {
        createAddon("addons/expected/addon");
        createAddon("addons/invalid/addon", "export const whatever = () => {};", { whatever: jest.fn() });

        const testObj = new AddonRegistry({ addonsDir: "./addons", reporter, system });

        expect(testObj.getAvailableAddons().getNames()).toEqual(["expected"]);
    });

    it("finds no addons w/ empty files in addons directory", () => {
        createAddon("addons/empty/addon", "", {});

        const testObj = new AddonRegistry({ addonsDir: "./addons", reporter, system });

        expect(testObj.getAvailableAddons()).toHaveLength(0);
    });
});

const createAddon = (path: string, code = "export const activate = () => {};", mock: object = { activate: jest.fn() }) => {
    system.writeFile(`./${path}.js`, code);
    jest.mock(
        `/${path}`,
        () => {
            return mock;
        },
        { virtual: true }
    );
};

const removeAddon = (path: string) => {
    system.deleteFile!(`./${path}.js`);
};
