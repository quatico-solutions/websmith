/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */

import type { TsConfigOptions, TsConfigCompilerOptions, TsConfigOptionKey, CompilerOptionKey } from "./TsConfigOptions";
import { WatchFileKind, WatchDirectoryKind } from "./TsConfigOptions";

describe("TsConfigOptions", () => {
    it("should allow valid tsconfig.json structure", () => {
        const validTsConfig: TsConfigOptions = {
            compilerOptions: {
                target: "ES2020",
                module: "ESNext",
                strict: true,
                esModuleInterop: true,
                skipLibCheck: true,
                forceConsistentCasingInFileNames: true,
                declaration: true,
                declarationMap: true,
                sourceMap: true,
                outDir: "./dist",
                rootDir: "./src",
                baseUrl: "./",
                paths: {
                    "@/*": ["src/*"],
                },
                lib: ["ES2020", "DOM"],
                types: ["node", "jest"],
                plugins: [
                    {
                        name: "typescript-plugin-css-modules",
                    },
                ],
            },
            include: ["src/**/*"],
            exclude: ["node_modules", "dist"],
            files: ["src/index.ts"],
            extends: "./tsconfig.base.json",
            references: [
                {
                    path: "./packages/core",
                },
            ],
            typeAcquisition: {
                enable: true,
                include: ["lodash"],
                exclude: ["jquery"],
            },
            watchOptions: {
                watchFile: WatchFileKind.UseFsEvents,
                watchDirectory: WatchDirectoryKind.UseFsEvents,
                excludeDirectories: ["node_modules"],
            },
            compileOnSave: true,
            "ts-node": {
                transpileOnly: true,
                compilerOptions: {
                    module: "CommonJS",
                },
            },
        };

        expect(validTsConfig).toBeDefined();
        expect(validTsConfig.compilerOptions?.target).toBe("ES2020");
        expect(validTsConfig.include).toEqual(["src/**/*"]);
    });

    it("should allow compiler options to extend TypeScript's built-in options", () => {
        const compilerOptions: TsConfigCompilerOptions = {
            target: "ES2020",
            module: "ESNext",
            strict: true,
            // Additional options not in base ts.CompilerOptions
            plugins: [
                {
                    name: "my-plugin",
                    option1: "value1",
                },
            ],
            jsxFactory: "React.createElement",
            jsxFragmentFactory: "React.Fragment",
            jsxImportSource: "react",
        };

        expect(compilerOptions).toBeDefined();
        expect(compilerOptions.plugins).toHaveLength(1);
        expect(compilerOptions.jsxFactory).toBe("React.createElement");
    });

    it("should provide correct type keys", () => {
        // Test that the key types are working
        const compilerOptionKey: CompilerOptionKey = "target";
        const tsConfigKey: TsConfigOptionKey = "compilerOptions";

        expect(compilerOptionKey).toBe("target");
        expect(tsConfigKey).toBe("compilerOptions");
    });

    it("should allow empty tsconfig", () => {
        const emptyTsConfig: TsConfigOptions = {};

        expect(emptyTsConfig).toBeDefined();
    });

    it("should allow minimal tsconfig with just compilerOptions", () => {
        const minimalTsConfig: TsConfigOptions = {
            compilerOptions: {
                target: "ES5",
            },
        };

        expect(minimalTsConfig.compilerOptions?.target).toBe("ES5");
    });
});
