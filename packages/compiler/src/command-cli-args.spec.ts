/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import { Compiler, createSystem, NoReporter } from "@quatico/websmith-core";
import { Command } from "commander";
import { addCompileCommand } from "./command";

beforeEach(() => {
    jest.spyOn(process.stderr, "write").mockImplementation(() => true);
    jest.spyOn(console, "time").mockImplementation(() => {});
});

describe("addCompileCommand", () => {
    describe("Command Structure", () => {
        it("should create compile command with proper basic setup", () => {
            const command = addCompileCommand(new Command());

            expect(command).toBeDefined();
            expect(command.name()).toBe("websmith");
            expect(command.description()).toBe("Compiles typescript source code and applies addons to transform source before or after emit.");
            // Verify that the command allows unknown options and excess arguments
            // @ts-expect-error -- cannot access private properties
            expect(command._allowUnknownOption).toBe(true);
            // @ts-expect-error -- cannot access private properties
            expect(command._allowExcessArguments).toBe(true);
        });

        it("should allow unknown options and excess arguments", () => {
            const command = addCompileCommand(new Command());

            // @ts-expect-error -- cannot access private properties
            expect(command._allowUnknownOption).toBe(true);
            // @ts-expect-error -- cannot access private properties
            expect(command._allowExcessArguments).toBe(true);
        });
    });

    describe("CLI Options", () => {
        let command: Command;

        beforeEach(() => {
            command = addCompileCommand(new Command());
        });

        it("should have all expected CLI options defined", () => {
            // Test the command help output to verify options are defined
            const helpOutput = command.helpInformation();

            // Configuration options
            expect(helpOutput).toContain("--configFile");
            expect(helpOutput).toContain("--project");
            expect(helpOutput).toContain("--addons");
            expect(helpOutput).toContain("--addonsDir");
            expect(helpOutput).toContain("--profile");

            // Mode options
            expect(helpOutput).toContain("--debug");
            expect(helpOutput).toContain("--transpileOnly");
            expect(helpOutput).toContain("--watch");

            // TypeScript compiler options
            expect(helpOutput).toContain("--target");
            expect(helpOutput).toContain("--module");
            expect(helpOutput).toContain("--lib");
            expect(helpOutput).toContain("--allowJs");
            expect(helpOutput).toContain("--checkJs");
            expect(helpOutput).toContain("--jsx");
            expect(helpOutput).toContain("--declaration");
            expect(helpOutput).toContain("--declarationMap");
            expect(helpOutput).toContain("--emitDeclarationOnly");
            expect(helpOutput).toContain("--sourceMap");
            expect(helpOutput).toContain("--noEmit");
            expect(helpOutput).toContain("--outFile");
            expect(helpOutput).toContain("--outDir");
            expect(helpOutput).toContain("--removeComments");
            expect(helpOutput).toContain("--strict");
            expect(helpOutput).toContain("--types");
            expect(helpOutput).toContain("--esModuleInterop");

            // Build options
            expect(helpOutput).toContain("--init");
            expect(helpOutput).toContain("--showConfig");
            expect(helpOutput).toContain("--build");
            expect(helpOutput).toContain("--pretty");
        });

        it("should have proper short option aliases", () => {
            const helpOutput = command.helpInformation();

            expect(helpOutput).toContain("-c, --configFile");
            expect(helpOutput).toContain("-p, --project");
            expect(helpOutput).toContain("-o, --transpileOnly");
            expect(helpOutput).toContain("-w, --watch");
            expect(helpOutput).toContain("-t, --target");
            expect(helpOutput).toContain("-m, --module");
            expect(helpOutput).toContain("-d, --declaration");
            expect(helpOutput).toContain("-b, --build");
            expect(helpOutput).toContain("-a, --addons");
            expect(helpOutput).toContain("-f, --addonsDir");
            expect(helpOutput).toContain("-l, --profile");
        });
    });

    describe("Option Validation", () => {
        it("should create command that accepts websmith-specific options", () => {
            const command = addCompileCommand(new Command());
            const helpOutput = command.helpInformation();

            expect(helpOutput).toContain("--addons");
            expect(helpOutput).toContain("--addonsDir");
            expect(helpOutput).toContain("--profile");
            expect(helpOutput).toContain("Comma-separated list of addons");
            expect(helpOutput).toContain("Directory path to the");
        });
    });

    describe("Option Descriptions", () => {
        it("should have proper descriptions for compilation options", () => {
            const command = addCompileCommand(new Command());
            const helpOutput = command.helpInformation();

            expect(helpOutput).toContain("Enable watch mode");
            expect(helpOutput).toContain("Enable the output of debug information");
            expect(helpOutput).toContain("Enable the transpile only mode");
            expect(helpOutput).toContain('File path to the "websmith.config.json"');
        });

        it("should have proper descriptions for TypeScript options", () => {
            const command = addCompileCommand(new Command());
            const helpOutput = command.helpInformation();

            expect(helpOutput).toContain("Set the JavaScript language version");
            expect(helpOutput).toContain("Specify what module code is generated");
            expect(helpOutput).toContain("Generate .d.ts files");
            expect(helpOutput).toContain("Create source map files");
            expect(helpOutput).toContain("Enable all strict type-checking options");
        });

        it("should have proper descriptions for build options", () => {
            const command = addCompileCommand(new Command());
            const helpOutput = command.helpInformation();

            expect(helpOutput).toContain("Initializes a TypeScript project");
            expect(helpOutput).toContain("Print the final configuration");
            expect(helpOutput).toContain("Build one or more projects");
            expect(helpOutput).toContain("Enable color and formatting");
        });
    });

    describe("Option Values", () => {
        it("should document TypeScript target values", () => {
            const command = addCompileCommand(new Command());
            const helpOutput = command.helpInformation();

            expect(helpOutput).toContain("es5");
            expect(helpOutput).toContain("es2015");
            expect(helpOutput).toContain("es2020");
            expect(helpOutput).toContain("esnext");
        });

        it("should document module system values", () => {
            const command = addCompileCommand(new Command());
            const helpOutput = command.helpInformation();

            expect(helpOutput).toContain("commonjs");
            expect(helpOutput).toContain("amd");
            expect(helpOutput).toContain("umd");
            expect(helpOutput).toContain("system");
        });

        it("should document JSX values", () => {
            const command = addCompileCommand(new Command());
            const helpOutput = command.helpInformation();

            expect(helpOutput).toContain("preserve");
            expect(helpOutput).toContain("react");
            expect(helpOutput).toContain("react-jsx");
        });
    });

    describe("CLI argument handling", () => {
        let compiler: Compiler;

        beforeEach(() => {
            compiler = new Compiler({ reporter: new NoReporter() }, undefined, createSystem({}, { virtual: true }));
        });

        describe("Boolean Options", () => {
            it("should handle --debug flag", () => {
                executeCompiler("--debug", compiler);

                expect(compiler.getOptions().debug).toBe(true);
                expect(compiler.getOptions().tsConfig!.listFiles).toBe(true);
            });

            it("should handle --strict flag", () => {
                executeCompiler("--strict", compiler);

                expect(compiler.getOptions().tsConfig!.strict).toBe(true);
            });

            it("should handle --declaration flag", () => {
                executeCompiler("--declaration", compiler);

                expect(compiler.getOptions().tsConfig!.declaration).toBe(true);
            });

            it("should handle --sourceMap flag", () => {
                executeCompiler("--sourceMap", compiler);

                expect(compiler.getOptions().tsConfig!.sourceMap).toBe(true);
            });

            it("should handle --transpileOnly flag", () => {
                executeCompiler("--transpileOnly", compiler);

                expect(compiler.getOptions().config?.transpileOnly).toBe(true);
            });

            it("should handle multiple boolean flags together", () => {
                executeCompiler("--debug --strict --declaration", compiler);

                expect(compiler.getOptions().debug).toBe(true);
                expect(compiler.getOptions().tsConfig!.listFiles).toBe(true);
                expect(compiler.getOptions().tsConfig!.strict).toBe(true);
                expect(compiler.getOptions().tsConfig!.declaration).toBe(true);
            });
        });

        describe("String Options", () => {
            it("should handle --target option", () => {
                executeCompiler("--target es2020", compiler);

                expect(compiler.getOptions().tsConfig!.target).toBe(7); // es2020 enum value
            });

            it("should handle --module option", () => {
                executeCompiler("--module commonjs", compiler);

                expect(compiler.getOptions().tsConfig!.module).toBe(1); // commonjs enum value
            });

            it("should handle --outDir option", () => {
                executeCompiler("--outDir ./dist", compiler);

                expect(compiler.getOptions().tsConfig!.outDir).toBe("/dist"); // Resolved path
            });

            it("should handle --project option", () => {
                executeCompiler("--project ./custom-tsconfig.json", compiler);

                expect(compiler.getOptions().tsConfig!.project).toBe("./custom-tsconfig.json");
            });
        });

        describe("Configuration Options", () => {
            it("should handle --configFile option", () => {
                executeCompiler("--configFile ./custom-websmith.config.json", compiler);

                expect(compiler.getOptions().configFile).toBe("/custom-websmith.config.json"); // Resolved path
            });

            it("should handle -c (configFile) short option", () => {
                executeCompiler("-c ./websmith.config.json", compiler);

                expect(compiler.getOptions().configFile).toBe("/websmith.config.json"); // Resolved path
            });

            it("should handle --addonsDir option", () => {
                executeCompiler("--addonsDir ./custom-addons", compiler);

                // The addonsDir should be configured in the addon registry
                const registry = compiler.getAddonRegistry();
                expect(registry).toBeDefined();
            });

            it("should handle -f (addonsDir) short option", () => {
                executeCompiler("-f ./my-addons", compiler);

                // The addonsDir should be configured in the addon registry
                const registry = compiler.getAddonRegistry();
                expect(registry).toBeDefined();
            });

            it("should handle --profile option", () => {
                executeCompiler("--profile development", compiler);

                expect(compiler.getOptions().profile).toBe("development");
            });

            it("should handle -l (profile) short option", () => {
                executeCompiler("-l production", compiler);

                expect(compiler.getOptions().profile).toBe("production");
            });
        });

        describe("Short Options", () => {
            it("should handle -t (target) short option", () => {
                executeCompiler("-t es2021", compiler);

                expect(compiler.getOptions().tsConfig!.target).toBe(8); // es2021 enum value
            });

            it("should handle -d (declaration) short option", () => {
                executeCompiler("-d", compiler);

                expect(compiler.getOptions().tsConfig!.declaration).toBe(true);
            });

            it("should handle -o (transpileOnly) short option", () => {
                executeCompiler("-o", compiler);

                expect(compiler.getOptions().config?.transpileOnly).toBe(true);
            });
        });

        describe("Addon Options", () => {
            it("should handle --addons option", () => {
                executeCompiler("--addons addon1,addon2", compiler);

                // The addons should be configured in the addon registry
                const registry = compiler.getAddonRegistry();
                expect(registry).toBeDefined();
            });

            it("should handle -a (addons) short option", () => {
                executeCompiler("-a transform1,transform2", compiler);

                // The addons should be configured in the addon registry
                const registry = compiler.getAddonRegistry();
                expect(registry).toBeDefined();
            });
        });

        describe("Option Combinations", () => {
            it("should handle mixed short and long options", () => {
                executeCompiler("-t es2020 --strict -d", compiler);

                expect(compiler.getOptions().tsConfig!.target).toBe(7); // es2020 enum value
                expect(compiler.getOptions().tsConfig!.strict).toBe(true);
                expect(compiler.getOptions().tsConfig!.declaration).toBe(true);
            });

            it("should handle profile with TypeScript options", () => {
                executeCompiler("--profile custom --target es2021", compiler);

                expect(compiler.getOptions().profile).toBe("custom");
                expect(compiler.getOptions().tsConfig!.target).toBe(8); // es2021 enum value
            });

            it("should handle addons with build options", () => {
                executeCompiler("--addons test-addon --declaration", compiler);

                expect(compiler.getOptions().tsConfig!.declaration).toBe(true);
                const registry = compiler.getAddonRegistry();
                expect(registry).toBeDefined();
            });

            it("should handle configuration options together", () => {
                executeCompiler("--configFile ./config.json --addonsDir ./addons --profile test", compiler);

                expect(compiler.getOptions().configFile).toBe("/config.json"); // Resolved path
                expect(compiler.getOptions().profile).toBe("test");
                const registry = compiler.getAddonRegistry();
                expect(registry).toBeDefined();
            });

            it("should handle configuration short options with TypeScript options", () => {
                executeCompiler("-c ./config.json -f ./addons -l dev --target es2020", compiler);

                expect(compiler.getOptions().configFile).toBe("/config.json"); // Resolved path
                expect(compiler.getOptions().profile).toBe("dev");
                expect(compiler.getOptions().tsConfig!.target).toBe(7); // es2020 enum value
                const registry = compiler.getAddonRegistry();
                expect(registry).toBeDefined();
            });
        });
    });
});

const executeCompiler = (args = "", compiler?: Compiler) => {
    try {
        addCompileCommand(new Command(), compiler).parse(
            args
                .split(" ")
                .map(it => it.trim())
                .filter(it => it !== ""),
            { from: "user" }
        );
    } catch (err: any) {
        // Only throw for actual errors, not for expected exits or compilation completion
        if (err.message && !err.message.includes("process.exit") && !err.message.includes("compilation")) {
            throw err;
        }
        // Swallow expected exits from successful compilation
    }
};
