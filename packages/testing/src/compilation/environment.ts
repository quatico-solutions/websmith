/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type CompilerOptions, ErrorMessage } from "@quatico/websmith-api";
import {
    type AddonConfig,
    AddonRegistry,
    type BrowserSystemOptions,
    Compiler,
    type CompilerAddon,
    type CompilerAddons,
    DefaultReporter,
    type ResolvedCompilerOptions,
    compilerAddons,
    createBrowserSystem,
    resolveCompilerOptions,
    resolvePath,
} from "@quatico/websmith-core";
import fs from "node:fs";
import { Module } from "node:module";
import path from "node:path";
import requireFromString from "require-from-string";
import ts from "typescript";
import { copyDirectory } from "./copy-directory";

const DEFAULT_ROOT_DIR = "./";
const DEFAULT_SRC_DIR = path.join(DEFAULT_ROOT_DIR, "src");
const DEFAULT_OUT_DIR = path.join(DEFAULT_ROOT_DIR, "dist");
const DEFAULT_PROJECTS_SOURCE_DIR = "../test-projects";
const DEFAULT_ADDONS_SOURCE_DIR = "../addons";

export class CompilationEnv {
    private compilerOptions: ResolvedCompilerOptions;
    private rootDir: string;
    private srcDir: string;
    private system: ts.System;
    private virtual: boolean;
    private addons?: AddonRegistry;
    private addonsConfig: AddonConfig;

    constructor(rootDir?: string, options?: Partial<CompilationOptions>, addonConfig?: Partial<AddonConfig>) {
        const { tsConfigFile, tsConfig, virtual = true, useCaseSensitiveFileNames, addLibDefaults, fileWatcher, reporter } = options ?? {};
        const sourceDir = tsConfigFile ? path.dirname(tsConfigFile) : (tsConfig?.project ?? DEFAULT_SRC_DIR);
        this.virtual = virtual;
        this.system = this.virtual ? createBrowserSystem(undefined, { useCaseSensitiveFileNames, addLibDefaults, fileWatcher }) : ts.sys;
        this.rootDir = resolvePath(this.system, rootDir ?? DEFAULT_ROOT_DIR);
        this.srcDir = resolvePath(this.system, this.rootDir, sourceDir);
        const configFilePath = `${this.rootDir}/tsconfig.json`;
        this.compilerOptions = resolveCompilerOptions(this.system, {
            tsConfigFile: configFilePath,
            reporter,
            ...options,
            tsConfig: {
                ...options?.tsConfig,
                // Add smoother tsconfig defaults for testing purposes
                target: ts.ScriptTarget.ESNext,
                declaration: true,
                outDir: resolvePath(this.system, this.rootDir, options?.tsConfig?.outDir ?? DEFAULT_OUT_DIR),
            },
            config: {
                ...(options?.config ?? {}),
                ...(addonConfig?.addons && { addons: addonConfig.addons }),
                ...(addonConfig?.addonsDir && { addonsDir: addonConfig.addonsDir }),
            },
        });
        const resolvedOutDir = this.compilerOptions.tsConfig!.outDir!;

        if (this.system.directoryExists(this.rootDir)) {
            this.deleteDirectory(this.rootDir);
        }
        if (!this.system.directoryExists(this.rootDir)) {
            getSubPaths(this.rootDir).forEach(it => !!it && !this.system.directoryExists(it) && this.system.createDirectory(it));
        }

        this.system.getCurrentDirectory = () => this.rootDir;

        if (!this.system.directoryExists(this.srcDir)) {
            this.system.createDirectory(this.srcDir);
        }

        if (!this.system.directoryExists(resolvedOutDir)) {
            this.system.createDirectory(resolvedOutDir);
        }

        if (!this.system.fileExists(configFilePath)) {
            this.system.writeFile(
                configFilePath,
                JSON.stringify({
                    compilerOptions: {
                        outDir: resolvedOutDir,
                        target: "ESNext",
                        module: "ESNext",
                        esModuleInterop: true,
                    },
                    include: [`${this.srcDir}/**/*.ts`, `${this.srcDir}/**/*.tsx`],
                    exclude: ["node_modules", resolvedOutDir],
                })
            );
        }

        this.addonsConfig = {
            addonsDir: resolvePath(this.system, this.rootDir, "./addons"),
            reporter: reporter ?? new DefaultReporter(this.system),
            system: this.system,
            ...(addonConfig ?? {}),
        };
        if (this.addonsConfig.addonsDir && !this.system.directoryExists(this.addonsConfig.addonsDir)) {
            this.system.createDirectory(this.addonsConfig.addonsDir);
        }
    }

    /**
     * The working directory where project configuration files are stored.
     *
     * @returns absolute path to the working directory, defaults to "/".
     */
    public getRootDir(): string {
        return this.rootDir;
    }

    public getSourceDir(): string {
        return this.srcDir;
    }

    public getCompilerOptions(): ResolvedCompilerOptions {
        return this.compilerOptions;
    }

    public getSystem(): ts.System {
        return this.system;
    }

    public isVirtual(): boolean {
        return this.virtual;
    }

    public cleanUp(options: "project" | "addons" | "all" = "all"): this {
        let directories = [];
        switch (options) {
            case "all":
                directories = [this.rootDir];
                break;
            case "project":
                directories = [this.srcDir, this.getOutputDir()];
                break;
            case "addons":
                directories = [this.addonsConfig.addonsDir];
                break;
        }
        directories.forEach(dir => this.deleteDirectory(dir));
        this.compilerOptions.cliArgs.fileNames = [];
        return this;
    }

    /**
     * The directory where active addons are moved to, for customizing the compilation.
     *
     * @returns absolute path to the addons directory, defaults to `${this.rootDir}/addons`
     */
    public getAddonsDir(): string | undefined {
        return this.addonsConfig.addonsDir;
    }

    public getActiveAddon(addonName: string): CompilerAddon | undefined {
        return this.addons?.getAvailableAddons().find((it: CompilerAddon) => it.getName() === addonName);
    }

    public getActiveAddons(profile?: string): CompilerAddons {
        return this.addons?.getAvailableAddons(profile) ?? compilerAddons([]);
    }

    /**
     * Installs addon source code from `addonsSourceDir` or provided `source` parameter into
     * the addons directory, i.e. `${this.rootDir}/addons`. It compiles the addon source code
     * and refreshes the addons registry to activate it.
     *
     * @param addonName directory name of the addon
     * @param addonSource optional source files or path to the source directory to install
     * @returns this instance
     */
    public addAddon(addonName: string, addonSource?: string | Record<string, string>): this {
        if (!this.addonsConfig.addonsDir) {
            this.compilerOptions.reporter.reportDiagnostic(new ErrorMessage(`Cannot add addon without a specified "addonsDir".`));

            return this;
        }
        const addonTargetPath = path.join(this.addonsConfig.addonsDir, addonName);
        let addonImportDir = path.join(this.rootDir, addonName);

        if (!this.system.directoryExists(addonTargetPath)) {
            this.system.createDirectory(addonTargetPath);
        }
        if (isFiles(addonSource)) {
            this.addFiles(this.resolveAddonSourcePaths(addonName, addonSource, addonTargetPath));
        } else {
            const addonsSourceDir = resolvePath(this.system, this.rootDir, path.join(addonSource ?? DEFAULT_ADDONS_SOURCE_DIR, addonName));
            const sourceFs = this.system.directoryExists(addonsSourceDir) ? this.system : ts.sys;
            copyDirectory({ system: sourceFs, path: addonsSourceDir, kind: "addons" }, { system: this.system, path: addonTargetPath });
            addonImportDir = addonsSourceDir;
        }

        this.compileAddons(addonImportDir, this.addonsConfig.addonsDir);

        if (!this.addonsConfig.addons) {
            this.addonsConfig.addons = [addonName];
        } else {
            this.addonsConfig.addons.push(addonName);
        }
        this.getOrCreateAddonRegistry().setConfig(this.addonsConfig).refresh();

        return this;
    }

    public addAddons(addonNames: string[], addonsSourceDir?: string): this {
        const addonsDir = this.addonsConfig.addonsDir;
        if (!addonsDir) {
            this.compilerOptions.reporter.reportDiagnostic(new ErrorMessage(`Cannot add addons to the environment without a specified "addonsDir".`));
            return this;
        }
        const addonsSourceDirPath = resolvePath(this.system, this.rootDir, addonsSourceDir ?? DEFAULT_ADDONS_SOURCE_DIR);
        const sourceFs = this.system.directoryExists(addonsSourceDirPath) ? this.system : ts.sys;
        addonNames.forEach(addon => {
            copyDirectory(
                { system: sourceFs, path: path.join(addonsSourceDirPath, addon), kind: "addons" },
                { system: this.system, path: path.join(addonsDir, addon) }
            );
        });
        this.compileAddons(addonsSourceDirPath, addonsDir);
        if (!this.addonsConfig.addons) {
            this.addonsConfig.addons = [...addonNames];
        } else {
            this.addonsConfig.addons.push(...addonNames);
        }
        this.getOrCreateAddonRegistry().setConfig(this.addonsConfig).refresh();

        return this;
    }

    /**
     * Installs project source code from provided `source` parameter into the
     * build directory, i.e. `this.buildDir`.
     *
     * @param source optional source files to install
     * @returns this instance
     */
    public addProjectFromSource(source: Record<string, string>): this {
        this.addFiles(
            Object.entries(source).reduce((acc: Record<string, string>, [filePath, content]) => {
                acc[resolvePath(this.system, this.srcDir, filePath)] = content;
                return acc;
            }, {})
        );
        return this;
    }

    /**
     * Installs project source code form default `projectsSourceDir` or provided `projectsSourceDir` parameter into the
     * build directory, i.e. `this.buildDir`.
     *
     * @param projectName name of the project directory to install
     * @param projectsSourceDir optional path to the source directory to install
     * @returns this instance
     */
    public addProjectFromDisk(projectName: string, projectsSourceDir?: string): this {
        const projectsSourcePath = resolvePath(this.system, this.rootDir, projectsSourceDir ?? DEFAULT_PROJECTS_SOURCE_DIR);
        const sourceFs = this.system.directoryExists(projectsSourcePath) ? this.system : ts.sys;
        copyDirectory(
            { system: sourceFs, path: path.join(projectsSourcePath, projectName), kind: "project" },
            // use rootDir as target path because we copy src and other files from project directory
            { system: this.system, path: this.rootDir }
        );
        this.compilerOptions.cliArgs.fileNames = this.system.readDirectory(this.srcDir).filter(isSourceFile);

        return this;
    }

    public addProjectFile(relativePath: string, content: string): this {
        this.addFile(resolvePath(this.system, this.rootDir, relativePath), content);
        return this;
    }

    public getProjectFiles(relativePath?: string): ProjectFiles {
        const targetDir = relativePath ? resolvePath(this.system, this.rootDir, relativePath) : this.rootDir;
        return projectFiles(this.system.readDirectory(targetDir).map(it => projectFile(this.system, this.rootDir, it)));
    }

    public getProjectFile(filePath: string): ProjectFile | undefined {
        const file = this.system.readDirectory(this.rootDir).find(it => it.endsWith(filePath));
        return file ? projectFile(this.system, this.rootDir, file) : undefined;
    }

    public addSourceFile(relativePath: string, content: string): this {
        this.addFile(resolvePath(this.system, this.srcDir, relativePath), content);
        return this;
    }

    public getSourceFiles(relativePath?: string): ProjectFiles {
        const targetDir = relativePath ? resolvePath(this.system, this.srcDir, relativePath) : this.srcDir;
        return projectFiles(this.system.readDirectory(targetDir).map(it => projectFile(this.system, this.srcDir, it)));
    }

    public getSourceFile(filePath: string): ProjectFile | undefined {
        const file = this.system.readDirectory(this.srcDir).find(it => it.endsWith(filePath));
        return file ? projectFile(this.system, this.srcDir, file) : undefined;
    }

    public compile(): CompilationResult {
        const result = new Compiler(this.compilerOptions, undefined, this.system, this.getOrCreateAddonRegistry()).compile();
        return {
            getSourceDir: () => this.srcDir,
            getOutputDir: () => this.getOutputDir(),
            getCompiledFiles: () => this.getCompiledFiles(),
            getCompiledFile: (filePath: string) => this.getCompiledFile(filePath),
            getDiagnostics: () => result.diagnostics ?? [],
            hasEmitSkipped: () => result.emitSkipped ?? false,
            getEmittedFiles: () => result.emittedFiles ?? [],
            hasFailures: () => result.diagnostics.some((it: ts.Diagnostic) => it.category === ts.DiagnosticCategory.Error),
            getFailureReport: (filter?: string) => {
                const report = ts.formatDiagnostics(result?.diagnostics ?? [], {
                    getCanonicalFileName: (path: string) => path,
                    getCurrentDirectory: () => this.system.getCurrentDirectory(),
                    getNewLine: () => this.system.newLine,
                });
                return filter
                    ? report
                          .split("\n")
                          .filter(it => it.includes(filter))
                          .join("\n")
                    : report;
            },
        };
    }

    public getOutputDir(): string {
        return this.compilerOptions.tsConfig!.outDir!;
    }

    public getCompiledFiles(relativePath?: string): ProjectFiles {
        const targetDir = relativePath ? resolvePath(this.system, this.rootDir, relativePath) : this.getOutputDir();
        return projectFiles(this.system.readDirectory(targetDir).map(it => projectFile(this.getSystem(), this.srcDir, it)));
    }

    public getCompiledFile(filePath: string): ProjectFile | undefined {
        const file = this.system.readDirectory(this.getOutputDir()).find(it => it.endsWith(filePath));
        return file ? projectFile(this.system, this.srcDir, file) : undefined;
    }

    private getOrCreateAddonRegistry(): AddonRegistry {
        if (!this.addons) {
            this.addons = new AddonRegistry(this.addonsConfig);
        }
        return this.addons.setConfig(this.addonsConfig);
    }

    private resolveAddonSourcePaths(addonName: string, addonFiles: Record<string, string>, addonTargetPath: string): Record<string, string> {
        const { addonsDir } = this.addonsConfig;

        if (!addonsDir) {
            this.compilerOptions.reporter.reportDiagnostic(new ErrorMessage(`Cannot resolve addon source path with no "addonsDir" specified.`));
            return {};
        }

        return Object.entries(addonFiles).reduce((acc: Record<string, string>, [filePath, content]) => {
            if (path.isAbsolute(filePath)) {
                acc[filePath] = content;
            } else {
                if (filePath.includes(addonName)) {
                    acc[path.join(addonsDir, filePath)] = content;
                } else {
                    acc[path.join(addonTargetPath, filePath)] = content;
                }
            }
            return acc;
        }, {});
    }

    private compileAddons(addonsSourceDir: string, addonsTargetDir: string) {
        const addonsToCompile = this.system
            .readDirectory(addonsTargetDir)
            .filter(isSourceFile)
            .map(it => path.dirname(it))
            .filter((item, pos, self) => self.indexOf(item) == pos);

        addonsToCompile.forEach(curDir => {
            try {
                new Compiler(
                    {
                        ...resolveCompilerOptions(this.system, {}),
                        tsConfig: {
                            module: ts.ModuleKind.CommonJS,
                            target: ts.ScriptTarget.ES5,
                            esModuleInterop: true,
                            moduleResolution: ts.ModuleResolutionKind.Node10,
                            types: ["node"],
                            skipLibCheck: true,
                        },
                        cliArgs: { fileNames: this.system.readDirectory(curDir).filter(isSourceFile), options: {}, errors: [] },
                    },
                    {},
                    this.system
                ).compile();
            } catch (error) {
                // Handle file system errors gracefully for invalid addons
                this.compilerOptions.reporter.reportDiagnostic(
                    new ErrorMessage(`Failed to compile addon in ${curDir}: ${error instanceof Error ? error.message : String(error)}`)
                );
            }
        });

        if (this.virtual) {
            this.system
                .readDirectory(addonsTargetDir, [".js", ".jsx"])
                .map(filePath => this.system.resolvePath(filePath))
                .forEach(resolvedPath => {
                    jest.mock(
                        path.basename(resolvedPath, path.extname(resolvedPath)) === "addon"
                            ? resolvedPath.replace(path.extname(resolvedPath), "")
                            : `./${path.basename(resolvedPath, path.extname(resolvedPath))}`,
                        () =>
                            requireFromString(this.system.readFile(resolvedPath)!, resolvedPath, {
                                prependPaths: [path.dirname(resolvedPath), addonsTargetDir],
                                // @ts-expect-error - nodeModulePaths is not part of the original object
                                appendPaths: Module._nodeModulePaths(path.dirname(addonsSourceDir)),
                            }),
                        { virtual: true }
                    );
                });
        }
    }

    private addFiles(files?: Record<string, string>): void {
        if (!files) {
            return;
        }
        Object.keys(files).forEach(file => {
            this.addFile(file, files[file]);
        });
    }

    private addFile(filePath: string, content: string): void {
        if (!path.isAbsolute(filePath)) {
            filePath = resolvePath(this.system, this.srcDir, filePath);
        }
        this.system.writeFile(filePath, content);
        if (isSourceFile(filePath)) {
            this.compilerOptions.cliArgs.fileNames.push(filePath);
        }
    }

    private deleteDirectory(dirPath?: string): void {
        if (!dirPath) {
            return;
        }
        if (this.virtual) {
            this.system.readDirectory(dirPath).forEach((it: string) => this.system.deleteFile!(it));
        } else {
            fs.rmSync(dirPath, { recursive: true, force: true });
        }
    }
}

export type CompilationResult = {
    getSourceDir: () => string;
    getOutputDir: () => string;
    getCompiledFiles: () => ProjectFiles;
    getCompiledFile: (filePath: string) => ProjectFile | undefined;
    hasEmitSkipped: () => boolean;
    getEmittedFiles: () => string[];
    hasFailures: () => boolean;
    getFailureReport: (filter?: string) => string;
    getDiagnostics: () => readonly ts.Diagnostic[];
};

export type CompilationOptions = BrowserSystemOptions &
    CompilerOptions & {
        buildDir?: string;
        files?: Record<string, string>;
        virtual?: boolean;
    };

export type ProjectFiles = ProjectFile[] & { getPaths: (substringPrefix?: string) => string[]; getContents: () => string[] };

export interface ProjectFile {
    getPath(): string;
    getContent(): string | undefined;
}

export const projectFile = (system: ts.System, buildDir: string, relativePath: string): ProjectFile => ({
    getPath: () => resolvePath(system, buildDir, relativePath),
    getContent: () => system.readFile(resolvePath(system, buildDir, relativePath)),
});

const isSourceFile = (filePath: string): boolean => filePath.endsWith(".ts") || filePath.endsWith(".tsx");

const isFiles = (source?: string | Record<string, string>): source is Record<string, string> => typeof source === "object";

const projectFiles = (result: ProjectFile[]): ProjectFiles => {
    return Object.assign(result, {
        getPaths: (substringPrefix?: string) =>
            result.map(it => {
                const curPath = it.getPath();
                return substringPrefix ? curPath.substring(curPath.indexOf(substringPrefix)) : curPath;
            }),
        getContents: () => result.map(it => it.getContent()!),
    });
};

const getSubPaths = (path: string): string[] => {
    const segments = path.split("/");
    return segments.map((_s, i) => segments.slice(0, i + 1).join("/"));
};

export const compilationEnv = (rootDir: string, options?: Partial<CompilationOptions>, addonConfig?: Partial<AddonConfig>): CompilationEnv =>
    new CompilationEnv(rootDir, options, addonConfig);
