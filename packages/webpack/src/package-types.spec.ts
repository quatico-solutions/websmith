/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { getRecordedPackageJsons, hasPackageTypeChanged, recordPackageTypes } from "./package-types";

describe("recordPackageTypes", () => {
    it("yields recorded package.json files w/ recorded package types", () => {
        const target: Record<string, unknown> = {};
        recordPackageTypes(target, { "/package.json": "module", "/lib/package.json": null });

        const actual = getRecordedPackageJsons(target);

        expect(actual).toEqual(["/package.json", "/lib/package.json"]);
    });

    it("records nothing w/o package types", () => {
        const target: Record<string, unknown> = {};

        recordPackageTypes(target, {});
        const actual = Object.keys(target);

        expect(actual).toEqual([]);
    });

    it("records package types as plain object", () => {
        const target: Record<string, unknown> = {};

        recordPackageTypes(target, { "/package.json": "module" });
        const actual = JSON.parse(JSON.stringify(target)) as unknown;

        expect(actual).toEqual(target);
    });
});

describe("getRecordedPackageJsons", () => {
    it("yields nothing w/o record", () => {
        const actual = getRecordedPackageJsons({});

        expect(actual).toEqual([]);
    });

    it("yields nothing w/o build info", () => {
        const actual = getRecordedPackageJsons(undefined);

        expect(actual).toEqual([]);
    });
});

describe("hasPackageTypeChanged", () => {
    it("yields true w/ changed type", () => {
        const buildInfo: Record<string, unknown> = {};
        recordPackageTypes(buildInfo, { "/package.json": "module" });

        const actual = hasPackageTypeChanged(buildInfo, () => "commonjs");

        expect(actual).toBe(true);
    });

    it("yields true w/ removed type", () => {
        const buildInfo: Record<string, unknown> = {};
        recordPackageTypes(buildInfo, { "/package.json": "module" });

        const actual = hasPackageTypeChanged(buildInfo, () => null);

        expect(actual).toBe(true);
    });

    it("yields false w/ same type", () => {
        const buildInfo: Record<string, unknown> = {};
        recordPackageTypes(buildInfo, { "/package.json": "module" });

        const actual = hasPackageTypeChanged(buildInfo, () => "module");

        expect(actual).toBe(false);
    });

    it("yields false w/o record", () => {
        const actual = hasPackageTypeChanged({}, () => "module");

        expect(actual).toBe(false);
    });

    it("yields false w/ recorded null and current null", () => {
        const buildInfo: Record<string, unknown> = {};
        recordPackageTypes(buildInfo, { "/package.json": null });

        const actual = hasPackageTypeChanged(buildInfo, () => null);

        expect(actual).toBe(false);
    });

    it("reads recorded package.json files", () => {
        const buildInfo: Record<string, unknown> = {};
        recordPackageTypes(buildInfo, { "/package.json": "module" });
        const target = jest.fn().mockReturnValue("module");

        hasPackageTypeChanged(buildInfo, target);

        expect(target).toHaveBeenCalledWith("/package.json");
    });
});
