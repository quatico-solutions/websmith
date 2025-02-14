/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { ErrorMessage } from "@quatico/websmith-api";
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
        const { fileSystem: target } = compileSystem({ "./empty-config.json": JSON.stringify({}) });

        const actual = resolveCompilationConfig("./empty-config.json", new NoReporter(), target);

        expect(actual).toEqual({});
    });

    it("should return config properties w/ existing path and full config", () => {
        const { fileSystem: target } = compileSystem({
            "./target-config.json": JSON.stringify({
                addons: ["addon1", "addon2"],
                addonsDir: "./addons",
                profiles: {
                    profile1: {
                        addons: ["other-addon"],
                        tsConfig: {
                            outDir: "./dist",
                        },
                    },
                },
                transpileOnly: true,
            }),
        });

        const actual = resolveCompilationConfig("./target-config.json", new NoReporter(), target);

        expect(actual).toEqual({
            addons: ["addon1", "addon2"],
            addonsDir: "/addons",
            profiles: {
                profile1: {
                    addons: ["other-addon", "addon1", "addon2"],
                    tsConfig: {
                        outDir: "/dist",
                    },
                },
            },
            transpileOnly: true,
        });
    });

    it("should throw error w/ non-existing profile dependencies", () => {
        const targetFn = jest.spyOn(NoReporter.prototype, "reportDiagnostic");

        const { fileSystem } = compileSystem({
            "./target-config.json": JSON.stringify({
                profiles: {
                    profile1: {
                        depends: ["unknown-profile"],
                    },
                },
            }),
        });

        resolveCompilationConfig("./target-config.json", new NoReporter(), fileSystem);

        expect(targetFn).toHaveBeenCalledWith(new ErrorMessage("Unknown profile 'unknown-profile' in 'depends' of './target-config.json'."));
    });

    it("should throw error w/ existing and non-existing profile dependencies", () => {
        const targetFn = jest.spyOn(NoReporter.prototype, "reportDiagnostic");

        const { fileSystem } = compileSystem({
            "./target-config.json": JSON.stringify({
                profiles: {
                    profile1: {
                        depends: ["unknown-profile", "profile2"],
                        tsConfig: {
                            outDir: "./dist",
                        },
                    },
                    profile2: {
                        tsConfig: {
                            outDir: "./dist",
                        },
                    },
                },
            }),
        });

        resolveCompilationConfig("./target-config.json", new NoReporter(), fileSystem);

        expect(targetFn).toHaveBeenCalledWith(new ErrorMessage("Unknown profile 'unknown-profile' in 'depends' of './target-config.json'."));
    });
});
