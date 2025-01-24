/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { compileSystem } from "../../../test";
import { NoReporter } from "../NoReporter";
import { resolveCompilationConfig } from "./resolve-compiler-config";

describe("resolveCompilationConfig", () => {
    it("should return undefined w/ empty path", () => {
        const { fileSystem: target } = compileSystem();

        const actual = resolveCompilationConfig("", new NoReporter(), target);

        expect(actual).toBeUndefined();
    });

    it("should return undefined w/ non-existing path", () => {
        const { fileSystem: target } = compileSystem();

        const actual = resolveCompilationConfig("/does-not-exists.json", new NoReporter(), target);

        expect(actual).toBeUndefined();
    });

    it("should return undefined w/ existing path but invalid config file", () => {
        const { fileSystem: target } = compileSystem({ "./invalid-config.json": "" });

        const actual = resolveCompilationConfig("./invalid-config.json", new NoReporter(), target);

        expect(actual).toBeUndefined();
    });

    it("should return defaults w/ existing path and empty config file", () => {
        const { fileSystem: target } = compileSystem({ "./empty-config.json": "{}" });

        const actual = resolveCompilationConfig("./empty-config.json", new NoReporter(), target);

        expect(actual).toEqual({});
    });
});
