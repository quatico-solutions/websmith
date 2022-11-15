/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import ts from "typescript";
import { createBrowserSystem } from "../../environment";
import { NoReporter } from "../NoReporter";
import { resolveCompilationConfig } from "./resolve-compiler-config";

const testSystem = createBrowserSystem({}, ts.sys.useCaseSensitiveFileNames);

describe("resolveCompilationConfig", () => {
    it("should return undefined w/ empty path", () => {
        const actual = resolveCompilationConfig("", new NoReporter(), testSystem);

        expect(actual).toBeUndefined();
    });

    it("should return undefined w/ non-existing path", () => {
        const actual = resolveCompilationConfig("/does-not-exists.json", new NoReporter(), testSystem);

        expect(actual).toBeUndefined();
    });

    it("should return undefined w/ existing path but invalid config file", () => {
        testSystem.writeFile("./invalid-config.json", "");
        const actual = resolveCompilationConfig("./invalid-config.json", new NoReporter(), testSystem);

        expect(actual).toBeUndefined();
    });

    it("should return defaults w/ existing path and empty config file", () => {
        testSystem.writeFile("./empty-config.json", "{}");
        const actual = resolveCompilationConfig("./empty-config.json", new NoReporter(), testSystem);

        expect(actual).toEqual({
            configFilePath: "/empty-config.json",
        });
    });
});
