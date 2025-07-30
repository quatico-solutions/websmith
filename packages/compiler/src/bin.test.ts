/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import path from "node:path";
import fs from "node:fs";
import { execSync } from "node:child_process";
import ts from "typescript";
import type { CompilationConfig } from "@quatico/websmith-core";

const TEST_FILES_DIR = path.resolve(__dirname, "..", "test", "__data__", "functions");
const PROJECT_DIR = path.resolve(__dirname, "..", "test-output");
const OUTPUT_DIR = path.resolve(PROJECT_DIR, "dist");
const SOURCE_DIR = path.join(PROJECT_DIR, "src");
const ADDONS_DIR = path.resolve(__dirname, "..", "..", "example-addons", "src");

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

describe("bin.ts e2e tests", () => {
    it("should yield script file with single file and emit true", () => {
        createTsConfig({ outDir: OUTPUT_DIR, noEmit: false });

        createSourceFile(
            `
            export const hello = "world";            
            export function greet(name: string): string {
                return \`Hello, \${name}!\`;
            }    
            `,
            "test.ts"
        );

        executeCompiler(`--project ${path.join(PROJECT_DIR, "tsconfig.json")}`);

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
        createTsConfig({ outDir: OUTPUT_DIR, noEmit: false, declaration: true, declarationMap: true });
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
    });

    it("should yield transpiled script with single file, profile client-processor and emit", () => {
        createTsConfig({ outDir: OUTPUT_DIR, noEmit: false, target: 1, module: 3 });
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
        createTsConfig({ outDir: OUTPUT_DIR, noEmit: false });
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
        createTsConfig({ outDir: OUTPUT_DIR, noEmit: false });
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
        createTsConfig({ outDir: OUTPUT_DIR, noEmit: false });
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
        createTsConfig({ outDir: OUTPUT_DIR, noEmit: false });
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
        createTsConfig({ outDir: OUTPUT_DIR, noEmit: false });
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
        createTsConfig({ outDir: OUTPUT_DIR, noEmit: false });
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

const executeCompiler = (args = ""): string => {
    process.chdir(PROJECT_DIR);

    const binPath = path.join(__dirname, "..", "bin", "bin.js");
    if (!fs.existsSync(binPath)) {
        throw new Error(`Bundled compiler not found at ${binPath}. Please run 'pnpm build' first.`);
    }

    try {
        return execSync(`node ${binPath} ${args.trim()}`, {
            encoding: "utf8",
            stdio: "pipe",
            timeout: 30000, // 30 second timeout
            cwd: PROJECT_DIR,
        });
    } catch (error: any) {
        // For testing, we still want to return some output even on errors
        const stderr = error.stderr?.toString() || "";
        const stdout = error.stdout?.toString() || "";
        const output = stdout + stderr;

        // Log the error for debugging
        console.log("Compiler execution details:");
        console.log("Command:", `node ${binPath} ${`${args}`.trim()}`);
        console.log("CWD:", PROJECT_DIR);
        console.log("Exit code:", error.status);
        console.log("Output:", output);

        return output;
    }
};

const copySourceFile = (fileName: string) => {
    fs.copyFileSync(path.resolve(TEST_FILES_DIR, fileName), path.resolve(SOURCE_DIR, fileName));
};

const createSourceFile = (fileContent: string, fileName: string) => {
    fs.writeFileSync(path.resolve(SOURCE_DIR, fileName), fileContent, { encoding: "utf-8" });
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

    fs.writeFileSync(path.join(PROJECT_DIR, "tsconfig.json"), JSON.stringify({ compilerOptions: normalizedConfig }), {
        encoding: "utf-8",
    });

    const tsConfig = {
        normalizedConfig,
        include: ["src/**/*"],
        exclude: ["node_modules", "dist"],
    };
    fs.writeFileSync(path.resolve(PROJECT_DIR, "tsconfig.json"), JSON.stringify(tsConfig, null, 2), { encoding: "utf-8" });
};

const getOutput = (filePath: string): string | undefined =>
    fs.existsSync(path.join(OUTPUT_DIR, filePath)) ? fs.readFileSync(path.join(OUTPUT_DIR, filePath), "utf-8") : undefined;

const createWebsmithConfig = (config: CompilationConfig) => {
    fs.writeFileSync(path.resolve(PROJECT_DIR, "websmith.config.json"), JSON.stringify(config), { encoding: "utf-8" });
};
