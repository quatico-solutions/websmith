/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
/* eslint-disable jest/no-mocks-import */
import { WarnMessage } from "@quatico/websmith-api";
import ts from "typescript";
import { ReporterMock } from "../../../test";
import { createBrowserSystem } from "../../environment";
import { AddonRegistry } from "./AddonRegistry";

let system: ts.System;
let reporter: ReporterMock;
beforeEach(() => {
    system = createBrowserSystem({});
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

        // @ts-ignore private property access
        expect(testObj.addons).toEqual([]);
    });

    it("yields addons w/ addons property", () => {
        const testObj = new AddonRegistry({ addons: "zip,zap, zup" } as any);

        // @ts-ignore private property access
        expect(testObj.addons).toEqual(["zip", "zap", "zup"]);
    });
});

describe("getAddons", () => {
    it("returns empty addons w/ empty addons directory", () => {
        const testObj = new AddonRegistry({ addonsDir: "./addons", reporter, system });

        expect(testObj.getAddons()).toEqual([]);
    });

    it("returns addons w/ single addon in addon directory", () => {
        system.writeFile("./addons/expected/addon.ts", "export const activate = () => {};");
        jest.mock(
            "/addons/expected/addon",
            () => {
                return { activate: jest.fn() };
            },
            { virtual: true }
        );

        const testObj = new AddonRegistry({ addonsDir: "./addons", reporter, system });

        expect(testObj.getAddons().map(it => it.name)).toEqual(["expected"]);
    });

    it("returns addons w/ multiple addons in addon directory", () => {
        system.writeFile("./addons/one/addon.ts", "export const activate = () => {};");
        jest.mock(
            "/addons/one/addon",
            () => {
                return { activate: jest.fn() };
            },
            { virtual: true }
        );
        system.writeFile("./addons/two/addon.ts", "export const activate = () => {};");
        jest.mock(
            "/addons/two/addon",
            () => {
                return { activate: jest.fn() };
            },
            { virtual: true }
        );
        system.writeFile("./addons/three/addon.ts", "export const activate = () => {};");
        jest.mock(
            "/addons/three/addon",
            () => {
                return { activate: jest.fn() };
            },
            { virtual: true }
        );

        const testObj = new AddonRegistry({ addonsDir: "./addons", reporter, system });

        expect(testObj.getAddons().map(it => it.name)).toEqual(["one", "two", "three"]);
    });

    it("returns valid addons w/ invalid and valid addons in addon directory", () => {
        system.writeFile("./addons/expected/addon.ts", "export const activate = () => {};");
        jest.mock(
            "/addons/expected/addon",
            () => {
                return { activate: jest.fn() };
            },
            { virtual: true }
        );
        system.writeFile("./addons/invalid/addon.ts", "export const whatever = () => {};");
        jest.mock(
            "/addons/invalid/addon",
            () => {
                return { whatever: jest.fn() };
            },
            { virtual: true }
        );

        const testObj = new AddonRegistry({ addonsDir: "./addons", reporter, system });

        expect(testObj.getAddons().map(it => it.name)).toEqual(["expected"]);
    });

    it("returns no addons w/ empty files in addon directory", () => {
        system.writeFile("./addons/empty/addon.ts", "");
        jest.mock(
            "/addons/empty/addon",
            () => {
                return {};
            },
            { virtual: true }
        );

        const testObj = new AddonRegistry({ addonsDir: "./addons", reporter, system });

        expect(testObj.getAddons()).toEqual([]);
    });

    it("reports warning w/ non-existing addons name", () => {
        system.createDirectory("./addons");
        reporter.reportDiagnostic = jest.fn();

        new AddonRegistry({
            addonsDir: "./addons",
            config: { addons: ["does-not-exist"], configFilePath: "" },
            reporter,
            system,
        }).getAddons();

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
        }).getAddons("target");

        expect(reporter.reportDiagnostic).toHaveBeenCalledWith(new WarnMessage('Missing addons for target "target": "does-not-exist".'));
    });
});
