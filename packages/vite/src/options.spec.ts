/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import path from "node:path";
import { resolveViteOptions } from "./options";

const ROOT = path.resolve("/project/app");

describe("resolveViteOptions", () => {
    it("should return config file in root w/o config file", () => {
        const actual = resolveViteOptions({}, ROOT).loaderOptions.configFile;

        expect(actual).toBe(path.join(ROOT, "websmith.config.json"));
    });

    it("should return config file resolved against root w/ relative config file", () => {
        const actual = resolveViteOptions({ configFile: "./config/websmith.json" }, ROOT).loaderOptions.configFile;

        expect(actual).toBe(path.join(ROOT, "config", "websmith.json"));
    });

    it("should return tsconfig file resolved against root w/ relative tsconfig file", () => {
        const actual = resolveViteOptions({ tsConfigFile: "tsconfig.app.json" }, ROOT).loaderOptions.tsConfigFile;

        expect(actual).toBe(path.join(ROOT, "tsconfig.app.json"));
    });

    it("should keep config file w/ absolute config file", () => {
        const expected = path.resolve("/elsewhere/websmith.config.json");

        const actual = resolveViteOptions({ configFile: expected }, ROOT).loaderOptions.configFile;

        expect(actual).toBe(expected);
    });

    it("should leave tsconfig file unset w/o tsconfig file", () => {
        const actual = resolveViteOptions({}, ROOT).loaderOptions;

        expect(actual).not.toHaveProperty("tsConfigFile");
    });

    it("should pass compiler options through w/ compiler options", () => {
        const options = {
            config: { addonsDir: "./addons" },
            tsConfig: { strict: true },
            debug: true,
            transpileOnly: true,
            addonEmitOnly: true,
            profile: "app",
        };

        const actual = resolveViteOptions(options, ROOT).loaderOptions;

        expect(actual).toEqual({ ...options, configFile: path.join(ROOT, "websmith.config.json") });
    });

    it("should return default include and exclude w/o include and exclude", () => {
        const actual = resolveViteOptions({}, ROOT);

        expect([actual.include, actual.exclude]).toEqual([/\.(c|m)?tsx?$/, /node_modules/]);
    });

    it("should return given include and exclude w/ include and exclude", () => {
        const actual = resolveViteOptions({ include: "src/**/*.ts", exclude: ["src/legacy/**"] }, ROOT);

        expect([actual.include, actual.exclude]).toEqual(["src/**/*.ts", ["src/legacy/**"]]);
    });

    it("should not pass include and exclude to compiler options w/ include and exclude", () => {
        const actual = resolveViteOptions({ include: "src/**/*.ts", exclude: "src/legacy/**" }, ROOT).loaderOptions;

        expect(Object.keys(actual)).toEqual(["configFile"]);
    });
});
