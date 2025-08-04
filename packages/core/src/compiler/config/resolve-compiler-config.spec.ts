/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { ErrorMessage } from "@quatico/websmith-api";
import { createSystem } from "../../environment";
import { NoReporter } from "../NoReporter";
import { resolveCompilationConfig, resolvePath } from "./resolve-compiler-config";

describe("resolveCompilationConfig", () => {
    it("should return undefined w/ empty path", () => {
        const target = createSystem({}, { virtual: true });

        const actual = resolveCompilationConfig("", new NoReporter(), target);

        expect(actual).toEqual({});
    });

    it("should return undefined w/ non-existing path", () => {
        const target = createSystem({}, { virtual: true });

        const actual = resolveCompilationConfig("/does-not-exists.json", new NoReporter(), target);

        expect(actual).toEqual({});
    });

    it("should return undefined w/ existing path but invalid config file", () => {
        const target = createSystem({ "./invalid-config.json": "" }, { virtual: true });

        const actual = resolveCompilationConfig("./invalid-config.json", new NoReporter(), target);

        expect(actual).toEqual({});
    });

    it("should return defaults w/ existing path and empty config file", () => {
        const target = createSystem({ "./empty-config.json": JSON.stringify({}) }, { virtual: true });

        const actual = resolveCompilationConfig("./empty-config.json", new NoReporter(), target);

        expect(actual).toEqual({});
    });

    it("should return config properties w/ existing path and full config", () => {
        const target = createSystem(
            {
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
            },
            { virtual: true }
        );

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

        const target = createSystem(
            {
                "./target-config.json": JSON.stringify({
                    profiles: {
                        profile1: {
                            depends: ["unknown-profile"],
                        },
                    },
                }),
            },
            { virtual: true }
        );

        resolveCompilationConfig("./target-config.json", new NoReporter(), target);

        expect(targetFn).toHaveBeenCalledWith(new ErrorMessage("Unknown profile 'unknown-profile' in 'depends' of './target-config.json'."));
    });

    it("should throw error w/ existing and non-existing profile dependencies", () => {
        const targetFn = jest.spyOn(NoReporter.prototype, "reportDiagnostic");

        const target = createSystem(
            {
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
            },
            { virtual: true }
        );

        resolveCompilationConfig("./target-config.json", new NoReporter(), target);

        expect(targetFn).toHaveBeenCalledWith(new ErrorMessage("Unknown profile 'unknown-profile' in 'depends' of './target-config.json'."));
    });
});

describe("resolvePath", () => {
    const fileSystem = createSystem({}, { virtual: true });

    it("returns valid path relative to basePath", () => {
        const actual = resolvePath(fileSystem, "./", "./src");

        expect(actual).toEqual("/src");
    });

    it("returns valid path additional basePath and relative path", () => {
        const actual = resolvePath(fileSystem, "./target", "./src");

        expect(actual).toEqual("/target/src");
    });

    it("returns valid path with absolute path and absolute path", () => {
        const actual = resolvePath(fileSystem, "/target", "/src");

        expect(actual).toEqual("/src");
    });

    it("returns valid path with absolute path", () => {
        const actual = resolvePath(fileSystem, "/target");

        expect(actual).toEqual("/target");
    });

    it("returns valid path with absolute path and overlapping relative path", () => {
        const actual = resolvePath(fileSystem, "/target/src", "./src");

        expect(actual).toEqual("/target/src");
    });

    it("returns valid path with relative path and overlapping relative path", () => {
        const actual = resolvePath(fileSystem, "./target/src", "./src");

        expect(actual).toEqual("/target/src");
    });

    it("returns valid path with relative path and multiple overlapping segments", () => {
        const actual = resolvePath(fileSystem, "./target/expected/src", "./expected/src");

        expect(actual).toEqual("/target/expected/src");
    });

    it("returns valid path with relative path and multiple overlapping filepath segments", () => {
        const actual = resolvePath(fileSystem, "./target/expected/src", "./expected/src/target/index.ts");

        expect(actual).toEqual("/target/expected/src/target/index.ts");
    });

    it("returns valid path with relative path and overlapping file path", () => {
        const actual = resolvePath(fileSystem, "./target/src", "./src/index.ts");

        expect(actual).toEqual("/target/src/index.ts");
    });
});
