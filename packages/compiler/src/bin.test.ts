/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */

import type { TscArguments } from "@quatico/websmith-api";
import type { CompilationConfig } from "@quatico/websmith-core";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const TEST_FILES_DIR = path.resolve(__dirname, "..", "test", "__data__", "functions");

// Create unique test directories for each test to prevent cross-test contamination
const getTestDirs = () => {
    const testId = expect.getState().currentTestName?.replace(/[^a-zA-Z0-9]/g, "_") || "unknown";
    const timestamp = Date.now();
    const uniqueId = `${testId}_${timestamp}`;
    const PROJECT_DIR = path.resolve(__dirname, "..", `test-output-${uniqueId}`);
    const OUTPUT_DIR = path.resolve(PROJECT_DIR, "dist");
    const SOURCE_DIR = path.join(PROJECT_DIR, "src");
    return { PROJECT_DIR, OUTPUT_DIR, SOURCE_DIR };
};

const ADDONS_DIR = path.resolve(__dirname, "..", "..", "example-addons", "src");

let originalCwd: string;
let testDirs: ReturnType<typeof getTestDirs>;

beforeAll(() => {
    // Verify that source addons exist
    if (!fs.existsSync(ADDONS_DIR)) {
        throw new Error(`Addons source directory not found: ${ADDONS_DIR}`);
    }
});

beforeEach(() => {
    // Generate unique test directories for this specific test
    testDirs = getTestDirs();

    // Store original working directory
    originalCwd = process.cwd();

    // Clean up and create test directories (unique for this test)
    try {
        fs.rmSync(path.resolve(testDirs.PROJECT_DIR), { recursive: true, force: true });
    } catch (_error) {
        // Ignore errors if directory doesn't exist
    }
    fs.mkdirSync(testDirs.SOURCE_DIR, { recursive: true });
    fs.mkdirSync(testDirs.OUTPUT_DIR, { recursive: true });
});

afterEach(() => {
    // Restore all mocks
    jest.restoreAllMocks();

    // Restore working directory safely
    try {
        if (originalCwd && originalCwd !== process.cwd()) {
            process.chdir(originalCwd);
        }
    } catch (error) {
        console.warn(`Failed to restore working directory: ${error}`);
    }

    // Clean up test directories (unique for this test)
    if (testDirs) {
        try {
            fs.rmSync(path.resolve(testDirs.PROJECT_DIR), { recursive: true, force: true });
        } catch (_error) {
            // Ignore cleanup errors
        }
    }
});

describe("bin.ts e2e tests", () => {
    it("should yield script file with single file and emit true", () => {
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext" });

        createSourceFile(
            `
            export const hello = "world";            
            export function greet(name: string): string {
                return \`Hello, \${name}!\`;
            }    
            `,
            "test.ts"
        );

        executeCompiler(`--project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`);

        expect(getOutput("test.js")).toBeDefined();
        expect(getOutput("test.js")).toMatchInlineSnapshot(`
            "export const hello = "world";
            export function greet(name) {
                return \`Hello, \${name}!\`;
            }
            "
        `);
    }, 60000);

    it("should yield script and declaration files with single file, declaration and emit true", () => {
        createTsConfig({
            outDir: testDirs.OUTPUT_DIR,
            noEmit: false,
            declaration: true,
            declarationMap: true,
            target: "esnext",
            moduleResolution: "node10",
        });
        copySourceFile("foobar-arrow.ts");

        executeCompiler();

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
    }, 60000);

    it("should yield transpiled script with single file, profile client-processor and emit", () => {
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "es5", module: "commonjs" });
        createWebsmithConfig({
            profiles: {
                target: {
                    addons: ["client-processor"],
                    tsConfig: {
                        outDir: `${testDirs.OUTPUT_DIR}/target`,
                        target: ts.ScriptTarget.ESNext,
                        module: ts.ModuleKind.ESNext,
                        moduleResolution: ts.ModuleResolutionKind.Node10,
                    },
                },
            },
        });
        copySourceFile("foobar-function.ts");

        executeCompiler(
            `--addonsDir ${ADDONS_DIR} --profile target --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")} --configFile ${path.join(testDirs.PROJECT_DIR, "websmith.config.json")}`
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
    }, 60000);

    it("should yield transpiled script with single file, addons-cli client-processor and emit", () => {
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext", types: [] });
        copySourceFile("foobar-function.ts");

        executeCompiler(`--addonsDir ${ADDONS_DIR} --addons client-processor --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`);

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
    }, 60000);

    it("should yield transpiled script with single file, addons-config client-processor and emit", () => {
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext", types: [] });
        createWebsmithConfig({
            addons: ["client-processor"],
        });
        copySourceFile("foobar-function.ts");

        executeCompiler(
            `--addonsDir ${ADDONS_DIR} --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")} --configFile ${path.join(testDirs.PROJECT_DIR, "websmith.config.json")}`
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
    }, 60000);

    it("should yield transpiled script with single file, addons-cli client-transformer and emit true", () => {
        createTsConfig({
            outDir: testDirs.OUTPUT_DIR,
            noEmit: false,
            target: "esnext",
            moduleResolution: "node10",
        });
        copySourceFile("foobar-function.ts");

        executeCompiler(`--addonsDir ${ADDONS_DIR} --addons client-transformer --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`);

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
    }, 60000);

    it("should yield transpiled script with single file, addons-cli export-yaml-generator and emit true", () => {
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext", types: [] });
        copySourceFile("foobar-function.ts");

        executeCompiler(`--addonsDir ${ADDONS_DIR} --addons export-yaml-generator --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`);

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
    }, 60000);

    it("should yield transpiled script with single file, addons-cli foo-added-generator and emit true", () => {
        createTsConfig({
            outDir: testDirs.OUTPUT_DIR,
            noEmit: false,
            target: "esnext",
            moduleResolution: "node10",
        });
        copySourceFile("foobar-function.ts");

        executeCompiler(`--addonsDir ${ADDONS_DIR} --addons foo-added-generator --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`);

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
    }, 60000);

    it("should yield transpiled script with single file, addons-cli function-json-result-processor and emit true", () => {
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext", types: [] });
        copySourceFile("foobar-function.ts");

        executeCompiler(
            `--addonsDir ${ADDONS_DIR} --addons function-json-result-processor --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`
        );

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
    }, 60000);

    it("should exit with zero status w/ clean project", () => {
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext", types: [] });
        createSourceFile(`export const hello: string = "world";`, "test.ts");

        const actual = executeCompilerStatus(`--project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`).status;

        expect(actual).toBe(0);
    }, 60000);

    it("should exit with status 1 w/ type error in project and addon requiring type information", () => {
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext", types: [] });
        createSourceFile(`export const hello: number = "world";`, "test.ts");
        createAddon("type-info-addon", `exports.activate = () => {};`);

        const actual = executeCompilerStatus(
            `--addonsDir ${path.join(testDirs.PROJECT_DIR, "addons")} --addons type-info-addon --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`
        ).status;

        expect(actual).toBe(1);
    }, 60000);

    it("should exit with status 1 w/ throwing processor addon", () => {
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext", types: [] });
        createSourceFile(`export const hello: string = "world";`, "test.ts");
        createAddon("throwing-processor", `exports.activate = ctx => ctx.registerProcessor(() => { throw new Error("Processor failure"); });`);

        const actual = executeCompilerStatus(
            `--addonsDir ${path.join(testDirs.PROJECT_DIR, "addons")} --addons throwing-processor --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`
        ).status;

        expect(actual).toBe(1);
    }, 60000);

    it("should exit with zero status and report warning w/ warnings only", () => {
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext", types: [] });
        createSourceFile(`export const hello: string = "world";`, "test.ts");

        const target = executeCompilerStatus(
            `--addonsDir ${path.join(testDirs.PROJECT_DIR, "missing-addons")} --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`
        );
        const actual1 = target.status;
        const actual2 = target.output;

        expect(actual1).toBe(0);
        expect(actual2).toContain("does not exist");
    }, 60000);

    it("should exit with status 1 and report 91001 in emitted file w/ addon generating require in node ESM profile", () => {
        createEsmProject("error");

        const target = executeCompilerStatus(
            `--addonsDir ${path.join(testDirs.PROJECT_DIR, "addons")} --profile client --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")} --configFile ${path.join(testDirs.PROJECT_DIR, "websmith.config.json")}`
        );
        const actual1 = target.status;
        const actual2 = target.output;

        expect(actual1).toBe(1);
        expect(actual2).toContain(`${path.join(testDirs.OUTPUT_DIR, "test.js")} (2,26): ESM91001`);
    }, 60000);

    it("should exit with zero status and report 91001 warning w/ addon generating require in node ESM profile with check warn", () => {
        createEsmProject("warn");

        const target = executeCompilerStatus(
            `--addonsDir ${path.join(testDirs.PROJECT_DIR, "addons")} --profile client --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")} --configFile ${path.join(testDirs.PROJECT_DIR, "websmith.config.json")}`
        );
        const actual1 = target.status;
        const actual2 = target.output;

        expect(actual1).toBe(0);
        expect(actual2).toContain(`${path.join(testDirs.OUTPUT_DIR, "test.js")} (2,26): ESM91001`);
    }, 60000);

    it("should exit with status 1 and report 91002 naming addon w/ result processor writing CommonJS into node ESM profile output", () => {
        createEsmProject("error", []);
        const metaFile = path.join(testDirs.OUTPUT_DIR, "meta.js");
        createAddon(
            "meta-writer",
            `exports.activate = ctx => ctx.registerResultProcessor((_files, processorCtx) => processorCtx.getSystem().writeFile(${JSON.stringify(metaFile)}, "module.exports = {};\\n"));`
        );
        createWebsmithConfig({
            profiles: {
                client: {
                    addons: ["meta-writer"],
                    esm: { runtime: "node" },
                    tsConfig: { outDir: testDirs.OUTPUT_DIR, module: ts.ModuleKind.ESNext },
                },
            },
        });

        const target = executeCompilerStatus(
            `--addonsDir ${path.join(testDirs.PROJECT_DIR, "addons")} --profile client --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")} --configFile ${path.join(testDirs.PROJECT_DIR, "websmith.config.json")}`
        );
        const actual1 = target.status;
        const actual2 = target.output;

        expect(actual1).toBe(1);
        expect(actual2).toContain(`${metaFile} (1,1): ESM91002`);
        expect(actual2).toContain(`(profile "client", addons: meta-writer).`);
    }, 60000);

    it("should exit with status 1 and report only the config error w/ node ESM profile and CommonJS profile module", () => {
        fs.writeFileSync(path.join(testDirs.OUTPUT_DIR, "package.json"), JSON.stringify({ type: "module" }), { encoding: "utf-8" });
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext", types: [] });
        createWebsmithConfig({
            profiles: {
                client: { esm: { runtime: "node" }, tsConfig: { outDir: testDirs.OUTPUT_DIR, module: "CommonJS" as unknown as ts.ModuleKind } },
            },
        });
        createSourceFile(`export const hello: string = "world";`, "test.ts");

        const target = executeCompilerStatus(
            `--profile client --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")} --configFile ${path.join(testDirs.PROJECT_DIR, "websmith.config.json")}`
        );
        const actual1 = target.status;
        const actual2 = [
            ...new Set(
                target.output
                    .split(/\r?\n/)
                    .filter(cur => /Error/.test(cur))
                    .map(cur => cur.replace(/^\[[^\]]*\]\s*/, ""))
            ),
        ];

        expect(actual1).toBe(1);
        expect(actual2).toEqual([expect.stringContaining("sets 'esm', but its 'tsConfig.module' is 'CommonJS'")]);
    }, 60000);

    const createEsmProject = (check: "error" | "warn", addons = ["require-generator"]) => {
        fs.writeFileSync(path.join(testDirs.OUTPUT_DIR, "package.json"), JSON.stringify({ type: "module" }), { encoding: "utf-8" });
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext", module: "esnext", types: [] });
        createWebsmithConfig({
            profiles: {
                client: {
                    addons,
                    esm: { runtime: "node", check },
                    tsConfig: { outDir: testDirs.OUTPUT_DIR, module: ts.ModuleKind.ESNext },
                },
            },
        });
        createSourceFile(`export const hello: string = "world";`, "test.ts");
        createAddon(
            "require-generator",
            `exports.activate = ctx => ctx.registerProcessor((_fileName, content) => content + '\\ndeclare const require: (id: string) => unknown;\\nexport const generated = require("node:path");\\n');`
        );
    };

    const executeCompilerStatus = (args: string): { status: number | null; output: string } => {
        const binPath = path.join(__dirname, "..", "bin", "bin.js");
        if (!fs.existsSync(binPath)) {
            throw new Error(`Bundled compiler not found at ${binPath}. Please run 'pnpm build' first.`);
        }

        const { status, stdout, stderr } = spawnSync("node", [binPath, ...args.trim().split(/\s+/)], {
            encoding: "utf8",
            timeout: 30000,
            cwd: testDirs.PROJECT_DIR,
        });
        return { status, output: `${stdout}${stderr}` };
    };

    const createAddon = (name: string, code: string) => {
        const addonDir = path.join(testDirs.PROJECT_DIR, "addons", name);
        fs.mkdirSync(addonDir, { recursive: true });
        fs.writeFileSync(path.join(addonDir, "addon.js"), code, { encoding: "utf-8" });
    };

    it("should apply .ts addon w/ consumer package.json type module", () => {
        createPackageJson({ type: "module" });
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext", types: [] });
        createEsmAddons();
        copySourceFile("foobar-function.ts");

        executeCompiler(
            `--addonsDir ${path.join(testDirs.PROJECT_DIR, "addons")} --addons esm-processor --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`
        );

        expect(getOutput("foobar-function.js")).toContain("function esmProcessed(date)");
    }, 60000);

    it("should apply multi-file .ts addon with cross-addon import w/ consumer package.json type module", () => {
        createPackageJson({ type: "module" });
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext", types: [] });
        createEsmAddons();
        copySourceFile("foobar-function.ts");

        executeCompiler(
            `--addonsDir ${path.join(testDirs.PROJECT_DIR, "addons")} --addons esm-cross-processor --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`
        );

        expect(getOutput("foobar-function.js")).toContain("function crossAddonProcessed(date)");
    }, 60000);

    it("should apply .ts addon importing package from project node_modules w/ consumer package.json type module", () => {
        createPackageJson({ type: "module" });
        createTsConfig({ outDir: testDirs.OUTPUT_DIR, noEmit: false, target: "esnext", types: [] });
        createEsmAddons();
        createProjectPackage();
        copySourceFile("foobar-function.ts");

        executeCompiler(
            `--addonsDir ${path.join(testDirs.PROJECT_DIR, "addons")} --addons project-package-processor --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`
        );

        expect(getOutput("foobar-function.js")).toContain("function projectPackageProcessed(date)");
    }, 60000);

    const executeCompiler = (args = ""): string => {
        process.chdir(testDirs.PROJECT_DIR);

        const binPath = path.join(__dirname, "..", "bin", "bin.js");
        if (!fs.existsSync(binPath)) {
            throw new Error(`Bundled compiler not found at ${binPath}. Please run 'pnpm build' first.`);
        }

        const { status, stdout, stderr } = spawnSync(
            "node",
            [
                binPath,
                ...args
                    .trim()
                    .split(/\s+/)
                    .filter(it => it !== ""),
            ],
            {
                encoding: "utf8",
                timeout: 30000,
                cwd: testDirs.PROJECT_DIR,
            }
        );
        if (status !== 0) {
            throw new Error(`Compiler exited with status ${status}:\n${stdout}${stderr}`);
        }
        return stdout;
    };

    const copySourceFile = (fileName: string) => {
        fs.copyFileSync(path.join(TEST_FILES_DIR, fileName), path.join(testDirs.SOURCE_DIR, fileName));
    };

    const createSourceFile = (fileContent: string, fileName: string) => {
        fs.writeFileSync(path.join(testDirs.SOURCE_DIR, fileName), fileContent, { encoding: "utf-8" });
    };

    const createTsConfig = (config: TscArguments) => {
        const tsConfig = {
            compilerOptions: config,
            include: ["src/**/*"],
            exclude: ["node_modules", "dist"],
        };
        fs.writeFileSync(path.join(testDirs.PROJECT_DIR, "tsconfig.json"), JSON.stringify(tsConfig, null, 2), { encoding: "utf-8" });
    };

    const getOutput = (filePath: string): string | undefined =>
        fs.existsSync(path.join(testDirs.OUTPUT_DIR, filePath)) ? fs.readFileSync(path.join(testDirs.OUTPUT_DIR, filePath), "utf-8") : undefined;

    const createPackageJson = (packageJson: Record<string, unknown>) => {
        fs.writeFileSync(path.join(testDirs.PROJECT_DIR, "package.json"), JSON.stringify(packageJson), { encoding: "utf-8" });
    };

    const createEsmAddons = () => {
        const addonsDir = path.join(testDirs.PROJECT_DIR, "addons");
        const addonFiles: Record<string, string> = {
            "esm-processor/addon.ts": `
                export const replaceFoobar = (content: string, replacement: string): string => content.replace(/foobar/g, replacement);
                export const activate = (ctx: any): void => {
                    ctx.registerProcessor((_fileName: string, content: string) => replaceFoobar(content, "esmProcessed"));
                };
            `,
            "esm-cross-processor/addon.ts": `
                import { replaceFoobar } from "../esm-processor/addon";
                import { REPLACEMENT } from "./replacement";
                export const activate = (ctx: any): void => {
                    ctx.registerProcessor((_fileName: string, content: string) => replaceFoobar(content, REPLACEMENT));
                };
            `,
            "esm-cross-processor/replacement.ts": `export const REPLACEMENT = "crossAddonProcessed";`,
            "project-package-processor/addon.ts": `
                import { REPLACEMENT } from "project-package";
                export const activate = (ctx: any): void => {
                    ctx.registerProcessor((_fileName: string, content: string) => content.replace(/foobar/g, REPLACEMENT));
                };
            `,
        };
        for (const [fileName, content] of Object.entries(addonFiles)) {
            fs.mkdirSync(path.dirname(path.join(addonsDir, fileName)), { recursive: true });
            fs.writeFileSync(path.join(addonsDir, fileName), content, { encoding: "utf-8" });
        }
    };

    const createProjectPackage = () => {
        const packageDir = path.join(testDirs.PROJECT_DIR, "node_modules", "project-package");
        fs.mkdirSync(packageDir, { recursive: true });
        fs.writeFileSync(path.join(packageDir, "package.json"), JSON.stringify({ name: "project-package", main: "index.js" }), { encoding: "utf-8" });
        fs.writeFileSync(path.join(packageDir, "index.js"), 'exports.REPLACEMENT = "projectPackageProcessed";', { encoding: "utf-8" });
    };

    const createWebsmithConfig = (config: CompilationConfig) => {
        fs.writeFileSync(path.join(testDirs.PROJECT_DIR, "websmith.config.json"), JSON.stringify(config), { encoding: "utf-8" });
    };
});
