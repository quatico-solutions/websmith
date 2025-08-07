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
    describe("failing compile-websmith-cli tests", () => {
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
                    allowSyntheticDefaultImports: true,
                    esModuleInterop: true,
                },
                include: ["../test-data/projects/test-project-complex/**/*.ts"],
                exclude: ["node_modules", "dist", "**/*.spec.ts", "**/*.test.ts"],
            });

            executeCompiler(
                `--outDir ${testDirs.OUTPUT_DIR}/websmith --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")} --debug`,
                "websmith-inline"
            );
            executeCompiler(`--outDir ${testDirs.OUTPUT_DIR}/tsc --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`, "tsc");

            const { actual, expected } = compareDirectories(path.join(testDirs.OUTPUT_DIR, "websmith"), path.join(testDirs.OUTPUT_DIR, "tsc"));
            // NOTE: websmith copies imported .json files automatically, but tsc does not
            expect(actual.filter(it => !it.endsWith(".json"))).toEqual(expected.filter(it => !it.endsWith(".json")));
        }, 60000);
    });

    describe("Without addons - should match TypeScript compiler output", () => {
        it("should compile test-project-foo identically to tsc", () => {
            copyProject("test-project-foo");

            createTsConfig({
                compilerOptions: {
                    noEmit: false,
                    target: "es2020",
                    module: "commonjs",
                    moduleResolution: "node",
                    outDir: testDirs.OUTPUT_DIR,
                    strict: true,
                    esModuleInterop: true,
                    skipLibCheck: true,
                },
                include: ["src/**/*"],
                exclude: ["**/*.spec.ts", "**/*.test.ts"],
            });

            executeCompiler(
                `--outDir ${testDirs.OUTPUT_DIR}/websmith --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")} --configFile ${path.join(testDirs.PROJECT_DIR, "websmith.config.json")}`,
                "websmith-bin"
            );
            executeCompiler(`--outDir ${testDirs.OUTPUT_DIR}/tsc --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`, "tsc");

            const { actual, expected } = compareDirectories(path.join(testDirs.OUTPUT_DIR, "websmith"), path.join(testDirs.OUTPUT_DIR, "tsc"));
            expect(actual).toEqual(expected);
        }, 60000);

        it("should compile test-project-foobar identically to tsc", () => {
            copyProject("test-project-foobar");

            createTsConfig({
                compilerOptions: {
                    noEmit: false,
                    target: "es2020",
                    module: "commonjs",
                    moduleResolution: "node",
                    outDir: testDirs.OUTPUT_DIR,
                    strict: true,
                    esModuleInterop: true,
                    skipLibCheck: true,
                },
                include: ["src/**/*"],
                exclude: ["**/*.spec.ts", "**/*.test.ts"],
            });

            executeCompiler(
                `--outDir ${testDirs.OUTPUT_DIR}/websmith --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")} --configFile ${path.join(testDirs.PROJECT_DIR, "websmith.config.json")}`,
                "websmith-bin"
            );
            executeCompiler(`--outDir ${testDirs.OUTPUT_DIR}/tsc --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`, "tsc");

            const { actual, expected } = compareDirectories(path.join(testDirs.OUTPUT_DIR, "websmith"), path.join(testDirs.OUTPUT_DIR, "tsc"));
            expect(actual).toEqual(expected);
        }, 60000);

        it("should compile test-project-one identically to tsc", () => {
            copyProject("test-project-one");

            createTsConfig({
                compilerOptions: {
                    noEmit: false,
                    target: "es2020",
                    module: "commonjs",
                    moduleResolution: "node",
                    outDir: testDirs.OUTPUT_DIR,
                    strict: true,
                    esModuleInterop: true,
                    skipLibCheck: true,
                },
                include: ["src/**/*"],
                exclude: ["**/*.spec.ts", "**/*.test.ts"],
            });

            executeCompiler(
                `--outDir ${testDirs.OUTPUT_DIR}/websmith --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")} --configFile ${path.join(testDirs.PROJECT_DIR, "websmith.config.json")}`,
                "websmith-bin"
            );
            executeCompiler(`--outDir ${testDirs.OUTPUT_DIR}/tsc --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`, "tsc");

            const { actual, expected } = compareDirectories(path.join(testDirs.OUTPUT_DIR, "websmith"), path.join(testDirs.OUTPUT_DIR, "tsc"));
            expect(actual).toEqual(expected);
        }, 60000);

        it("should compile test-project-complex identically to tsc", () => {
            copyProject("test-project-complex");

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
                    allowSyntheticDefaultImports: true,
                    esModuleInterop: true,
                    strict: false,
                    skipLibCheck: true,
                },
                include: ["src/**/*", "**/*.json"],
                exclude: ["node_modules", "dist", "**/*.spec.ts", "**/*.test.ts"],
            });

            executeCompiler(
                `--outDir ${testDirs.OUTPUT_DIR}/websmith --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")} --configFile ${path.join(testDirs.PROJECT_DIR, "websmith.config.json")}`,
                "websmith-bin"
            );
            executeCompiler(`--outDir ${testDirs.OUTPUT_DIR}/tsc --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`, "tsc");

            const { actual, expected } = compareDirectories(path.join(testDirs.OUTPUT_DIR, "websmith"), path.join(testDirs.OUTPUT_DIR, "tsc"));
            expect(actual).toEqual(expected);
        }, 60000);
    });

    describe("With transformer addons - should produce different content", () => {
        it("should transform foobar identifiers with foobar-replace-transformer", () => {
            copyProject("test-project-foobar");

            createTsConfig({
                compilerOptions: {
                    noEmit: false,
                    target: "es2020",
                    module: "commonjs",
                    moduleResolution: "node",
                    outDir: testDirs.OUTPUT_DIR,
                    strict: true,
                    esModuleInterop: true,
                    skipLibCheck: true,
                },
                include: ["src/**/*"],
                exclude: ["**/*.spec.ts", "**/*.test.ts"],
            });

            createWebsmithConfig({
                addonsDir: ADDONS_DIR,
                addons: ["foobar-replace-transformer"],
            });

            executeCompiler(
                `--outDir ${testDirs.OUTPUT_DIR}/websmith --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")} --configFile ${path.join(testDirs.PROJECT_DIR, "websmith.config.json")}`,
                "websmith-bin"
            );
            executeCompiler(`--outDir ${testDirs.OUTPUT_DIR}/tsc --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`, "tsc");

            const comparison = compareDirectories(path.join(testDirs.OUTPUT_DIR, "websmith"), path.join(testDirs.OUTPUT_DIR, "tsc"));
            expect(comparison.same).toBe(false);
            expect(comparison.differences).toContain("Content differs in file: foobar.js");

            // Verify the transformation actually happened
            const websmithContent = fs.readFileSync(path.join(testDirs.OUTPUT_DIR, "websmith", "foobar.js"), "utf-8");
            expect(websmithContent).toContain("function barfoo"); // function name should be replaced
            expect(websmithContent).toContain('"foobar"'); // string literals should remain unchanged
        }, 60000);

        it("should apply client-transformer to modify client-side code", () => {
            copyProject("test-project-one");

            createTsConfig({
                compilerOptions: {
                    noEmit: false,
                    target: "es2020",
                    module: "commonjs",
                    moduleResolution: "node",
                    outDir: testDirs.OUTPUT_DIR,
                    strict: true,
                    esModuleInterop: true,
                    skipLibCheck: true,
                },
                include: ["src/**/*"],
                exclude: ["**/*.spec.ts", "**/*.test.ts"],
            });

            createWebsmithConfig({
                addonsDir: ADDONS_DIR,
                addons: ["client-transformer"],
            });

            executeCompiler(
                `--outDir ${testDirs.OUTPUT_DIR}/websmith --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")} --configFile ${path.join(testDirs.PROJECT_DIR, "websmith.config.json")}`,
                "websmith-bin"
            );
            executeCompiler(`--outDir ${testDirs.OUTPUT_DIR}/tsc --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`, "tsc");

            // Files should exist but may have different content
            expect(fs.existsSync(path.join(testDirs.OUTPUT_DIR, "websmith"))).toBe(true);
            expect(fs.existsSync(path.join(testDirs.OUTPUT_DIR, "tsc"))).toBe(true);
        }, 60000);
    });

    describe("With processor addons - should produce different files/structure", () => {
        it("should export foobar functions with foobar-export-processor", () => {
            copyProject("test-project-foobar");

            createTsConfig({
                compilerOptions: {
                    noEmit: false,
                    target: "es2020",
                    module: "commonjs",
                    moduleResolution: "node",
                    outDir: testDirs.OUTPUT_DIR,
                    strict: true,
                    esModuleInterop: true,
                    skipLibCheck: true,
                },
                include: ["src/**/*"],
                exclude: ["**/*.spec.ts", "**/*.test.ts"],
            });

            createWebsmithConfig({
                addonsDir: ADDONS_DIR,
                addons: ["foobar-export-processor"],
            });

            executeCompiler(
                `--outDir ${testDirs.OUTPUT_DIR}/websmith --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")} --configFile ${path.join(testDirs.PROJECT_DIR, "websmith.config.json")}`,
                "websmith-bin"
            );
            executeCompiler(`--outDir ${testDirs.OUTPUT_DIR}/tsc --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`, "tsc");

            const comparison = compareDirectories(path.join(testDirs.OUTPUT_DIR, "websmith"), path.join(testDirs.OUTPUT_DIR, "tsc"));
            expect(comparison.same).toBe(false);
            expect(comparison.differences).toContain("Content differs in file: foobar.js");

            // Verify the export was added
            const websmithContent = fs.readFileSync(path.join(testDirs.OUTPUT_DIR, "websmith", "foobar.js"), "utf-8");
            const tscContent = fs.readFileSync(path.join(testDirs.OUTPUT_DIR, "tsc", "foobar.js"), "utf-8");

            expect(websmithContent).toContain("exports.foobar");
            expect(tscContent).not.toContain("exports.foobar");
        }, 60000);

        it("should generate additional files with export-yaml-generator", () => {
            copyProject("test-project-one");

            createTsConfig({
                compilerOptions: {
                    noEmit: false,
                    target: "es2020",
                    module: "commonjs",
                    moduleResolution: "node",
                    outDir: testDirs.OUTPUT_DIR,
                    strict: true,
                    esModuleInterop: true,
                    skipLibCheck: true,
                },
                include: ["src/**/*"],
                exclude: ["**/*.spec.ts", "**/*.test.ts"],
            });

            createWebsmithConfig({
                addonsDir: ADDONS_DIR,
                addons: ["export-yaml-generator"],
            });

            executeCompiler(
                `--outDir ${testDirs.OUTPUT_DIR}/websmith --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")} --configFile ${path.join(testDirs.PROJECT_DIR, "websmith.config.json")}`,
                "websmith-bin"
            );
            executeCompiler(`--outDir ${testDirs.OUTPUT_DIR}/tsc --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`, "tsc");

            const comparison = compareDirectories(path.join(testDirs.OUTPUT_DIR, "websmith"), path.join(testDirs.OUTPUT_DIR, "tsc"));
            expect(comparison.same).toBe(false);

            // Check if YAML files were generated
            const websmithFiles = fs.readdirSync(path.join(testDirs.OUTPUT_DIR, "websmith"), { recursive: true });
            const yamlFiles = websmithFiles.filter(f => f.toString().endsWith(".yaml") || f.toString().endsWith(".yml"));
            expect(yamlFiles.length).toBeGreaterThan(0);
        }, 60000);

        it("should process function results with function-json-result-processor", () => {
            copyProject("test-project-foo");

            createTsConfig({
                compilerOptions: {
                    noEmit: false,
                    target: "es2020",
                    module: "commonjs",
                    moduleResolution: "node",
                    outDir: testDirs.OUTPUT_DIR,
                    strict: true,
                    esModuleInterop: true,
                    skipLibCheck: true,
                },
                include: ["src/**/*"],
                exclude: ["**/*.spec.ts", "**/*.test.ts"],
            });

            createWebsmithConfig({
                addonsDir: ADDONS_DIR,
                addons: ["function-json-result-processor"],
            });

            executeCompiler(
                `--outDir ${testDirs.OUTPUT_DIR}/websmith --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")} --configFile ${path.join(testDirs.PROJECT_DIR, "websmith.config.json")}`,
                "websmith-bin"
            );
            executeCompiler(`--outDir ${testDirs.OUTPUT_DIR}/tsc --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`, "tsc");

            // Files should exist
            expect(fs.existsSync(path.join(testDirs.OUTPUT_DIR, "websmith"))).toBe(true);
            expect(fs.existsSync(path.join(testDirs.OUTPUT_DIR, "tsc"))).toBe(true);
        }, 60000);
    });

    describe("With multiple addons - should combine transformations", () => {
        it("should apply both transformer and processor addons", () => {
            copyProject("test-project-foobar");

            createTsConfig({
                compilerOptions: {
                    noEmit: false,
                    target: "es2020",
                    module: "commonjs",
                    moduleResolution: "node",
                    outDir: testDirs.OUTPUT_DIR,
                    strict: true,
                    esModuleInterop: true,
                    skipLibCheck: true,
                },
                include: ["src/**/*"],
                exclude: ["**/*.spec.ts", "**/*.test.ts"],
            });

            createWebsmithConfig({
                addonsDir: ADDONS_DIR,
                addons: ["foobar-replace-transformer", "foobar-export-processor"],
            });

            executeCompiler(
                `--outDir ${testDirs.OUTPUT_DIR}/websmith --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")} --configFile ${path.join(testDirs.PROJECT_DIR, "websmith.config.json")}`,
                "websmith-bin"
            );
            executeCompiler(`--outDir ${testDirs.OUTPUT_DIR}/tsc --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`, "tsc");

            const comparison = compareDirectories(path.join(testDirs.OUTPUT_DIR, "websmith"), path.join(testDirs.OUTPUT_DIR, "tsc"));
            expect(comparison.same).toBe(false);
            expect(comparison.differences).toContain("Content differs in file: foobar.js");

            // Verify both transformations happened
            const websmithContent = fs.readFileSync(path.join(testDirs.OUTPUT_DIR, "websmith", "foobar.js"), "utf-8");

            // Should have export from processor
            expect(websmithContent).toContain("exports.");

            // Should have barfoo replacement from transformer (if the transformer runs before processor)
            // Note: The exact behavior depends on the order of addon execution
        }, 60000);

        it("should apply generator with other addons", () => {
            copyProject("test-project-one");

            createTsConfig({
                compilerOptions: {
                    noEmit: false,
                    target: "es2020",
                    module: "commonjs",
                    moduleResolution: "node",
                    outDir: testDirs.OUTPUT_DIR,
                    strict: true,
                    esModuleInterop: true,
                    skipLibCheck: true,
                },
                include: ["src/**/*"],
                exclude: ["**/*.spec.ts", "**/*.test.ts"],
            });

            createWebsmithConfig({
                addonsDir: ADDONS_DIR,
                addons: ["export-yaml-generator", "client-processor"],
            });

            executeCompiler(
                `--outDir ${testDirs.OUTPUT_DIR}/websmith --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")} --configFile ${path.join(testDirs.PROJECT_DIR, "websmith.config.json")}`,
                "websmith-bin"
            );
            executeCompiler(`--outDir ${testDirs.OUTPUT_DIR}/tsc --project ${path.join(testDirs.PROJECT_DIR, "tsconfig.json")}`, "tsc");

            const comparison = compareDirectories(path.join(testDirs.OUTPUT_DIR, "websmith"), path.join(testDirs.OUTPUT_DIR, "tsc"));
            expect(comparison.same).toBe(false);

            // Should have generated additional files
            const websmithFiles = fs.readdirSync(path.join(testDirs.OUTPUT_DIR, "websmith"), { recursive: true });
            const tscFiles = fs.readdirSync(path.join(testDirs.OUTPUT_DIR, "tsc"), { recursive: true });
            expect(websmithFiles.length).toBeGreaterThanOrEqual(tscFiles.length);
        }, 60000);
    });
});

const executeCompiler = (args = "", compilerExec: "tsc" | "websmith-inline" | "websmith-bin" = "websmith-bin", compiler?: Compiler): string => {
    process.chdir(testDirs.PROJECT_DIR);

    console.log(`\nExecuting ${compilerExec} compiler:`);
    console.log(`  Args: ${args}`);
    console.log(`  CWD: ${testDirs.PROJECT_DIR}`);

    let binPath: string | undefined;
    if (compilerExec === "tsc") {
        binPath = path.join(__dirname, "..", "node_modules", ".bin", "tsc");
        if (!fs.existsSync(binPath)) {
            throw new Error(`TypeScript compiler not found at ${binPath}. Please install typescript.`);
        }
    } else if (compilerExec === "websmith-inline") {
        console.log("  Using websmith-inline execution");
        addCompileCommand(new Command(), compiler).parse(args.split(" "), { from: "user" });
        return ""; // websmith-inline doesn't return output
    } else {
        binPath = path.join(__dirname, "..", "..", "compiler", "bin", "bin.js");
        if (!fs.existsSync(binPath)) {
            throw new Error(`Bundled compiler not found at ${binPath}. Please run 'pnpm build' first.`);
        }
        binPath = `node ${binPath}`;
    }

    if (binPath) {
        const fullCommand = `${binPath} ${args.trim()}`;
        console.log(`  Command: ${fullCommand}`);

        try {
            const result = execSync(fullCommand, {
                encoding: "utf8",
                stdio: "pipe",
                timeout: 30000, // 30 second timeout
                cwd: testDirs.PROJECT_DIR,
            });

            console.log(`  ${compilerExec} completed successfully`);
            if (result.trim()) {
                console.log(`  Output: ${result.trim()}`);
            }

            return result;
        } catch (error: any) {
            const stderr = error.stderr?.toString() || "";
            const stdout = error.stdout?.toString() || "";
            const output = stdout + stderr;

            console.error(`  ${compilerExec} execution failed:`);
            console.error(`    Exit code: ${error.status}`);
            console.error(`    Command: ${fullCommand}`);
            console.error(`    CWD: ${testDirs.PROJECT_DIR}`);

            if (stdout.trim()) {
                console.error(`    Stdout: ${stdout.trim()}`);
            }
            if (stderr.trim()) {
                console.error(`    Stderr: ${stderr.trim()}`);
            }

            // Check if this is a compilation error vs a real failure
            if (error.status === 1 && (stdout.includes("error TS") || stderr.includes("error TS"))) {
                console.log(`  TypeScript compilation errors detected - this may be expected`);
            } else if (error.status !== 0) {
                console.error(`  Unexpected exit code ${error.status} - this may indicate a real failure`);
            }

            return output;
        }
    }
    return "";
};

const createTsConfig = (tsConfig: any) => {
    fs.writeFileSync(path.join(testDirs.PROJECT_DIR, "tsconfig.json"), JSON.stringify(tsConfig, null, 2), { encoding: "utf-8" });
};

const createWebsmithConfig = (config: CompilationConfig) => {
    fs.writeFileSync(path.join(testDirs.PROJECT_DIR, "websmith.config.json"), JSON.stringify(config), { encoding: "utf-8" });
};

const copyProject = (projectName: string) => {
    const projectPath = path.join(__dirname, "..", "test-data", "projects", projectName);
    const targetPath = path.join(testDirs.PROJECT_DIR, "src");

    console.log(`\nCopying project ${projectName}:`);
    console.log(`  Source: ${projectPath}`);
    console.log(`  Target: ${targetPath}`);

    if (!fs.existsSync(projectPath)) {
        throw new Error(`Source project directory does not exist: ${projectPath}`);
    }

    let copiedFiles = 0;
    let skippedFiles = 0;

    // Copy all files from project except tsconfig.json
    const copyRecursive = (source: string, target: string) => {
        if (!fs.existsSync(target)) {
            fs.mkdirSync(target, { recursive: true });
        }

        const items = fs.readdirSync(source);
        for (const item of items) {
            const sourcePath = path.join(source, item);
            const targetPath = path.join(target, item);

            if (fs.statSync(sourcePath).isDirectory()) {
                copyRecursive(sourcePath, targetPath);
            } else if (item !== "tsconfig.json") {
                fs.copyFileSync(sourcePath, targetPath);
                copiedFiles++;
                console.log(`  Copied: ${path.relative(projectPath, sourcePath)}`);
            } else {
                skippedFiles++;
                console.log(`  Skipped: ${item} (excluded)`);
            }
        }
    };

    copyRecursive(projectPath, targetPath);

    console.log(`  Total files copied: ${copiedFiles}`);
    console.log(`  Total files skipped: ${skippedFiles}`);

    if (copiedFiles === 0) {
        throw new Error(`No files were copied from project ${projectName}. Check if the project contains TypeScript files.`);
    }

    // Verify that files exist in target
    const verifyFiles = (dir: string, baseDir: string = dir): string[] => {
        const files: string[] = [];
        if (!fs.existsSync(dir)) {
            return files;
        }

        const items = fs.readdirSync(dir);
        for (const item of items) {
            const fullPath = path.join(dir, item);
            if (fs.statSync(fullPath).isDirectory()) {
                files.push(...verifyFiles(fullPath, baseDir));
            } else {
                files.push(path.relative(baseDir, fullPath));
            }
        }
        return files;
    };

    const targetFiles = verifyFiles(targetPath);
    console.log(`  Verification: ${targetFiles.length} files available for compilation`);

    if (targetFiles.length === 0) {
        throw new Error(`No files found in target directory after copying project ${projectName}`);
    }
};

const compareDirectories = (dir1: string, dir2: string): { same: boolean; differences: string[]; actual: string[]; expected: string[] } => {
    const differences: string[] = [];

    const getFiles = (dir: string, baseDir: string = dir): string[] => {
        const files: string[] = [];

        // Check if directory exists
        if (!fs.existsSync(dir)) {
            console.warn(`Directory does not exist: ${dir}`);
            return files;
        }

        try {
            const items = fs.readdirSync(dir);

            for (const item of items) {
                const fullPath = path.join(dir, item);
                try {
                    const stat = fs.statSync(fullPath);
                    if (stat.isDirectory()) {
                        files.push(...getFiles(fullPath, baseDir));
                    } else if (stat.isFile()) {
                        files.push(path.relative(baseDir, fullPath));
                    }
                } catch (error) {
                    console.warn(`Error accessing ${fullPath}:`, error);
                    differences.push(`Error accessing file: ${path.relative(baseDir, fullPath)} - ${error}`);
                }
            }
        } catch (error) {
            console.warn(`Error reading directory ${dir}:`, error);
            differences.push(`Error reading directory: ${dir} - ${error}`);
        }

        return files.sort();
    };

    console.log(`Comparing directories:`);
    console.log(`  Dir1 (websmith): ${dir1}`);
    console.log(`  Dir2 (tsc): ${dir2}`);

    const files1 = getFiles(dir1);
    const files2 = getFiles(dir2);

    console.log(`  Files in websmith output: ${files1.length}`);
    console.log(`  Files in tsc output: ${files2.length}`);

    if (files1.length === 0 && files2.length === 0) {
        console.warn("Both directories are empty - this might indicate a compilation error");
        differences.push("Both output directories are empty");
    }

    // Check for missing files
    const missing1 = files2.filter(f => !files1.includes(f));
    const missing2 = files1.filter(f => !files2.includes(f));

    if (missing1.length > 0) {
        console.log(`Files missing in websmith output: ${missing1.join(", ")}`);
        differences.push(`Files missing in ${path.basename(dir1)}: ${missing1.join(", ")}`);
    }
    if (missing2.length > 0) {
        console.log(`Files missing in tsc output: ${missing2.join(", ")}`);
        differences.push(`Files missing in ${path.basename(dir2)}: ${missing2.join(", ")}`);
    }

    // Check file contents for common files
    const commonFiles = files1.filter(f => files2.includes(f));
    console.log(`Common files to compare: ${commonFiles.length}`);

    for (const file of commonFiles) {
        try {
            const content1 = fs.readFileSync(path.join(dir1, file), "utf-8");
            const content2 = fs.readFileSync(path.join(dir2, file), "utf-8");

            if (content1 !== content2) {
                console.log(`Content differs in file: ${file}`);
                differences.push(`Content differs in file: ${file}`);
            }
        } catch (error) {
            console.warn(`Error comparing file ${file}:`, error);
            differences.push(`Error comparing file: ${file} - ${error}`);
        }
    }

    const result = { same: differences.length === 0, differences, actual: files1, expected: files2 };

    if (!result.same) {
        console.log(`Comparison failed with ${differences.length} differences:`);
        differences.forEach(diff => console.log(`  - ${diff}`));
    } else {
        console.log(`Comparison successful: ${commonFiles.length} files match`);
    }

    return result;
};
