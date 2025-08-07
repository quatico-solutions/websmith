/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { addCompileCommand } from "@quatico/websmith-compiler";
import type { CompilationConfig, Compiler } from "@quatico/websmith-core";
import { Command } from "commander";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

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

describe("compile-websmith-cli tests", () => {
    it("should yield script file with single file and emit true", () => {
        createTsConfig({
            compilerOptions: {
                noEmit: false,
                allowJs: true,
                resolveJsonModule: true,
                target: "esnext",
                module: "esnext",
                moduleResolution: "node",
                lib: ["ESNext"],
                outDir: testDirs.OUTPUT_DIR,
                allowJsonModule: true,
                allowSyntheticDefaultImports: true,
                esModuleInterop: true,
            },
            include: [path.join(__dirname, "..", "test-data", "projects", "test-project-complex", "**/*.ts"), "**/*.json"],
            exclude: ["node_modules", "dist", "**/*.spec.ts", "**/*.test.ts"],
        });

        executeCompiler(
            `--outDir ${testDirs.OUTPUT_DIR}/actual --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")} --debug`,
            "websmith-inline"
        );
        executeCompiler(`--outDir ${testDirs.OUTPUT_DIR}/tsc --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`, "tsc");

        expect(fs.readdirSync(testDirs.OUTPUT_DIR)).toMatchInlineSnapshot(`
            [
              "actual",
              "tsc",
            ]
        `);

        const tscOutput = fs.readdirSync(path.join(testDirs.OUTPUT_DIR, "tsc"), { recursive: true });
        const actualOutput = fs.readdirSync(path.join(testDirs.OUTPUT_DIR, "actual"), { recursive: true });

        expect(actualOutput).toEqual(tscOutput);
    }, 60000);
});

const executeCompiler = (args = "", compilerExec: "tsc" | "websmith-inline" | "websmith-bin" = "websmith-bin", compiler?: Compiler): string => {
    process.chdir(testDirs.PROJECT_DIR);

    let binPath: string;
    if (compilerExec === "tsc") {
        binPath = path.join(__dirname, "..", "node_modules", ".bin", "tsc");
    } else if (compilerExec === "websmith-inline") {
        addCompileCommand(new Command(), compiler).parse(args.split(" "), { from: "user" });
    } else {
        binPath = path.join(__dirname, "..", "..", "compiler", "bin", "bin.js");
        if (!fs.existsSync(binPath)) {
            throw new Error(`Bundled compiler not found at ${binPath}. Please run 'pnpm build' first.`);
        }
        binPath = `node ${binPath}`;
    }
    if (binPath) {
        try {
            return execSync(`${binPath} ${args.trim()}`, {
                encoding: "utf8",
                stdio: "pipe",
                timeout: 30000, // 30 second timeout
                cwd: testDirs.PROJECT_DIR,
            });
        } catch (error: any) {
            // For testing, we still want to return some output even on errors
            const stderr = error.stderr?.toString() || "";
            const stdout = error.stdout?.toString() || "";
            const output = stdout + stderr;

            // Log the error for debugging
            console.log("Compiler execution details:");
            console.log("Command:", `node ${binPath} ${`${args}`.trim()}`);
            console.log("CWD:", testDirs.PROJECT_DIR);
            console.log("Exit code:", error.status);
            console.log("Output:", output);

            return output;
        }
    }
};

const copySourceFile = (fileName: string) => {
    fs.copyFileSync(path.join(TEST_FILES_DIR, fileName), path.join(testDirs.SOURCE_DIR, fileName));
};

const createSourceFile = (fileContent: string, fileName: string) => {
    fs.writeFileSync(path.join(testDirs.SOURCE_DIR, fileName), fileContent, { encoding: "utf-8" });
};

const createTsConfig = (tsConfig: any) => {
    fs.writeFileSync(path.join(testDirs.PROJECT_DIR, "tsconfig.json"), JSON.stringify(tsConfig, null, 2), { encoding: "utf-8" });
};

const getOutput = (filePath: string): string | undefined =>
    fs.existsSync(path.join(testDirs.OUTPUT_DIR, filePath)) ? fs.readFileSync(path.join(testDirs.OUTPUT_DIR, filePath), "utf-8") : undefined;

const createWebsmithConfig = (config: CompilationConfig) => {
    fs.writeFileSync(path.join(testDirs.PROJECT_DIR, "websmith.config.json"), JSON.stringify(config), { encoding: "utf-8" });
};
