/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { ErrorMessage } from "@quatico/websmith-api";
import { NoReporter } from "../NoReporter";
import { validateProfile } from "./resolve-profile";

describe("validateProfile", () => {
    it("should report nothing w/o profile name", () => {
        const targetFn = jest.spyOn(NoReporter.prototype, "reportDiagnostic");

        validateProfile(undefined, { profiles: { a: {} } }, "'/websmith.config.json'", new NoReporter());

        expect(targetFn).not.toHaveBeenCalled();
    });

    it("should report error w/ unknown profile name in config file", () => {
        const targetFn = jest.spyOn(NoReporter.prototype, "reportDiagnostic");

        validateProfile("missing", { profiles: { b: {}, a: {} } }, "'/websmith.config.json'", new NoReporter());
        const actual = targetFn.mock.calls;

        expect(actual).toEqual([
            [new ErrorMessage("Profile 'missing' is not configured in '/websmith.config.json'. Available profiles: b, a.")],
        ]);
    });

    it("should report error w/ unknown profile name and config file w/o profiles", () => {
        const targetFn = jest.spyOn(NoReporter.prototype, "reportDiagnostic");

        validateProfile("missing", {}, "'/websmith.config.json'", new NoReporter());
        const actual = targetFn.mock.calls;

        expect(actual).toEqual([
            [new ErrorMessage("Profile 'missing' is not configured in '/websmith.config.json'. Available profiles: none.")],
        ]);
    });

    it("should report error w/ profile name w/o location", () => {
        const targetFn = jest.spyOn(NoReporter.prototype, "reportDiagnostic");

        validateProfile("missing", {}, undefined, new NoReporter());
        const actual = targetFn.mock.calls;

        expect(actual).toEqual([[new ErrorMessage("Profile 'missing' is passed but no websmith.config.json was found.")]]);
    });

    it("should report error w/ unknown profile name in loader options", () => {
        const targetFn = jest.spyOn(NoReporter.prototype, "reportDiagnostic");

        validateProfile("missing", { profiles: { a: {} } }, "the loader options", new NoReporter());
        const actual = targetFn.mock.calls;

        expect(actual).toEqual([[new ErrorMessage("Profile 'missing' is not configured in the loader options. Available profiles: a.")]]);
    });

    it("should report error once w/ missing depends target two levels down", () => {
        const targetFn = jest.spyOn(NoReporter.prototype, "reportDiagnostic");

        validateProfile(
            "a",
            { profiles: { a: { depends: ["b", "c"] }, b: { depends: ["nope"] }, c: { depends: ["b", "nope"] } } },
            "'/websmith.config.json'",
            new NoReporter()
        );
        const actual = targetFn.mock.calls;

        expect(actual).toEqual([
            [new ErrorMessage("Unknown profile 'nope' in 'depends' of '/websmith.config.json'. Available profiles: a, b, c.")],
        ]);
    });

    it("should report nothing w/ known profile and known depends", () => {
        const targetFn = jest.spyOn(NoReporter.prototype, "reportDiagnostic");

        validateProfile("a", { profiles: { a: { depends: ["b"] }, b: {} } }, "'/websmith.config.json'", new NoReporter());

        expect(targetFn).not.toHaveBeenCalled();
    });
});
