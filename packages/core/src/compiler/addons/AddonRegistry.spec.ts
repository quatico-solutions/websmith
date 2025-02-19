/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { WarnMessage } from "@quatico/websmith-api";
import type ts from "typescript";
import { ReporterMock, compileSystem } from "../../../test";
import { AddonRegistry } from "./AddonRegistry";

let system: ts.System;
let reporter: ReporterMock;
beforeEach(() => {
    system = compileSystem({}, { addLibDefaults: false }).fileSystem;
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
});

describe("getAvailableAddons", () => {
    it("returns empty addons w/ empty addons directory", () => {
        const testObj = new AddonRegistry({ addonsDir: "./addons", reporter, system });

        expect(testObj.getAvailableAddons("*")).toHaveLength(0);
    });

    it("returns addons w/ single addon in addon directory", () => {
        createAddon("addons/expected/addon");

        const testObj = new AddonRegistry({ addonsDir: "./addons", reporter, system });

        expect(testObj.getAvailableAddons("*").getNames()).toEqual(["expected"]);
    });

    it("returns addons w/ multiple addons in addon directory", () => {
        createAddon("addons/one/addon");
        createAddon("addons/two/addon");
        createAddon("addons/three/addon");

        const testObj = new AddonRegistry({ addonsDir: "./addons", reporter, system });

        expect(testObj.getAvailableAddons("*").getNames()).toEqual(["one", "two", "three"]);
    });

    it("returns valid addons w/ invalid and valid addons in addon directory", () => {
        createAddon("addons/expected/addon");
        createAddon("addons/invalid/addon", "export const whatever = () => {};", { whatever: jest.fn() });

        const testObj = new AddonRegistry({ addonsDir: "./addons", reporter, system });

        expect(testObj.getAvailableAddons("*").getNames()).toEqual(["expected"]);
    });

    it("returns no addons w/ empty files in addon directory", () => {
        createAddon("addons/empty/addon", "", {});

        const testObj = new AddonRegistry({ addonsDir: "./addons", reporter, system });

        expect(testObj.getAvailableAddons("*")).toHaveLength(0);
    });

    it("reports warning w/ non-existing addons name", () => {
        system.createDirectory("./addons");
        reporter.reportDiagnostic = jest.fn();

        new AddonRegistry({
            addons: ["does-not-exist"],
            addonsDir: "./addons",
            reporter,
            system,
        }).getAvailableAddons("*");

        expect(reporter.reportDiagnostic).toHaveBeenCalledWith(new WarnMessage('Missing addons: "does-not-exist".'));
    });

    it("reports warning w/ profile config and non-existing addons name", () => {
        system.createDirectory("./addons");
        reporter.reportDiagnostic = jest.fn();

        new AddonRegistry({
            addonsDir: "./addons",
            profiles: { target: { addons: ["does-not-exist"] } },
            reporter,
            system,
        }).getAvailableAddons("target");

        expect(reporter.reportDiagnostic).toHaveBeenCalledWith(new WarnMessage('Missing addons for profile "target": "does-not-exist".'));
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

        expect(testObj.getAvailableAddons("*").getNames()).toEqual(["expected"]);

        createAddon("addons/new/addon");

        testObj.refresh();

        expect(testObj.getAvailableAddons("*").getNames()).toEqual(["expected", "new"]);
    });

    it("refreshes addons w/o new addons", () => {
        createAddon("addons/expected/addon");

        const testObj = new AddonRegistry({ addonsDir: "./addons", reporter, system });

        expect(testObj.getAvailableAddons("*").getNames()).toEqual(["expected"]);

        testObj.refresh();

        expect(testObj.getAvailableAddons("*").getNames()).toEqual(["expected"]);
    });

    it("refreshes addons w/ removed addons", () => {
        createAddon("addons/expected/addon");
        createAddon("addons/removed/addon");

        const testObj = new AddonRegistry({ addonsDir: "./addons", reporter, system });

        expect(testObj.getAvailableAddons("*").getNames()).toEqual(["expected", "removed"]);

        removeAddon("addons/removed/addon");

        testObj.refresh();

        expect(testObj.getAvailableAddons("*").getNames()).toEqual(["expected"]);
    });

    it("refreshes addons w/ empty addons directory", () => {
        createAddon("addons/expected/addon");

        const testObj = new AddonRegistry({ addonsDir: "./addons", reporter, system });

        expect(testObj.getAvailableAddons("*").getNames()).toEqual(["expected"]);

        removeAddon("addons/expected/addon");

        testObj.refresh();

        expect(testObj.getAvailableAddons("*")).toHaveLength(0);
    });
});

describe("getExpectedAddons", () => {
    it("returns empty w/o addons", () => {
        const testObj = new AddonRegistry({ addonsDir: "./empty", reporter, system });

        // @ts-expect-error private property access
        expect(testObj.getExpectedAddons()).toHaveLength(0);
    });

    it("returns addons w/ addons", () => {
        const testObj = new AddonRegistry({ addons: ["one", "two", "three"], addonsDir: "./empty", reporter, system });

        // @ts-expect-error private property access
        expect(testObj.getExpectedAddons()).toEqual(["one", "two", "three"]);
    });

    it("returns profile addons w/ profile name", () => {
        const testObj = new AddonRegistry({
            profiles: { target: { addons: ["one", "two", "three"] } },
            addonsDir: "./empty",
            reporter,
            system,
        });

        // @ts-expect-error private property access
        expect(testObj.getExpectedAddons("target")).toEqual(["one", "two", "three"]);
    });

    it("returns empty w/ profile name and no addons", () => {
        const testObj = new AddonRegistry({
            profiles: { target: { addons: [] } },
            addonsDir: "./empty",
            reporter,
            system,
        });

        // @ts-expect-error private property access
        expect(testObj.getExpectedAddons("target")).toHaveLength(0);
    });

    it("returns empty w/ profile and no profile name", () => {
        const testObj = new AddonRegistry({
            profiles: { target: { addons: ["one", "two", "three"] } },
            addonsDir: "./empty",
            reporter,
            system,
        });

        // @ts-expect-error private property access
        expect(testObj.getExpectedAddons()).toHaveLength(0);
    });
});

describe("getMissingAddons", () => {
    it("returns empty w/o addons", () => {
        const testObj = new AddonRegistry({ addonsDir: "./target", reporter, system });

        // @ts-expect-error private property access
        expect(testObj.getMissingAddons()).toHaveLength(0);
    });

    it("returns missing addons w/ missing addons", () => {
        const testObj = new AddonRegistry({ addons: ["missing"], addonsDir: "./target", reporter, system });

        // @ts-expect-error private property access
        expect(testObj.getMissingAddons()).toEqual(["missing"]);
    });

    it("returns missing addons w/ missing and available addons", () => {
        createAddon("target/expected/addon");

        const testObj = new AddonRegistry({ addons: ["missing", "expected"], addonsDir: "./target", reporter, system });

        // @ts-expect-error private property access
        expect(testObj.getMissingAddons()).toEqual(["missing"]);
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

    it("reports missing addons w/ missing addons", () => {
        system.createDirectory("./target");
        reporter.reportDiagnostic = jest.fn();

        new AddonRegistry({ addonsDir: "./target", addons: ["missing"], reporter, system }).getAvailableAddons("*");

        expect(reporter.reportDiagnostic).toHaveBeenCalledWith(new WarnMessage('Missing addons: "missing".'));
    });

    it("does not report missing addons w/o missing addons", () => {
        system.createDirectory("./target");
        createAddon("target/expected/addon");
        reporter.reportDiagnostic = jest.fn();

        new AddonRegistry({ addonsDir: "./target", addons: ["expected"], reporter, system }).getAvailableAddons("*");

        expect(reporter.reportDiagnostic).not.toHaveBeenCalled();
    });

    it("reports missing addons w/ missing profile addons", () => {
        system.createDirectory("./target");
        reporter.reportDiagnostic = jest.fn();

        new AddonRegistry({
            profiles: { target: { addons: ["missing"] } },
            addonsDir: "./target",
            reporter,
            system,
        }).getAvailableAddons("target");

        expect(reporter.reportDiagnostic).toHaveBeenCalledWith(new WarnMessage('Missing addons for profile "target": "missing".'));
    });

    it("does not report missing addons w/o missing profile addons", () => {
        system.createDirectory("./target");
        createAddon("target/expected/addon");
        reporter.reportDiagnostic = jest.fn();

        new AddonRegistry({
            profiles: { target: { addons: ["expected"] } },
            addonsDir: "./target",
            reporter,
            system,
        }).getAvailableAddons("target");

        expect(reporter.reportDiagnostic).not.toHaveBeenCalled();
    });
});

describe("findAddons", () => {
    it("finds addons w/ single addon in addons directory", () => {
        createAddon("addons/expected/addon");

        const testObj = new AddonRegistry({ addonsDir: "./addons", reporter, system });

        expect(testObj.getAvailableAddons("*").getNames()).toEqual(["expected"]);
    });

    it("finds addons w/ multiple addons in addons directory", () => {
        createAddon("addons/one/addon");
        createAddon("addons/two/addon");
        createAddon("addons/three/addon");

        const testObj = new AddonRegistry({ addonsDir: "./addons", reporter, system });

        expect(testObj.getAvailableAddons("*").getNames()).toEqual(["one", "two", "three"]);
    });

    it("finds valid addons w/ invalid and valid addons in addons directory", () => {
        createAddon("addons/expected/addon");
        createAddon("addons/invalid/addon", "export const whatever = () => {};", { whatever: jest.fn() });

        const testObj = new AddonRegistry({ addonsDir: "./addons", reporter, system });

        expect(testObj.getAvailableAddons("*").getNames()).toEqual(["expected"]);
    });

    it("finds no addons w/ empty files in addons directory", () => {
        createAddon("addons/empty/addon", "", {});

        const testObj = new AddonRegistry({ addonsDir: "./addons", reporter, system });

        expect(testObj.getAvailableAddons("*")).toHaveLength(0);
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
