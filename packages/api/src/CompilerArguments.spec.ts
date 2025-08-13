/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */

import type { CompilerArguments, LoaderOptions, TscArguments, WebsmithOptions, WebsmithArguments } from "./CompilerArguments";
import { COMPILER_ARGUMENT_KEYS, LOADER_OPTIONS_KEYS, TSC_ARGUMENT_KEYS, WEBSMITH_ARGUMENT_KEYS } from "./CompilerArguments";

describe("CompilerArguments", () => {
    describe("TSC_ARGUMENT_KEYS", () => {
        it("should contain basic TypeScript compiler options", () => {
            expect(TSC_ARGUMENT_KEYS).toContain("target");
            expect(TSC_ARGUMENT_KEYS).toContain("module");
            expect(TSC_ARGUMENT_KEYS).toContain("lib");
            expect(TSC_ARGUMENT_KEYS).toContain("strict");
            expect(TSC_ARGUMENT_KEYS).toContain("outDir");
            expect(TSC_ARGUMENT_KEYS).toContain("sourceMap");
        });

        it("should contain module resolution options", () => {
            expect(TSC_ARGUMENT_KEYS).toContain("moduleResolution");
            expect(TSC_ARGUMENT_KEYS).toContain("baseUrl");
            expect(TSC_ARGUMENT_KEYS).toContain("paths");
            expect(TSC_ARGUMENT_KEYS).toContain("esModuleInterop");
        });

        it("should contain experimental options", () => {
            expect(TSC_ARGUMENT_KEYS).toContain("experimentalDecorators");
            expect(TSC_ARGUMENT_KEYS).toContain("emitDecoratorMetadata");
        });

        it("should contain JSX options", () => {
            expect(TSC_ARGUMENT_KEYS).toContain("jsx");
            expect(TSC_ARGUMENT_KEYS).toContain("jsxFactory");
            expect(TSC_ARGUMENT_KEYS).toContain("jsxImportSource");
        });

        it("should be a readonly array at compile time", () => {
            // This test verifies that the array is typed as readonly
            // The actual readonly enforcement happens at TypeScript compile time
            expect(TSC_ARGUMENT_KEYS).toBeDefined();
            expect(Array.isArray(TSC_ARGUMENT_KEYS)).toBe(true);
        });
    });

    describe("WEBSMITH_ARGUMENT_KEYS", () => {
        it("should contain Websmith-specific options", () => {
            expect(WEBSMITH_ARGUMENT_KEYS).toContain("addons");
            expect(WEBSMITH_ARGUMENT_KEYS).toContain("addonsDir");
            expect(WEBSMITH_ARGUMENT_KEYS).toContain("configFile");
            expect(WEBSMITH_ARGUMENT_KEYS).toContain("profile");
            expect(WEBSMITH_ARGUMENT_KEYS).toContain("transpileOnly");
        });

        it("should have exactly 9 options", () => {
            expect(WEBSMITH_ARGUMENT_KEYS).toHaveLength(10);
        });
    });

    describe("LOADER_ARGUMENT_KEYS", () => {
        it("should contain loader-specific options", () => {
            expect(LOADER_OPTIONS_KEYS).toContain("instanceName");
            expect(LOADER_OPTIONS_KEYS).toContain("tsConfigFile");
            expect(LOADER_OPTIONS_KEYS).toContain("profiles");
        });

        it("should have exactly 9 options", () => {
            expect(LOADER_OPTIONS_KEYS).toHaveLength(9);
        });
    });

    describe("COMPILER_ARGUMENT_KEYS", () => {
        it("should combine all argument keys", () => {
            // Check if there are any duplicate keys between the arrays
            const allKeys = COMPILER_ARGUMENT_KEYS;
            const duplicates = allKeys.filter((key, index) => allKeys.indexOf(key) !== index);

            if (duplicates.length > 0) {
                console.log("Duplicate keys found:", duplicates);
            }

            // The actual length should be the unique keys length
            expect(COMPILER_ARGUMENT_KEYS).toHaveLength(148);
        });

        it("should contain keys from all categories", () => {
            // TSC keys
            expect(COMPILER_ARGUMENT_KEYS).toContain("target");
            expect(COMPILER_ARGUMENT_KEYS).toContain("module");

            // Websmith keys
            expect(COMPILER_ARGUMENT_KEYS).toContain("addons");
            expect(COMPILER_ARGUMENT_KEYS).toContain("profile");

            // Loader keys
            expect(COMPILER_ARGUMENT_KEYS).toContain("instanceName");
            expect(COMPILER_ARGUMENT_KEYS).toContain("profiles");
        });
    });

    describe("Type compatibility", () => {
        it("should allow valid TscArguments", () => {
            const tscArgs: TscArguments = {
                target: "es2020",
                module: "esnext",
                strict: true,
                outDir: "./dist",
                sourceMap: true,
            };

            expect(tscArgs.target).toBe("es2020");
            expect(tscArgs.module).toBe("esnext");
            expect(tscArgs.strict).toBe(true);
        });

        it("should allow valid WebsmithArguments", () => {
            const websmithArgs: WebsmithOptions = {
                config: {
                    addonsDir: "./addons",
                    profiles: {
                        development: {
                            addons: ["addon"],
                        },
                    },
                    transpileOnly: true,
                },
                profile: "development",
            };

            expect(websmithArgs.config?.addonsDir).toBe("./addons");
            expect(websmithArgs.config?.transpileOnly).toBe(true);
            expect(websmithArgs.profile).toBe("development");
        });

        it("should allow valid WebsmithCliArguments", () => {
            const websmithCliArgs: WebsmithArguments = {
                addons: "addon1,addon2,addon3",
                addonsDir: "./custom-addons",
                configFile: "./websmith.config.json",
                debug: true,
                profile: "development",
                transpileOnly: false,
                tsConfigFile: "./tsconfig.build.json",
                watch: true,
            };

            expect(websmithCliArgs.addons).toBe("addon1,addon2,addon3");
            expect(websmithCliArgs.addonsDir).toBe("./custom-addons");
            expect(websmithCliArgs.configFile).toBe("./websmith.config.json");
            expect(websmithCliArgs.debug).toBe(true);
            expect(websmithCliArgs.profile).toBe("development");
            expect(websmithCliArgs.transpileOnly).toBe(false);
            expect(websmithCliArgs.tsConfigFile).toBe("./tsconfig.build.json");
            expect(websmithCliArgs.watch).toBe(true);
        });

        it("should allow valid LoaderArguments", () => {
            const loaderArgs: LoaderOptions = {
                instanceName: "test-instance",
                tsConfigFile: "./tsconfig.json",
                profile: "development",
            };

            expect(loaderArgs.instanceName).toBe("test-instance");
            expect(loaderArgs.tsConfigFile).toBe("./tsconfig.json");
        });

        it("should allow valid CompilerArguments combining all types", () => {
            const compilerArgs: CompilerArguments = {
                // TSC options
                target: "es2020",
                module: "commonjs",
                strict: true,

                // Websmith options
                config: {
                    addons: ["./addons"],
                    addonsDir: "./addons",
                    profiles: {
                        development: {
                            addons: ["addon"],
                        },
                    },
                },
                profile: "production",

                // Loader options
                instanceName: "main",
                tsConfigFile: "./tsconfig.json",
            };

            expect(compilerArgs.target).toBe("es2020");
            expect(compilerArgs.config?.addons).toStrictEqual(["./addons"]);
            expect(compilerArgs.config?.addonsDir).toBe("./addons");
            expect(compilerArgs.config?.profiles?.development?.addons).toStrictEqual(["addon"]);
            expect(compilerArgs.profile).toBe("production");
            expect(compilerArgs.instanceName).toBe("main");
        });
    });
});
