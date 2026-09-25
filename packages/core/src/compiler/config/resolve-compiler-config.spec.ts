/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { ErrorMessage } from "@quatico/websmith-api";
import ts from "typescript";
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

    it("should report error w/ unknown esm runtime", () => {
        const targetFn = jest.spyOn(NoReporter.prototype, "reportDiagnostic");
        const target = createSystem(
            { "./target-config.json": JSON.stringify({ profiles: { client: { esm: { runtime: "deno" } } } }) },
            { virtual: true }
        );

        resolveCompilationConfig("./target-config.json", new NoReporter(), target);

        expect(targetFn).toHaveBeenCalledWith(
            new ErrorMessage(`Unknown 'esm.runtime' value 'deno' in profile 'client' of './target-config.json'. Expected "node" or "bundler".`)
        );
    });

    it("should report error w/ unknown esm check level", () => {
        const targetFn = jest.spyOn(NoReporter.prototype, "reportDiagnostic");
        const target = createSystem(
            { "./target-config.json": JSON.stringify({ profiles: { client: { esm: { runtime: "node", check: "fail" } } } }) },
            { virtual: true }
        );

        resolveCompilationConfig("./target-config.json", new NoReporter(), target);

        expect(targetFn).toHaveBeenCalledWith(
            new ErrorMessage(`Unknown 'esm.check' value 'fail' in profile 'client' of './target-config.json'. Expected "error", "warn" or "off".`)
        );
    });

    it("should report exactly one error w/ esm and CommonJS tsConfig module", () => {
        const targetFn = jest.spyOn(NoReporter.prototype, "reportDiagnostic");
        const target = createSystem(
            {
                "./target-config.json": JSON.stringify({
                    profiles: { client: { esm: { runtime: "node" }, tsConfig: { module: "CommonJS", outDir: "./dist" } } },
                }),
            },
            { virtual: true }
        );

        resolveCompilationConfig("./target-config.json", new NoReporter(), target);
        const actual = targetFn.mock.calls;

        expect(actual).toEqual([
            [
                new ErrorMessage(
                    `Profile 'client' of './target-config.json' sets 'esm', but its 'tsConfig.module' is 'CommonJS'. Use an ES module format such as "ESNext" or "NodeNext", or remove 'esm'.`
                ),
            ],
        ]);
    });

    it("should report error w/ esm and numeric CommonJS tsConfig module", () => {
        const targetFn = jest.spyOn(NoReporter.prototype, "reportDiagnostic");
        const target = createSystem(
            { "./target-config.json": JSON.stringify({ profiles: { client: { esm: { runtime: "bundler" }, tsConfig: { module: 1 } } } }) },
            { virtual: true }
        );

        resolveCompilationConfig("./target-config.json", new NoReporter(), target);

        expect(targetFn).toHaveBeenCalledWith(
            new ErrorMessage(
                `Profile 'client' of './target-config.json' sets 'esm', but its 'tsConfig.module' is '1'. Use an ES module format such as "ESNext" or "NodeNext", or remove 'esm'.`
            )
        );
    });

    it("should report missing esm runtime w/ esm true", () => {
        const targetFn = jest.spyOn(NoReporter.prototype, "reportDiagnostic");
        const target = createSystem({ "./target-config.json": JSON.stringify({ profiles: { client: { esm: true } } }) }, { virtual: true });

        resolveCompilationConfig("./target-config.json", new NoReporter(), target);
        const actual = targetFn.mock.calls;

        expect(actual).toEqual([
            [new ErrorMessage(`Missing 'esm.runtime' in profile 'client' of './target-config.json'. Expected "node" or "bundler".`)],
        ]);
    });

    it("should report error w/ non-string esm ignore entry", () => {
        const targetFn = jest.spyOn(NoReporter.prototype, "reportDiagnostic");
        const target = createSystem(
            { "./target-config.json": JSON.stringify({ profiles: { client: { esm: { runtime: "node", ignore: [1] } } } }) },
            { virtual: true }
        );

        resolveCompilationConfig("./target-config.json", new NoReporter(), target);
        const actual = targetFn.mock.calls;

        expect(actual).toEqual([
            [new ErrorMessage(`Invalid 'esm.ignore' in profile 'client' of './target-config.json'. Expected an array of glob pattern strings.`)],
        ]);
    });

    it("should report error w/ string esm ignore", () => {
        const targetFn = jest.spyOn(NoReporter.prototype, "reportDiagnostic");
        const target = createSystem(
            { "./target-config.json": JSON.stringify({ profiles: { client: { esm: { runtime: "node", ignore: "dist/*.js" } } } }) },
            { virtual: true }
        );

        resolveCompilationConfig("./target-config.json", new NoReporter(), target);
        const actual = targetFn.mock.calls;

        expect(actual).toEqual([
            [new ErrorMessage(`Invalid 'esm.ignore' in profile 'client' of './target-config.json'. Expected an array of glob pattern strings.`)],
        ]);
    });

    it("should report nothing w/ esm ignore of glob strings", () => {
        const targetFn = jest.spyOn(NoReporter.prototype, "reportDiagnostic");
        const target = createSystem(
            { "./target-config.json": JSON.stringify({ profiles: { client: { esm: { runtime: "node", ignore: ["dist/*.js"] } } } }) },
            { virtual: true }
        );

        resolveCompilationConfig("./target-config.json", new NoReporter(), target);
        const actual = targetFn.mock.calls;

        expect(actual).toEqual([]);
    });

    it("should report error w/ esm check off and CommonJS tsConfig module", () => {
        const targetFn = jest.spyOn(NoReporter.prototype, "reportDiagnostic");
        const target = createSystem(
            {
                "./target-config.json": JSON.stringify({
                    profiles: { client: { esm: { runtime: "node", check: "off" }, tsConfig: { module: "CommonJS" } } },
                }),
            },
            { virtual: true }
        );

        resolveCompilationConfig("./target-config.json", new NoReporter(), target);
        const actual = targetFn.mock.calls;

        expect(actual).toEqual([
            [
                new ErrorMessage(
                    `Profile 'client' of './target-config.json' sets 'esm', but its 'tsConfig.module' is 'CommonJS'. Use an ES module format such as "ESNext" or "NodeNext", or remove 'esm'.`
                ),
            ],
        ]);
    });

    it("should report nothing w/ esm and ES module tsConfig module", () => {
        const targetFn = jest.spyOn(NoReporter.prototype, "reportDiagnostic");
        const target = createSystem(
            {
                "./target-config.json": JSON.stringify({
                    profiles: { client: { esm: { runtime: "node", check: "warn" }, tsConfig: { module: "NodeNext" } } },
                }),
            },
            { virtual: true }
        );

        resolveCompilationConfig("./target-config.json", new NoReporter(), target);

        expect(targetFn).not.toHaveBeenCalled();
    });

    it.each([
        { key: "module", value: "NodeNext", expected: ts.ModuleKind.NodeNext },
        { key: "module", value: "Node16", expected: ts.ModuleKind.Node16 },
        { key: "module", value: "ESNext", expected: ts.ModuleKind.ESNext },
        { key: "module", value: "CommonJS", expected: ts.ModuleKind.CommonJS },
        { key: "moduleResolution", value: "NodeNext", expected: ts.ModuleResolutionKind.NodeNext },
        { key: "target", value: "ES2022", expected: ts.ScriptTarget.ES2022 },
    ])("should return enum value $expected w/ tsConfig $key $value in profile", ({ key, value, expected }) => {
        const target = createSystem(
            { "./target-config.json": JSON.stringify({ profiles: { client: { tsConfig: { [key]: value, outDir: "./dist" } } } }) },
            { virtual: true }
        );

        const actual = resolveCompilationConfig("./target-config.json", new NoReporter(), target).profiles?.client.tsConfig;

        expect(actual).toEqual({ [key]: expected, outDir: target.resolvePath("./dist") });
    });

    it("should report one error and drop the value w/ invalid tsConfig module in profile", () => {
        const targetFn = jest.spyOn(NoReporter.prototype, "reportDiagnostic");
        const target = createSystem(
            { "./target-config.json": JSON.stringify({ profiles: { client: { tsConfig: { module: "NodeLatest", target: "ES2022" } } } }) },
            { virtual: true }
        );

        const actual = resolveCompilationConfig("./target-config.json", new NoReporter(), target).profiles?.client.tsConfig;

        expect(actual).toEqual({ target: ts.ScriptTarget.ES2022 });
        expect(targetFn.mock.calls).toEqual([
            [
                new ErrorMessage(
                    `Invalid 'tsConfig.module' value 'NodeLatest' in profile 'client' of './target-config.json'. Argument for '--module' option must be: 'none', 'commonjs', 'amd', 'system', 'umd', 'es6', 'es2015', 'es2020', 'es2022', 'esnext', 'node16', 'nodenext', 'preserve'.`
                ),
            ],
        ]);
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
