/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type CompilationConfig, Compiler, createSystem, NoReporter } from "@quatico/websmith-core";
import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { addCompileCommand } from "./command";

const TEST_FILES_DIR = path.resolve(__dirname, "..", "test", "__data__", "functions");
const PROJECT_DIR = path.resolve(__dirname, "..", "test-output");
const OUTPUT_DIR = path.resolve(PROJECT_DIR, "dist");
const SOURCE_DIR = path.join(PROJECT_DIR, "src");
const ADDONS_DIR = path.resolve(__dirname, "..", "..", "example-addons", "src");

describe("bin.ts", () => {
    let originalCwd: string;
    beforeAll(() => {
        // Verify that source addons exist
        if (!fs.existsSync(ADDONS_DIR)) {
            throw new Error(`Addons source directory not found: ${ADDONS_DIR}`);
        }
    });

    beforeEach(() => {
        originalCwd = process.cwd();
        fs.rmSync(path.resolve(PROJECT_DIR), { recursive: true, force: true });
        fs.mkdirSync(SOURCE_DIR, { recursive: true });
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    });

    afterEach(() => {
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        originalCwd && process.chdir(originalCwd);
        fs.rmSync(path.resolve(PROJECT_DIR), { recursive: true, force: true });
    });

    it("should create Command instance and call addCompileCommand", () => {
        const target = jest.spyOn(process.stdout, "write").mockImplementation(() => true);

        executeCompiler("--help");

        // Verify that help text was written to stdout with correct program name
        expect(target).toHaveBeenCalledWith(expect.stringContaining("Usage: websmith [options]"));
    });

    it("should parse process.argv with debug and watch flags", () => {
        jest.spyOn(process.stdout, "write").mockImplementation(() => true);
        const target = new Compiler({ reporter: new NoReporter() }, {}, createSystem({}, { virtual: true }));
        const watchSpy = jest.spyOn(target, "watch").mockImplementation(() => target);

        executeCompiler("--debug --watch", target);

        // Verify that watch method was called (for --watch flag)
        expect(watchSpy).toHaveBeenCalled();
        expect(target.getOptions()).toMatchObject({ tsConfig: { listFiles: true, debug: true, watch: true } });
    });

    it("should handle compilation arguments", () => {
        const target = new Compiler(
            { reporter: new NoReporter() },
            {},
            createSystem({ "./tsconfig.json": createTsConfig({ sourceMap: false }) }, { virtual: true })
        );
        executeCompiler("--project ./tsconfig.json --sourceMap", target);

        expect(target.getOptions()).toMatchObject({ tsConfig: { sourceMap: true, project: "./tsconfig.json" } });
    });

    it("should handle addon-related arguments", () => {
        const target = new Compiler({ reporter: new NoReporter() }, {}, createSystem({}, { virtual: true }));
        executeCompiler("--addons foo,bar --addonsDir ./custom-addons", target);

        expect(target.getOptions().tsConfig).toEqual({
            // tsconfig does not contain extraArgs
            allowJs: false,
            checkJs: false,
            configFilePath: "/tsconfig.json",
            declaration: false,
            declarationMap: false,
            emitDecorationOnly: false,
            esModuleInterop: false,
            jsx: 1,
            module: 99,
            moduleResolution: 2,
            noEmit: false,
            pretty: true,
            project: "./tsconfig.json",
            removeComments: false,
            strict: false,
            target: 1,
        });
        expect(target.getOptions().config).toEqual({ addons: ["foo", "bar"], addonsDir: "./custom-addons" });
    });

    it("should handle empty arguments", () => {
        const target = new Compiler({ reporter: new NoReporter() }, {}, createSystem({}, { virtual: true }));
        executeCompiler("", target);

        expect(target.getOptions()).toEqual({
            additionalArguments: expect.any(Map),
            addons: [],
            addonsDir: "/addons",
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
                    jsx: 1,
                    module: 99,
                    moduleResolution: 2,
                    noEmit: false,
                    pretty: true,
                    project: "./tsconfig.json",
                    removeComments: false,
                    strict: false,
                    target: 1,
                },
            },
            config: {},
            configFile: "/websmith.config.json",
            debug: false,
            profile: undefined,
            projectDir: "/",
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
                module: ts.ModuleKind.ESNext,
                moduleResolution: ts.ModuleResolutionKind.Node10,
                noEmit: false,
                pretty: true,
                project: "./tsconfig.json",
                removeComments: false,
                strict: false,
                target: ts.ScriptTarget.ES5,
            },
            tsConfigFile: "/tsconfig.json",
            watch: false,
        });
    });

    it("should handle unknown arguments", () => {
        const target = new Compiler({ reporter: new NoReporter() }, {}, createSystem({}, { virtual: true }));
        executeCompiler("--unknown --another-unknown expected", target);

        expect(target.getOptions()).toMatchObject({
            additionalArguments: new Map<string, unknown>([
                ["unknown", true],
                ["another-unknown", "expected"],
            ]),
        });
    });

    it("should yield script file with single file and emit true", () => {
        createTsConfigFile({ outDir: OUTPUT_DIR, noEmit: false, target: ts.ScriptTarget.ESNext });
        createSourceFile(
            `
            export const hello = "world";            
            export function greet(name: string): string {
                return \`Hello, \${name}!\`;
            }    
            `,
            "test.ts"
        );

        executeCompiler(`--project ${path.join(PROJECT_DIR, "tsconfig.json")}`, new Compiler({ reporter: new NoReporter() }, {}, createSystem()));

        expect(getOutput("test.js")).toBeDefined();
        expect(getOutput("test.js")).toMatchInlineSnapshot(`
            "export const hello = "world";
            export function greet(name) {
                return \`Hello, \${name}!\`;
            }
            "
        `);
    });

    it("should yield script and declaration files with single file, declaration and emit true", () => {
        createTsConfigFile({ outDir: OUTPUT_DIR, noEmit: false, declaration: true, declarationMap: true, target: ts.ScriptTarget.ESNext });
        copySourceFile("foobar-arrow.ts");

        executeCompiler("--project ./tsconfig.json", new Compiler({ reporter: new NoReporter() }, {}, createSystem()));

        expect(getOutput("foobar-arrow.js")).toMatchInlineSnapshot(`
            "// @annotated()
            export const getFoobar = (date) => {
                return foobar(date);
            };
            const foobar = (date) => {
                return \`foobar \${date.toISOString()}\`;
            };
            "
        `);
        expect(getOutput("foobar-arrow.d.ts")).toMatchInlineSnapshot(`
            "export declare const getFoobar: (date: Date) => string;
            //# sourceMappingURL=foobar-arrow.d.ts.map"
        `);
        expect(getOutput("foobar-arrow.d.ts.map")).toMatchInlineSnapshot(
            `"{"version":3,"file":"foobar-arrow.d.ts","sourceRoot":"","sources":["../src/foobar-arrow.ts"],"names":[],"mappings":"AACA,eAAO,MAAM,SAAS,SAAU,IAAI,WAEnC,CAAC"}"`
        );
    });

    it("should yield transpiled script with single file, profile client-processor and emit", () => {
        createTsConfigFile({ outDir: OUTPUT_DIR, noEmit: false, target: 1, module: 3 });
        createWebsmithConfig({
            profiles: {
                target: {
                    addons: ["client-processor"],
                    tsConfig: {
                        outDir: `${OUTPUT_DIR}/target`,
                        target: ts.ScriptTarget.ESNext,
                        module: ts.ModuleKind.ESNext,
                    },
                },
            },
        });
        copySourceFile("foobar-function.ts");

        executeCompiler(
            `--addonsDir ${ADDONS_DIR} --profile target --project ${path.join(PROJECT_DIR, "tsconfig.json")} --configFile ${path.join(PROJECT_DIR, "websmith.config.json")}`
        );

        expect(getOutput("target/foobar-function.js")).toMatchInlineSnapshot(`
            "// @annotated()
            export function getCLIENT(date) {
                return CLIENT(date);
            }
            function CLIENT(date) {
                return \`foobar \${date.toISOString()}\`;
            }
            "
        `);
    });

    it("should yield transpiled script with single file, addons-cli client-processor and emit", () => {
        createTsConfigFile({ outDir: OUTPUT_DIR, noEmit: false, target: ts.ScriptTarget.ESNext });
        copySourceFile("foobar-function.ts");

        executeCompiler(`--addonsDir ${ADDONS_DIR} --addons client-processor --project ${path.join(PROJECT_DIR, "tsconfig.json")}`);

        expect(getOutput("foobar-function.js")).toMatchInlineSnapshot(`
            "// @annotated()
            export function getCLIENT(date) {
                return CLIENT(date);
            }
            function CLIENT(date) {
                return \`foobar \${date.toISOString()}\`;
            }
            "
        `);
    });

    it("should yield transpiled script with single file, addons-config client-processor and emit", () => {
        createTsConfigFile({ outDir: OUTPUT_DIR, noEmit: false, target: ts.ScriptTarget.ESNext });
        createWebsmithConfig({
            addons: ["client-processor"],
        });
        copySourceFile("foobar-function.ts");

        executeCompiler(
            `--addonsDir ${ADDONS_DIR} --project ${path.join(PROJECT_DIR, "tsconfig.json")} --configFile ${path.join(PROJECT_DIR, "websmith.config.json")}`
        );

        expect(getOutput("foobar-function.js")).toMatchInlineSnapshot(`
            "// @annotated()
            export function getCLIENT(date) {
                return CLIENT(date);
            }
            function CLIENT(date) {
                return \`foobar \${date.toISOString()}\`;
            }
            "
        `);
    });

    it("should yield transpiled script with single file, addons-cli client-transformer and emit true", () => {
        createTsConfigFile({ outDir: OUTPUT_DIR, noEmit: false, target: ts.ScriptTarget.ESNext });
        copySourceFile("foobar-function.ts");

        executeCompiler(`--addonsDir ${ADDONS_DIR} --addons client-transformer --project ${path.join(PROJECT_DIR, "tsconfig.json")}`);

        expect(getOutput("foobar-function.js")).toMatchInlineSnapshot(`
            "// @annotated()
            export function getCLIENT(date) {
                return CLIENT(date);
            }
            function CLIENT(date) {
                return \`foobar \${date.toISOString()}\`;
            }
            "
        `);
    });

    it("should yield transpiled script with single file, addons-cli export-yaml-generator and emit true", () => {
        createTsConfigFile({ outDir: OUTPUT_DIR, noEmit: false, target: ts.ScriptTarget.ESNext });
        copySourceFile("foobar-function.ts");

        executeCompiler(`--addonsDir ${ADDONS_DIR} --addons export-yaml-generator --project ${path.join(PROJECT_DIR, "tsconfig.json")}`);

        expect(getOutput("foobar-function.js")).toMatchInlineSnapshot(`
            "// @annotated()
            export function getFoobar(date) {
                return foobar(date);
            }
            function foobar(date) {
                return \`foobar \${date.toISOString()}\`;
            }
            "
        `);
        expect(getOutput("output.yaml")).toContain(`exports: [getFoobar]`);
    });

    it("should yield transpiled script with single file, addons-cli foo-added-generator and emit true", () => {
        createTsConfigFile({ outDir: OUTPUT_DIR, noEmit: false, target: ts.ScriptTarget.ESNext });
        copySourceFile("foobar-function.ts");

        executeCompiler(`--addonsDir ${ADDONS_DIR} --addons foo-added-generator --project ${path.join(PROJECT_DIR, "tsconfig.json")}`);

        expect(getOutput("foobar-function.js")).toMatchInlineSnapshot(`
            "// @annotated()
            export function getFoobar(date) {
                return foobar(date);
            }
            function foobar(date) {
                return \`foobar \${date.toISOString()}\`;
            }
            "
        `);
        expect(getOutput("foobar-function-added.js")).toMatchInlineSnapshot(`
            "// @annotated()
            export function getFoobar(date) {
                return foobar(date);
            }
            function foobar(date) {
                return \`foobar \${date.toISOString()}\`;
            }
            "
        `);
    });

    it("should yield transpiled script with single file, addons-cli function-json-result-processor and emit true", () => {
        createTsConfigFile({ outDir: OUTPUT_DIR, noEmit: false, target: ts.ScriptTarget.ESNext });
        copySourceFile("foobar-function.ts");

        executeCompiler(`--addonsDir ${ADDONS_DIR} --addons function-json-result-processor --project ${path.join(PROJECT_DIR, "tsconfig.json")}`);

        expect(getOutput("foobar-function.js")).toMatchInlineSnapshot(`
            "// @annotated()
            export function getFoobar(date) {
                return foobar(date);
            }
            function foobar(date) {
                return \`foobar \${date.toISOString()}\`;
            }
            "
        `);
        expect(getOutput("named-functions.json")).toMatchInlineSnapshot(`"{"foobar-function":["getFoobar","foobar"]}"`);
    });
});

const executeCompiler = (args = "", compiler?: Compiler) => {
    // Store original process.exit to restore later
    const originalExit = process.exit;
    let exitCode = 0;

    process.chdir(PROJECT_DIR);

    try {
        // Mock process.exit to capture exit codes without actually exiting
        process.exit = (code = 0) => {
            exitCode = code as number;
            throw new Error(`Process exit called with code ${code}`);
        };

        addCompileCommand(new Command(), compiler).parse(args.split(" "), { from: "user" });
    } catch (err) {
        // Check if this was a successful exit (help shown, etc.)
        if (exitCode === 0 || process.exitCode === 0) {
            // Don't throw for successful operations
            return;
        }

        // Only throw for actual compilation failures
        if (!err.message?.includes("Process exit called")) {
            throw err;
        }

        // For non-zero exit codes, throw the error
        if (exitCode !== 0) {
            throw err;
        }
    } finally {
        // Always restore the original process.exit
        process.exit = originalExit;
    }
};

const createTsConfig = (config: ts.CompilerOptions) => {
    // Convert enum values to strings for proper JSON serialization
    const normalizedConfig = {
        ...config,
        ...(config.target !== undefined && {
            target: ts.ScriptTarget[config.target] === "Latest" ? "esnext" : ts.ScriptTarget[config.target].toLowerCase(),
        }),
        ...(config.module !== undefined && { module: ts.ModuleKind[config.module].toLowerCase() }),
        ...(config.jsx !== undefined && { jsx: ts.JsxEmit[config.jsx].toLowerCase() }),
        ...(config.moduleResolution !== undefined && { moduleResolution: ts.ModuleResolutionKind[config.moduleResolution].toLowerCase() }),
    };

    const tsConfig = {
        compilerOptions: normalizedConfig,
        include: ["src/**/*"],
        exclude: ["node_modules", "dist"],
    };
    return JSON.stringify(tsConfig, null, 2);
};

const createTsConfigFile = (config: ts.CompilerOptions) => {
    fs.writeFileSync(path.resolve(PROJECT_DIR, "tsconfig.json"), createTsConfig(config), { encoding: "utf-8" });
};

const createWebsmithConfig = (config: CompilationConfig) => {
    fs.writeFileSync(path.resolve(PROJECT_DIR, "websmith.config.json"), JSON.stringify(config), { encoding: "utf-8" });
};

const copySourceFile = (fileName: string) => {
    fs.copyFileSync(path.resolve(TEST_FILES_DIR, fileName), path.resolve(SOURCE_DIR, fileName));
};

const createSourceFile = (fileContent: string, fileName: string) => {
    fs.writeFileSync(path.resolve(SOURCE_DIR, fileName), fileContent, { encoding: "utf-8" });
};

const getOutput = (filePath: string): string | undefined =>
    fs.existsSync(path.join(OUTPUT_DIR, filePath)) ? fs.readFileSync(path.join(OUTPUT_DIR, filePath), "utf-8") : undefined;
