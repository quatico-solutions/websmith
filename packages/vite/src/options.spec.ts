/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import path from "node:path";
import ts from "typescript";
import { createHookFilter, resolveViteOptions, selectProfile } from "./options";

const ROOT = path.resolve("/project/app");
const whatever = (): (() => boolean) => () => true;

describe("resolveViteOptions", () => {
    it("should return config file in root w/o config file", () => {
        const actual = resolveViteOptions({}, ROOT, "client", whatever).loaderOptions.configFile;

        expect(actual).toBe(path.join(ROOT, "websmith.config.json"));
    });

    it("should return config file resolved against root w/ relative config file", () => {
        const actual = resolveViteOptions({ configFile: "./config/websmith.json" }, ROOT, "client", whatever).loaderOptions.configFile;

        expect(actual).toBe(path.join(ROOT, "config", "websmith.json"));
    });

    it("should return tsconfig file resolved against root w/ relative tsconfig file", () => {
        const actual = resolveViteOptions({ tsConfigFile: "tsconfig.app.json" }, ROOT, "client", whatever).loaderOptions.tsConfigFile;

        expect(actual).toBe(path.join(ROOT, "tsconfig.app.json"));
    });

    it("should keep config file w/ absolute config file", () => {
        const expected = path.resolve("/elsewhere/websmith.config.json");

        const actual = resolveViteOptions({ configFile: expected }, ROOT, "client", whatever).loaderOptions.configFile;

        expect(actual).toBe(expected);
    });

    it("should leave tsconfig file unset w/o tsconfig file", () => {
        const actual = resolveViteOptions({}, ROOT, "client", whatever).loaderOptions;

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

        const actual = resolveViteOptions(options, ROOT, "client", whatever).loaderOptions;

        expect(actual).toEqual({ ...options, configFile: path.join(ROOT, "websmith.config.json") });
    });

    it("should create filter w/ default include and exclude w/o include and exclude", () => {
        const target = jest.fn();

        resolveViteOptions({}, ROOT, "client", target);

        expect(target).toHaveBeenCalledWith(/\.(c|m)?tsx?$/, /node_modules/, { resolve: ROOT });
    });

    it("should create filter w/ default include and exclude w/ null include and exclude", () => {
        const target = jest.fn();

        resolveViteOptions({ include: null, exclude: null }, ROOT, "client", target);

        expect(target).toHaveBeenCalledWith(/\.(c|m)?tsx?$/, /node_modules/, { resolve: ROOT });
    });

    it("should create filter resolving against root w/ relative include and exclude", () => {
        const target = jest.fn();

        resolveViteOptions({ include: "src/**/*.ts", exclude: ["src/legacy/**"] }, ROOT, "client", target);

        expect(target).toHaveBeenCalledWith("src/**/*.ts", ["src/legacy/**"], { resolve: ROOT });
    });

    it("should return created filter w/ include and exclude", () => {
        const expected = jest.fn();

        const actual = resolveViteOptions({ include: "src/**/*.ts" }, ROOT, "client", () => expected).filter;

        expect(actual).toBe(expected);
    });

    it("should not pass include and exclude to compiler options w/ include and exclude", () => {
        const actual = resolveViteOptions({ include: "src/**/*.ts", exclude: "src/legacy/**" }, ROOT, "client", whatever).loaderOptions;

        expect(Object.keys(actual)).toEqual(["configFile"]);
    });

    it("should pass selected profile w/ profile map naming environment", () => {
        const actual = resolveViteOptions({ profile: { client: "client", ssr: "server" } }, ROOT, "ssr", whatever).loaderOptions.profile;

        expect(actual).toBe("server");
    });

    it("should leave profile unset w/ profile map not naming environment", () => {
        const actual = resolveViteOptions({ profile: { client: "client" } }, ROOT, "ssr", whatever).loaderOptions;

        expect(actual).not.toHaveProperty("profile");
    });
});

describe("selectProfile", () => {
    it("should return string w/ string profile", () => {
        const actual = selectProfile("app", "ssr");

        expect(actual).toEqual({ profile: "app" });
    });

    it("should return profile of environment w/ map naming environment", () => {
        const actual = selectProfile({ client: "client", ssr: "server" }, "ssr");

        expect(actual).toEqual({ profile: "server" });
    });

    it("should return error naming environment and map keys w/ map not naming environment", () => {
        const actual = selectProfile({ client: "client", server: "server" }, "ssr").error;

        expect(actual && [actual.category, actual.messageText]).toEqual([
            ts.DiagnosticCategory.Error,
            "The websmith plugin's 'profile' map names no profile for the Vite environment 'ssr'. It names: client, server.",
        ]);
    });

    it("should return error naming none w/ empty map", () => {
        const actual = selectProfile({}, "client").error?.messageText;

        expect(actual).toBe("The websmith plugin's 'profile' map names no profile for the Vite environment 'client'. It names: none.");
    });

    it("should not select inherited key w/ map", () => {
        const actual = selectProfile({}, "toString").profile;

        expect(actual).toBeUndefined();
    });

    it("should return no profile w/o profile", () => {
        const actual = selectProfile(undefined, "client");

        expect(actual).toEqual({});
    });
});

describe("createHookFilter", () => {
    it("should return default include and exclude w/o include and exclude", () => {
        const actual = createHookFilter({});

        expect(actual).toEqual({ include: [/\.(c|m)?tsx?$/], exclude: [/node_modules/] });
    });

    it("should return default include and exclude w/ null include and exclude", () => {
        const actual = createHookFilter({ include: null, exclude: null });

        expect(actual).toEqual({ include: [/\.(c|m)?tsx?$/], exclude: [/node_modules/] });
    });

    it("should return regexp include and exclude w/ regexp include and exclude", () => {
        const actual = createHookFilter({ include: [/\.ts$/, /\.tsx$/], exclude: /legacy/ });

        expect(actual).toEqual({ include: [/\.ts$/, /\.tsx$/], exclude: [/legacy/] });
    });

    it("should return no include w/ string pattern in include", () => {
        const actual = createHookFilter({ include: [/\.tsx$/, "src/**/*.ts"] });

        expect(actual).not.toHaveProperty("include");
    });

    it("should return regexp exclude only w/ string pattern in exclude", () => {
        const actual = createHookFilter({ exclude: ["src/legacy/**", /generated/] });

        expect(actual.exclude).toEqual([/generated/]);
    });
});
