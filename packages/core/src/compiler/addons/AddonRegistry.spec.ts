/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { WarnMessage } from "@quatico/websmith-api";
import type ts from "typescript";
import { ReporterMock } from "../../../test";
import { compileSystem } from "../../testing";
import { AddonRegistry } from "./AddonRegistry";

beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
});

describe("Ctor", () => {
    it("reports warning w/ non-existing addons directory", () => {
        const system = compileSystem({ addLibDefaults: false }).fileSystem;
        const target = new ReporterMock(system);
        target.reportDiagnostic = jest.fn();
        expect(system.directoryExists("./addons")).toBe(false);

        new AddonRegistry({ addonsDir: "./addons", reporter: target, system });

        expect(target.reportDiagnostic).toHaveBeenCalledWith(new WarnMessage('Addons directory "./addons" does not exist.'));
    });

    it("does not report warning w/ empty addons directory", () => {
        const system = compileSystem({ addLibDefaults: false }).fileSystem;
        const target = new ReporterMock(system);
        system.createDirectory("./addons");
        target.reportDiagnostic = jest.fn();

        new AddonRegistry({ addonsDir: "./addons", reporter: target, system });

        expect(target.reportDiagnostic).not.toHaveBeenCalled();
    });

    it("logs warning with valid and invalid addons in addons directory", () => {
        const system = compileSystem({ addLibDefaults: false }).fileSystem;
        const target = new ReporterMock(system);
        createAddon("addons/expected/addon", system);
        createAddon("addons/invalid/addon", system, "export const whatever = () => {};", { whatever: jest.fn() });
        target.reportDiagnostic = jest.fn();

        new AddonRegistry({ addonsDir: "./addons", reporter: target, system });

        expect(target.reportDiagnostic).toHaveBeenCalledWith(
            expect.objectContaining({
                messageText: 'Addon "invalid" does not export an "activate" function and will be ignored',
            })
        );
    });
});

describe("getAvailableAddons", () => {
    it("returns empty addons w/ empty addons directory", () => {
        const system = compileSystem({ addLibDefaults: false }).fileSystem;
        const testObj = new AddonRegistry({ addonsDir: "./addons", reporter: new ReporterMock(system), system });

        const actual = testObj.getAvailableAddons();

        expect(actual).toHaveLength(0);
    });

    it("returns addons w/ single addon in addon directory", () => {
        const system = compileSystem({ addLibDefaults: false }).fileSystem;
        createAddon("addons/expected/addon", system);
        const testObj = new AddonRegistry({ addonsDir: "./addons", reporter: new ReporterMock(system), system });

        const actual = testObj.getAvailableAddons();

        expect(actual.getNames()).toEqual(["expected"]);
    });

    it("returns addons w/ multiple addons in addon directory", () => {
        const system = compileSystem({ addLibDefaults: false }).fileSystem;
        createAddon("addons/one/addon", system);
        createAddon("addons/two/addon", system);
        createAddon("addons/three/addon", system);
        const testObj = new AddonRegistry({ addonsDir: "./addons", reporter: new ReporterMock(system), system });

        const actual = testObj.getAvailableAddons();

        expect(actual.getNames()).toEqual(["one", "two", "three"]);
    });

    it("returns no addons w/ empty files in addon directory", () => {
        const system = compileSystem({ addLibDefaults: false }).fileSystem;
        const testObj = new AddonRegistry({ addonsDir: "./addons", reporter: new ReporterMock(system), system });

        const actual = testObj.getAvailableAddons();

        expect(actual).toHaveLength(0);
    });

    it("reports warning w/ non-existing addons name", () => {
        const system = compileSystem({ addLibDefaults: false }).fileSystem;
        const target = new ReporterMock(system);
        system.createDirectory("./addons");
        target.reportDiagnostic = jest.fn();

        new AddonRegistry({
            addons: ["does-not-exist"],
            addonsDir: "./addons",
            reporter: target,
            system,
        }).getAvailableAddons();

        expect(target.reportDiagnostic).toHaveBeenCalledWith(new WarnMessage('Missing addons: "does-not-exist".'));
    });

    it("reports warning w/ profile config and non-existing addons name", () => {
        const system = compileSystem({ addLibDefaults: false }).fileSystem;
        const target = new ReporterMock(system);
        system.createDirectory("./addons");
        target.reportDiagnostic = jest.fn();

        new AddonRegistry({
            addonsDir: "./addons",
            profiles: { target: { addons: ["does-not-exist"] } },
            reporter: target,
            system,
        }).getAvailableAddons("target");

        expect(target.reportDiagnostic).toHaveBeenCalledWith(new WarnMessage('Missing addons for profile "target": "does-not-exist".'));
    });
});

describe("getExpectedAddonsWithDependencies", () => {
    it("returns empty w/o addons", () => {
        const system = compileSystem({ addLibDefaults: false }).fileSystem;
        const testObj = new AddonRegistry({ addonsDir: "./empty", reporter: new ReporterMock(system), system });

        // @ts-expect-error private property access
        const actual = testObj.getExpectedAddonsWithDependencies();

        expect(actual).toHaveLength(0);
    });

    it("returns addons w/ addons", () => {
        const system = compileSystem({ addLibDefaults: false }).fileSystem;
        const testObj = new AddonRegistry({ addons: ["one", "two", "three"], addonsDir: "./empty", reporter: new ReporterMock(system), system });

        // @ts-expect-error private property access
        const actual = testObj.getExpectedAddonsWithDependencies();

        expect(actual).toEqual(["one", "two", "three"]);
    });

    it("returns profile addons w/ profile name", () => {
        const system = compileSystem({ addLibDefaults: false }).fileSystem;
        const testObj = new AddonRegistry({
            profiles: { target: { addons: ["one", "two", "three"] } },
            addonsDir: "./empty",
            reporter: new ReporterMock(system),
            system,
        });

        // @ts-expect-error private property access
        const actual = testObj.getExpectedAddonsWithDependencies("target");

        expect(actual).toEqual(["one", "two", "three"]);
    });

    it("returns empty w/ profile name and no addons", () => {
        const system = compileSystem({ addLibDefaults: false }).fileSystem;
        const testObj = new AddonRegistry({
            profiles: { target: { addons: [] } },
            addonsDir: "./empty",
            reporter: new ReporterMock(system),
            system,
        });

        // @ts-expect-error private property access
        const actual = testObj.getExpectedAddonsWithDependencies("target");

        expect(actual).toHaveLength(0);
    });

    it("returns empty w/ profile and no profile name", () => {
        const system = compileSystem({ addLibDefaults: false }).fileSystem;
        const testObj = new AddonRegistry({
            profiles: { target: { addons: ["one", "two", "three"] } },
            addonsDir: "./empty",
            reporter: new ReporterMock(system),
            system,
        });

        // @ts-expect-error private property access
        const actual = testObj.getExpectedAddonsWithDependencies();

        expect(actual).toHaveLength(0);
    });
});

describe("reportMissingAddons", () => {
    it("reports missing addons directory", () => {
        const system = compileSystem({ addLibDefaults: false }).fileSystem;
        const target = new ReporterMock(system);
        target.reportDiagnostic = jest.fn();
        const testObj = new AddonRegistry({ addonsDir: "./expected", reporter: target, system });

        // @ts-expect-error private property access
        testObj.reportMissingAddons(undefined);

        expect(target.reportDiagnostic).toHaveBeenCalledWith(new WarnMessage('Addons directory "./expected" does not exist.'));
    });

    it("reports missing addons w/ missing addons", () => {
        const system = compileSystem({ addLibDefaults: false }).fileSystem;
        const target = new ReporterMock(system);
        system.createDirectory("./target");
        target.reportDiagnostic = jest.fn();

        new AddonRegistry({ addonsDir: "./target", addons: ["missing"], reporter: target, system }).getAvailableAddons();

        expect(target.reportDiagnostic).toHaveBeenCalledWith(new WarnMessage('Missing addons: "missing".'));
    });

    it("does not report missing addons w/o missing addons", () => {
        const system = compileSystem({ addLibDefaults: false }).fileSystem;
        const target = new ReporterMock(system);
        system.createDirectory("./target");
        createAddon("target/expected/addon", system);
        target.reportDiagnostic = jest.fn();

        new AddonRegistry({ addonsDir: "./target", addons: ["expected"], reporter: target, system }).getAvailableAddons();

        expect(target.reportDiagnostic).not.toHaveBeenCalled();
    });

    it("reports missing addons w/ missing profile addons", () => {
        const system = compileSystem({ addLibDefaults: false }).fileSystem;
        const target = new ReporterMock(system);
        system.createDirectory("./target");
        target.reportDiagnostic = jest.fn();

        new AddonRegistry({
            profiles: { target: { addons: ["missing"] } },
            addonsDir: "./target",
            reporter: target,
            system,
        }).getAvailableAddons("target");

        expect(target.reportDiagnostic).toHaveBeenCalledWith(new WarnMessage('Missing addons for profile "target": "missing".'));
    });

    it("does not report missing addons w/o missing profile addons", () => {
        const system = compileSystem({ addLibDefaults: false }).fileSystem;
        const target = new ReporterMock(system);
        system.createDirectory("./target");
        createAddon("target/expected/addon", system);
        target.reportDiagnostic = jest.fn();

        new AddonRegistry({
            profiles: { target: { addons: ["expected"] } },
            addonsDir: "./target",
            reporter: target,
            system,
        }).getAvailableAddons("target");

        expect(target.reportDiagnostic).not.toHaveBeenCalled();
    });
});

describe("Addon loading rules", () => {
    describe("loadAddonsSync() - With profile 'target', no profile addons, no global addons - load all found addons", () => {
        it("loads all found addons when profile has no specific configuration", () => {
            const system = compileSystem({ addLibDefaults: false }).fileSystem;
            createAddon("addons/addon-one/addon", system);
            createAddon("addons/addon-two/addon", system);
            createAddon("addons/addon-three/addon", system);
            const testObj = new AddonRegistry({
                profiles: { target: {} },
                addonsDir: "./addons",
                reporter: new ReporterMock(system),
                system,
            });

            const actual = testObj.getAvailableAddons("target");

            expect(actual.getNames()).toEqual(["addon-one", "addon-two", "addon-three"]);
        });

        it("loads all found addons when profile exists but has no addons property", () => {
            const system = compileSystem({ addLibDefaults: false }).fileSystem;
            createAddon("addons/first/addon", system);
            createAddon("addons/second/addon", system);
            const testObj = new AddonRegistry({
                profiles: { target: {} },
                addonsDir: "./addons",
                reporter: new ReporterMock(system),
                system,
            });

            const actual = testObj.getAvailableAddons("target");

            expect(actual.getNames()).toEqual(["first", "second"]);
        });
    });

    describe("loadAddonsSync() - With profile 'target', no profile addons, but global addons defined - load global addons", () => {
        it("loads only global addons when profile has no addons but global addons are defined", () => {
            const system = compileSystem({ addLibDefaults: false }).fileSystem;
            createAddon("addons/global-one/addon", system);
            createAddon("addons/global-two/addon", system);
            createAddon("addons/unused-addon/addon", system);
            const testObj = new AddonRegistry({
                addons: ["global-one", "global-two"],
                profiles: { target: {} },
                addonsDir: "./addons",
                reporter: new ReporterMock(system),
                system,
            });

            const actual = testObj.getAvailableAddons("target");

            expect(actual.getNames()).toEqual(["global-one", "global-two"]);
        });

        it("loads global addons when profile exists without addons property", () => {
            const system = compileSystem({ addLibDefaults: false }).fileSystem;
            createAddon("addons/specified/addon", system);
            createAddon("addons/ignored/addon", system);
            const testObj = new AddonRegistry({
                addons: ["specified"],
                profiles: { target: {} },
                addonsDir: "./addons",
                reporter: new ReporterMock(system),
                system,
            });

            const actual = testObj.getAvailableAddons("target");

            expect(actual.getNames()).toEqual(["specified"]);
        });
    });

    describe("loadAddonsSync() - With profile 'target', profile addons, global addons - load both", () => {
        it("loads both global and profile addons when both are defined", () => {
            const system = compileSystem({ addLibDefaults: false }).fileSystem;
            createAddon("addons/global-addon/addon", system);
            createAddon("addons/profile-addon/addon", system);
            createAddon("addons/unused-addon/addon", system);
            const testObj = new AddonRegistry({
                addons: ["global-addon"],
                profiles: { target: { addons: ["profile-addon"] } },
                addonsDir: "./addons",
                reporter: new ReporterMock(system),
                system,
            });

            const actual = testObj.getAvailableAddons("target");

            expect(actual.getNames()).toEqual(["global-addon", "profile-addon"]);
        });

        it("combines multiple global and profile addons", () => {
            const system = compileSystem({ addLibDefaults: false }).fileSystem;
            createAddon("addons/global-one/addon", system);
            createAddon("addons/global-two/addon", system);
            createAddon("addons/profile-one/addon", system);
            createAddon("addons/profile-two/addon", system);
            createAddon("addons/not-used/addon", system);
            const testObj = new AddonRegistry({
                addons: ["global-one", "global-two"],
                profiles: { target: { addons: ["profile-one", "profile-two"] } },
                addonsDir: "./addons",
                reporter: new ReporterMock(system),
                system,
            });

            const actual = testObj.getAvailableAddons("target");

            expect(actual.getNames()).toEqual(["global-one", "global-two", "profile-one", "profile-two"]);
        });

        it("avoids duplicates when global and profile addons overlap", () => {
            const system = compileSystem({ addLibDefaults: false }).fileSystem;
            createAddon("addons/shared-addon/addon", system);
            createAddon("addons/global-only/addon", system);
            createAddon("addons/profile-only/addon", system);
            const testObj = new AddonRegistry({
                addons: ["shared-addon", "global-only"],
                profiles: { target: { addons: ["shared-addon", "profile-only"] } },
                addonsDir: "./addons",
                reporter: new ReporterMock(system),
                system,
            });

            const actual = testObj.getAvailableAddons("target");

            expect(actual.getNames()).toEqual(["shared-addon", "global-only", "profile-only"]);
        });
    });

    describe("loadAddonsSync() - With multiple profiles, all named addons are loaded", () => {
        it("loads addons from the specified profile only", () => {
            const system = compileSystem({ addLibDefaults: false }).fileSystem;
            createAddon("addons/dev-addon/addon", system);
            createAddon("addons/prod-addon/addon", system);
            createAddon("addons/test-addon/addon", system);
            const testObj = new AddonRegistry({
                profiles: {
                    dev: { addons: ["dev-addon"] },
                    prod: { addons: ["prod-addon"] },
                    test: { addons: ["test-addon"] },
                },
                addonsDir: "./addons",
                reporter: new ReporterMock(system),
                system,
            });

            const actual = testObj.getAvailableAddons("dev");

            expect(actual.getNames()).toEqual(["dev-addon"]);
        });

        it("combines global addons with each profile's specific addons", () => {
            const system = compileSystem({ addLibDefaults: false }).fileSystem;
            createAddon("addons/global-addon/addon", system);
            createAddon("addons/dev-addon/addon", system);
            createAddon("addons/prod-addon/addon", system);
            const testObj = new AddonRegistry({
                addons: ["global-addon"],
                profiles: {
                    dev: { addons: ["dev-addon"] },
                    prod: { addons: ["prod-addon"] },
                },
                addonsDir: "./addons",
                reporter: new ReporterMock(system),
                system,
            });

            const actual = testObj.getAvailableAddons("dev");

            expect(actual.getNames()).toEqual(["global-addon", "dev-addon"]);
        });

        it("handles profiles with empty addon arrays", () => {
            const system = compileSystem({ addLibDefaults: false }).fileSystem;
            createAddon("addons/global-addon/addon", system);
            createAddon("addons/dev-addon/addon", system);
            const testObj = new AddonRegistry({
                addons: ["global-addon"],
                profiles: {
                    dev: { addons: ["dev-addon"] },
                    empty: { addons: [] },
                },
                addonsDir: "./addons",
                reporter: new ReporterMock(system),
                system,
            });

            const actual = testObj.getAvailableAddons("empty");

            expect(actual.getNames()).toEqual(["global-addon"]);
        });
    });

    describe("loadAddonsSync() - Same source and binary addon rules apply with profiles", () => {
        it("loads binary addons with profile configuration", () => {
            const system = compileSystem({ addLibDefaults: false }).fileSystem;
            createAddon("addons/binary-addon/addon", system, "export const activate = () => {};", { activate: jest.fn() }, ".js");
            createAddon("addons/jsx-addon/addon", system, "export const activate = () => {};", { activate: jest.fn() }, ".jsx");
            const testObj = new AddonRegistry({
                profiles: { target: { addons: ["binary-addon", "jsx-addon"] } },
                addonsDir: "./addons",
                reporter: new ReporterMock(system),
                system,
            });

            const actual = testObj.getAvailableAddons("target");

            expect(actual.getNames()).toEqual(["binary-addon", "jsx-addon"]);
        });

        it("reports invalid binary addons with profile configuration", () => {
            const system = compileSystem({ addLibDefaults: false }).fileSystem;
            createAddon("addons/invalid-addon/addon", system, "export const notActivate = () => {};", { notActivate: jest.fn() });
            const target = new ReporterMock(system);
            target.reportDiagnostic = jest.fn();

            new AddonRegistry({
                profiles: { target: { addons: ["invalid-addon"] } },
                addonsDir: "./addons",
                reporter: target,
                system,
            }).getAvailableAddons("target");

            expect(target.reportDiagnostic).toHaveBeenCalledWith(
                expect.objectContaining({
                    messageText: 'Addon "invalid-addon" does not export an "activate" function and will be ignored',
                })
            );
        });
    });

    describe("loadAddonsSync() - Same missing addon reporting rules apply with profiles", () => {
        it("reports missing profile addons", () => {
            const system = compileSystem({ addLibDefaults: false }).fileSystem;
            const target = new ReporterMock(system);
            target.reportDiagnostic = jest.fn();

            new AddonRegistry({
                profiles: { target: { addons: ["missing-addon"] } },
                addonsDir: "./addons",
                reporter: target,
                system,
            }).getAvailableAddons("target");

            expect(target.reportDiagnostic).toHaveBeenCalledWith(new WarnMessage('Missing addons for profile "target": "missing-addon".'));
        });

        it("reports missing addons from both global and profile configurations", () => {
            const system = compileSystem({ addLibDefaults: false }).fileSystem;
            createAddon("addons/existing-global/addon", system);
            const target = new ReporterMock(system);
            target.reportDiagnostic = jest.fn();

            new AddonRegistry({
                addons: ["existing-global", "missing-global"],
                profiles: { target: { addons: ["missing-profile"] } },
                addonsDir: "./addons",
                reporter: target,
                system,
            }).getAvailableAddons("target");

            expect(target.reportDiagnostic).toHaveBeenCalledWith(new WarnMessage('Missing addons: "missing-global".'));
        });

        it("does not report missing addons when all profile addons are found", () => {
            const system = compileSystem({ addLibDefaults: false }).fileSystem;
            createAddon("addons/found-global/addon", system);
            createAddon("addons/found-profile/addon", system);
            const target = new ReporterMock(system);
            target.reportDiagnostic = jest.fn();

            new AddonRegistry({
                addons: ["found-global"],
                profiles: { target: { addons: ["found-profile"] } },
                addonsDir: "./addons",
                reporter: target,
                system,
            }).getAvailableAddons("target");

            expect(target.reportDiagnostic).not.toHaveBeenCalled();
        });

        it("reports missing addons for specific profile context", () => {
            const system = compileSystem({ addLibDefaults: false }).fileSystem;
            const target = new ReporterMock(system);
            target.reportDiagnostic = jest.fn();

            new AddonRegistry({
                profiles: {
                    dev: { addons: ["missing-dev"] },
                    prod: { addons: ["missing-prod"] },
                },
                addonsDir: "./addons",
                reporter: target,
                system,
            }).getAvailableAddons("dev");

            expect(target.reportDiagnostic).toHaveBeenCalledWith(new WarnMessage('Missing addons for profile "dev": "missing-dev".'));
        });

        it("handles multiple missing addons in profile", () => {
            const system = compileSystem({ addLibDefaults: false }).fileSystem;
            const target = new ReporterMock(system);
            target.reportDiagnostic = jest.fn();

            new AddonRegistry({
                profiles: { target: { addons: ["missing-one", "missing-two", "missing-three"] } },
                addonsDir: "./addons",
                reporter: target,
                system,
            }).getAvailableAddons("target");

            expect(target.reportDiagnostic).toHaveBeenCalledWith(
                new WarnMessage('Missing addons for profile "target": "missing-one, missing-two, missing-three".')
            );
        });
    });
});

const createAddon = (
    path: string,
    system: ts.System,
    code = "export const activate = () => {};",
    mock: object = { activate: jest.fn() },
    extension = ".js"
) => {
    system.writeFile(`./${path}${extension}`, code);
    jest.mock(
        `/${path}`,
        () => {
            return mock;
        },
        { virtual: true }
    );
};
