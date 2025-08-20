/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import type { LoaderOptions } from "@quatico/websmith-api";
import ts from "typescript";
import { createSystem } from "../../environment";
import { NoReporter } from "../NoReporter";
import { createOptions } from "./options";

describe("createOptions", () => {
    it("should return defaults w/o any param", () => {
        const actual = createOptions({});

        expect(actual).toEqual(
            expect.objectContaining({
                debug: false,
                watch: false,
            })
        );
    });

    it("should return debug and watch w/ flags set to true", () => {
        const actual = createOptions({ debug: true, watch: true });

        expect(actual).toEqual(
            expect.objectContaining({
                debug: true,
                watch: true,
            })
        );
    });

    it("should return project config w/ custom but empty tsconfig.json", () => {
        const target = createSystem({ "./expected/tsconfig.json": "{}" }, { virtual: true });

        const actual = createOptions({ project: "./expected/tsconfig.json" }, new NoReporter(), target).tsConfig;

        expect(actual).toEqual({
            allowJs: false,
            checkJs: false,
            configFilePath: "/expected/tsconfig.json",
            declaration: false,
            declarationMap: false,
            emitDecorationOnly: false,
            esModuleInterop: false,
            jsx: ts.JsxEmit.Preserve,
            noEmit: false,
            pretty: true,
            project: "./expected/tsconfig.json",
            removeComments: false,
            strict: false,
            target: ts.ScriptTarget.ES5,
        });
    });

    it("should return debug path w/ debug true", () => {
        const target = createSystem({}, { virtual: true });

        const actual = createOptions({ debug: true }, new NoReporter(), target);

        expect(actual).toEqual(expect.objectContaining({ debug: true }));
    });

    it("should return watch path w/ watch true", () => {
        const target = createSystem({}, { virtual: true });
        const actual = createOptions({ watch: true }, new NoReporter(), target);

        expect(actual).toEqual(expect.objectContaining({ watch: true }));
    });

    it("should return config w/ valid compiler config json", () => {
        const target = createSystem(
            { "websmith.config.json": '{ "profiles": { "whatever": { "addons": [ "one", "two", "three" ] } } }' },
            { virtual: true }
        );

        const actual = createOptions({ configFile: "./websmith.config.json" }, new NoReporter(), target).config;

        expect(actual).toEqual({
            profiles: { whatever: { addons: ["one", "two", "three"] } },
        });
    });

    it("should return config w/ valid addonsDir, addons in compiler config json", () => {
        const target = createSystem(
            {
                "./tsconfig.json": '{ "include": ["**/*.ts"] }',
                "/expected/one/addon.ts": "export const activate = () => {};",
                "websmith.config.json": '{ "addons":["one", "two"], "addonsDir":"./expected" }',
            },
            { virtual: true }
        );
        jest.mock(
            "/expected/one/addon",
            () => {
                return { activate: jest.fn() };
            },
            { virtual: true }
        );

        const actual = createOptions({ configFile: "./websmith.config.json", project: "./tsconfig.json" }, new NoReporter(), target);

        expect(actual).toMatchObject({
            buildDir: "/",
            config: {
                addons: ["one", "two"],
                addonsDir: "/expected",
            },
            tsConfig: {
                configFilePath: "/tsconfig.json",
            },

            cliArgs: {
                fileNames: ["/expected/one/addon.ts"],
                errors: [],
                options: {
                    configFilePath: "/tsconfig.json",
                },
                raw: {
                    include: ["**/*.ts"],
                },
            },
        });
    });

    describe("CompilerArguments translation", () => {
        it("should translate all WebsmithArguments properties", () => {
            const target = createSystem({}, { virtual: true });
            const websmithArgs = {
                addons: "addon1,addon2",
                addonsDir: "./custom-addons",
                configFile: "./websmith.config.json",
                debug: true,
                fileNames: "file1.ts,file2.ts",
                profile: "development",
                transpileOnly: true,
                tsConfigFile: "./tsconfig.json",
                watch: true,
            };

            const actual = createOptions(websmithArgs, new NoReporter(), target);

            expect(actual).toMatchObject({
                buildDir: "/",
                cliArgs: {
                    errors: [],
                    fileNames: ["/file1.ts", "/file2.ts"],
                    options: {
                        allowJs: false,
                        checkJs: false,
                        configFilePath: "/tsconfig.json",
                        declaration: false,
                        declarationMap: false,
                        emitDecorationOnly: false,
                        esModuleInterop: false,
                        jsx: ts.JsxEmit.Preserve,
                        listFiles: true,
                        noEmit: false,
                        pretty: true,
                        project: "./tsconfig.json",
                        removeComments: false,
                        strict: false,
                        target: ts.ScriptTarget.ES5,
                        watch: true,
                    },
                },
                config: {
                    transpileOnly: true,
                    addonsDir: "/custom-addons", // Paths get resolved to absolute
                    addons: ["addon1", "addon2"],
                },
                configFile: "/websmith.config.json", // Paths get resolved to absolute
                debug: true,
                profile: "development",
                reporter: expect.any(NoReporter),
                system: expect.any(Object),
                tsConfig: {
                    allowJs: false,
                    checkJs: false,
                    configFilePath: "/tsconfig.json",
                    declaration: false,
                    declarationMap: false,
                    emitDecorationOnly: false,
                    esModuleInterop: false,
                    jsx: ts.JsxEmit.Preserve,
                    listFiles: true,
                    noEmit: false,
                    pretty: true,
                    project: "./tsconfig.json",
                    removeComments: false,
                    strict: false,
                    target: ts.ScriptTarget.ES5,
                    watch: true,
                },
                tsConfigFile: "/tsconfig.json",
                watch: true,
            });
        });

        it("should translate TypeScript CLI arguments", () => {
            const target = createSystem({ "./tsconfig.json": "{}" }, { virtual: true });
            const tscArgs = {
                target: "es2020" as const,
                module: "esnext" as const,
                strict: true,
                declaration: true,
                sourceMap: true,
                outDir: "./dist",
                noEmit: false,
            };

            const actual = createOptions(tscArgs, new NoReporter(), target);

            expect(actual.tsConfig).toMatchObject({
                sourceMap: true,
            });
            // TSC args are handled through parsedCommandLine, so they appear in cliArgs
            expect(actual.cliArgs).toMatchObject({
                options: {
                    allowJs: false,
                    checkJs: false,
                    configFilePath: "/tsconfig.json",
                    declaration: true,
                    declarationMap: false,
                    emitDecorationOnly: false,
                    esModuleInterop: false,
                    jsx: ts.JsxEmit.Preserve,
                    module: ts.ModuleKind.ESNext,
                    noEmit: false,
                    outDir: "/dist",
                    pretty: true,
                    removeComments: false,
                    sourceMap: true,
                    strict: true,
                    target: ts.ScriptTarget.ES2020,
                },
            });
        });

        it("should translate LoaderOptions properties", () => {
            const target = createSystem({}, { virtual: true });
            const loaderArgs: LoaderOptions = {
                instanceName: "test-loader",
                profiles: {
                    dev: {
                        addons: ["test-addon"],
                        tsConfig: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS, strict: false, noEmit: false },
                    },
                },
                tsConfig: { strict: true, noEmit: true },
            };

            const actual = createOptions(loaderArgs, new NoReporter(), target);

            // Loader-specific properties are passed through the system
            expect(actual).toMatchObject({
                instanceName: "test-loader",
                profiles: {
                    dev: {
                        addons: ["test-addon"],
                        tsConfig: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS, strict: false, noEmit: false },
                    },
                },
                tsConfig: { strict: true, noEmit: true },
            });
        });

        it("should handle combined CompilerArguments with all types", () => {
            const target = createSystem({ "./tsconfig.json": "{}" }, { virtual: true });
            const combinedArgs = {
                // WebsmithArguments
                addons: "addon1,addon2,addon3",
                addonsDir: "./addons",
                debug: true,
                transpileOnly: false,
                watch: true,
                profile: "production",

                // TscCliArguments
                target: "es2021" as const,
                module: "commonjs" as const,
                strict: true,
                sourceMap: true,
                declaration: true,

                // LoaderOptions
                instanceName: "main-loader",
                profiles: { prod: { addons: ["prod-addon"] } },
            };

            const actual = createOptions(combinedArgs, new NoReporter(), target);

            // Check WebsmithArguments translation
            expect(actual.debug).toBe(true);
            expect(actual.watch).toBe(true);
            expect(actual.profile).toBe("production");
            expect(actual.config).toMatchObject({
                addonsDir: "/addons", // Paths get resolved to absolute
                addons: ["addon1", "addon2", "addon3"],
            });

            // Check TypeScript options are included
            expect(actual.tsConfig).toMatchObject({
                sourceMap: true,
            });

            // Check CLI args are processed
            expect(actual.cliArgs).toMatchObject({
                options: {
                    target: ts.ScriptTarget.ES2021,
                    module: ts.ModuleKind.CommonJS,
                    strict: true,
                    sourceMap: true,
                    declaration: true,
                },
            });
        });

        it("should handle missing optional properties gracefully", () => {
            const target = createSystem({}, { virtual: true });
            const minimalArgs = {};

            const actual = createOptions(minimalArgs, new NoReporter(), target);

            expect(actual).toMatchObject({
                buildDir: "/",
                cliArgs: {
                    errors: [],
                    fileNames: [],
                    options: {
                        allowJs: false,
                        checkJs: false,
                        configFilePath: "/tsconfig.json",
                        declaration: false,
                        declarationMap: false,
                        emitDecorationOnly: false,
                        esModuleInterop: false,
                        jsx: ts.JsxEmit.Preserve,
                        noEmit: false,
                        pretty: true,
                        removeComments: false,
                        strict: false,
                        target: ts.ScriptTarget.ES5,
                    },
                },
                config: {},
                debug: false,
                reporter: expect.any(NoReporter),
                system: expect.any(Object),
                tsConfig: {
                    allowJs: false,
                    checkJs: false,
                    configFilePath: "/tsconfig.json",
                    declaration: false,
                    declarationMap: false,
                    emitDecorationOnly: false,
                    esModuleInterop: false,
                    jsx: ts.JsxEmit.Preserve,
                    noEmit: false,
                    pretty: true,
                    removeComments: false,
                    strict: false,
                    target: ts.ScriptTarget.ES5,
                },
                tsConfigFile: "/tsconfig.json",
                watch: false,
            });
        });

        it("should properly split comma-separated addons", () => {
            const target = createSystem({}, { virtual: true });
            const args = {
                addons: "addon-one,addon-two,addon-three",
                addonsDir: "./my-addons",
            };

            const actual = createOptions(args, new NoReporter(), target);

            expect(actual.config?.addons).toEqual(["addon-one", "addon-two", "addon-three"]);
            expect(actual.config?.addonsDir).toBe("/my-addons"); // Paths get resolved to absolute
        });

        it("should handle empty addons string", () => {
            const target = createSystem({}, { virtual: true });
            const args = {
                addons: "",
                addonsDir: "./addons",
            };

            const actual = createOptions(args, new NoReporter(), target);

            expect(actual.config?.addons).toEqual([]); // Empty string results in empty array
            expect(actual.config?.addonsDir).toBe("/addons"); // Paths get resolved to absolute
        });

        it("should use default project path when not specified", () => {
            const target = createSystem({ "./tsconfig.json": "{}" }, { virtual: true });
            const args = {};

            const actual = createOptions(args, new NoReporter(), target);

            // Default project path should be used
            expect(actual.cliArgs).toMatchObject({
                options: {
                    allowJs: false,
                    checkJs: false,
                    configFilePath: "/tsconfig.json",
                    declaration: false,
                    declarationMap: false,
                    emitDecorationOnly: false,
                    esModuleInterop: false,
                    jsx: ts.JsxEmit.Preserve,
                    noEmit: false,
                    pretty: true,
                    removeComments: false,
                },
            });
        });

        it("should use custom project path when specified", () => {
            const target = createSystem({ "./custom/tsconfig.json": "{}" }, { virtual: true });
            const args = {
                project: "./custom/tsconfig.json",
            };

            const actual = createOptions(args, new NoReporter(), target);

            expect(actual.cliArgs).toMatchObject({
                options: {
                    allowJs: false,
                    checkJs: false,
                    configFilePath: "/custom/tsconfig.json",
                    declaration: false,
                    declarationMap: false,
                    emitDecorationOnly: false,
                    esModuleInterop: false,
                    jsx: ts.JsxEmit.Preserve,
                    noEmit: false,
                    pretty: true,
                    removeComments: false,
                },
            });
        });
    });

    describe("tsConfig options handling", () => {
        it("should handle tsConfig options from file", () => {
            const target = createSystem(
                {
                    "./tsconfig.json": JSON.stringify({
                        compilerOptions: {
                            target: "ES2020",
                            module: "ESNext",
                            strict: true,
                            declaration: true,
                            sourceMap: true,
                            outDir: "./dist",
                            baseUrl: "./src",
                            paths: {
                                "@/*": ["*"],
                            },
                        },
                    }),
                },
                { virtual: true }
            );

            const args = {
                project: "./tsconfig.json",
            };

            const actual = createOptions(args, new NoReporter(), target);

            // tsConfig from file should be loaded through cliArgs
            expect(actual.cliArgs).toBeDefined();
            expect(actual.cliArgs?.options).toMatchObject({
                target: ts.ScriptTarget.ES2020,
                module: ts.ModuleKind.ESNext,
                strict: true,
                declaration: true,
                sourceMap: true,
                outDir: "/dist",
                baseUrl: "/src",
            });
        });

        it("should handle tsConfig options passed directly as argument", () => {
            const target = createSystem({}, { virtual: true });
            const args = {
                tsConfig: {
                    strict: true,
                    noEmit: true,
                    skipLibCheck: true,
                },
            };

            const actual = createOptions(args, new NoReporter(), target);

            // Direct tsConfig should be merged into the final tsConfig
            expect(actual.tsConfig).toMatchObject({
                strict: true,
                noEmit: true,
                skipLibCheck: true,
            });
        });

        it("should merge tsConfig from file and direct argument", () => {
            const target = createSystem(
                {
                    "./tsconfig.json": JSON.stringify({
                        compilerOptions: {
                            target: "ES2019",
                            module: "CommonJS",
                            strict: false,
                            declaration: false,
                        },
                    }),
                },
                { virtual: true }
            );

            const args = {
                project: "./tsconfig.json",
                tsConfig: {
                    strict: true, // Override file setting
                    sourceMap: true, // Add new setting
                    skipLibCheck: true,
                },
            };

            const actual = createOptions(args, new NoReporter(), target);

            // File-based config should be in cliArgs
            expect(actual.cliArgs?.options).toMatchObject({
                target: ts.ScriptTarget.ES2019,
                module: ts.ModuleKind.CommonJS,
                strict: true, // Overridden by direct tsConfig through merged config
                declaration: false,
            });

            // Direct tsConfig should override/extend defaults
            expect(actual.tsConfig).toMatchObject({
                strict: true, // Overridden by direct tsConfig
                sourceMap: true,
                skipLibCheck: true,
            });
        });

        it("should handle sourceMap flag correctly", () => {
            const target = createSystem({}, { virtual: true });
            const args = {
                sourceMap: true,
            };

            const actual = createOptions(args, new NoReporter(), target);

            expect(actual.tsConfig).toMatchObject({
                sourceMap: true,
            });
        });

        it("should handle tsConfig from profile configuration", () => {
            const target = createSystem(
                {
                    "websmith.config.json": JSON.stringify({
                        profiles: {
                            development: {
                                tsConfig: {
                                    target: "ES2020",
                                    module: "ESNext",
                                    sourceMap: true,
                                    declaration: false,
                                },
                            },
                            production: {
                                tsConfig: {
                                    target: "ES2019",
                                    module: "CommonJS",
                                    sourceMap: false,
                                    declaration: true,
                                    minify: true,
                                },
                            },
                        },
                    }),
                },
                { virtual: true }
            );

            const args = {
                configFile: "./websmith.config.json",
                profile: "development",
            };

            const actual = createOptions(args, new NoReporter(), target);

            // Profile should be set
            expect(actual.profile).toBe("development");
            expect(actual.configFile).toBe("/websmith.config.json");

            // Config should include profile information
            expect(actual.config).toMatchObject({
                profiles: {
                    development: {
                        tsConfig: {
                            target: "ES2020",
                            module: "ESNext",
                            sourceMap: true,
                            declaration: false,
                        },
                    },
                    production: {
                        tsConfig: {
                            target: "ES2019",
                            module: "CommonJS",
                            sourceMap: false,
                            declaration: true,
                            minify: true,
                        },
                    },
                },
            });
        });

        it("should handle complex profile with addons and tsConfig", () => {
            const target = createSystem(
                {
                    "websmith.config.json": JSON.stringify({
                        profiles: {
                            "full-build": {
                                addons: ["transformer-addon", "generator-addon"],
                                addonsDir: "./build-addons",
                                tsConfig: {
                                    target: "ES2021",
                                    module: "ESNext",
                                    declaration: true,
                                    declarationMap: true,
                                    sourceMap: true,
                                    outDir: "./build/dist",
                                },
                            },
                        },
                    }),
                },
                { virtual: true }
            );

            const args = {
                configFile: "./websmith.config.json",
                profile: "full-build",
            };

            const actual = createOptions(args, new NoReporter(), target);

            expect(actual.profile).toBe("full-build");
            expect(actual.config).toMatchObject({
                profiles: {
                    "full-build": {
                        addons: ["transformer-addon", "generator-addon"],
                        addonsDir: "./build-addons",
                        tsConfig: {
                            target: "ES2021",
                            module: "ESNext",
                            declaration: true,
                            declarationMap: true,
                            sourceMap: true,
                            outDir: "/build/dist", // Paths get resolved to absolute
                        },
                    },
                },
            });
        });

        it("should prioritize direct tsConfig over profile tsConfig", () => {
            const target = createSystem(
                {
                    "websmith.config.json": JSON.stringify({
                        profiles: {
                            test: {
                                tsConfig: {
                                    target: "ES5",
                                    strict: false,
                                    sourceMap: false,
                                },
                            },
                        },
                    }),
                },
                { virtual: true }
            );

            const args = {
                configFile: "./websmith.config.json",
                profile: "test",
                tsConfig: {
                    strict: true, // Should override profile
                    declaration: true, // Should be added
                },
            };

            const actual = createOptions(args, new NoReporter(), target);

            // Direct tsConfig should take precedence
            expect(actual.tsConfig).toMatchObject({
                strict: true, // Overridden
                declaration: true, // Added
            });

            // Profile config should still be available
            expect(actual.config?.profiles?.test).toMatchObject({
                tsConfig: {
                    target: "ES5",
                    strict: false,
                    sourceMap: false,
                },
            });
        });

        it("should handle tsConfigFile parameter correctly", () => {
            const target = createSystem(
                {
                    "./custom-tsconfig.json": JSON.stringify({
                        compilerOptions: {
                            target: "ES2022",
                            module: "Node16",
                            moduleResolution: "Node16",
                            allowSyntheticDefaultImports: true,
                        },
                    }),
                },
                { virtual: true }
            );

            const args = {
                tsConfigFile: "./custom-tsconfig.json",
            };

            const actual = createOptions(args, new NoReporter(), target);

            // tsConfigFile should be used as project path
            expect(actual.cliArgs?.options).toMatchObject({
                target: ts.ScriptTarget.ES2022,
                allowSyntheticDefaultImports: true,
            });
        });

        it("should handle project argument correctly", () => {
            const target = createSystem(
                {
                    "./project-tsconfig.json": JSON.stringify({
                        compilerOptions: {
                            target: "ES2021",
                            strict: true,
                        },
                    }),
                },
                { virtual: true }
            );

            const args = {
                project: "./project-tsconfig.json",
            };

            const actual = createOptions(args, new NoReporter(), target);

            // project should be used for configuration
            expect(actual.cliArgs?.options).toMatchObject({
                target: ts.ScriptTarget.ES2021,
                strict: true,
            });
        });
    });
});
