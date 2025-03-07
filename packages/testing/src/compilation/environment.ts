/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import {
    type AddonConfig,
    AddonRegistry,
    type CompileSystemOptions,
    Compiler,
    type CompilerAddon,
    type CompilerAddons,
    type CompilerOptions,
    DefaultReporter,
    compilerAddons,
    createBrowserSystem,
    resolveCompilerOptions,
} from "@quatico/websmith-core";
import fs from "node:fs";
import { Module } from "node:module";
import path from "node:path";
import requireFromString from "require-from-string";
import ts from "typescript";
import { copyDirectory } from "./copy-directory";
import { resolvePath } from "./resolve-path";

const DEFAULT_ROOT_DIR = "/";
const DEFAULT_BUILD_DIR = "./src";
const DEFAULT_OUT_DIR = "./dist";
const DEFAULT_PROJECTS_SOURCE_DIR = "../test-projects";
const DEFAULT_ADDONS_SOURCE_DIR = "../addons";

export class CompilationEnv {
    private compilerOptions: CompilerOptions;
    private rootDir: string;
    private buildDir: string;
    private system: ts.System;
    private virtual: boolean;
    private addons?: AddonRegistry;
    private addonsConfig: AddonConfig;

    constructor(rootDir?: string, options?: Partial<CompilationOptions>, addonConfig?: Partial<AddonConfig>) {
        const { virtual = true, compilerOptions = {}, useCaseSensitiveFileNames, addLibDefaults, fileWatcher, reporter } = options ?? {};
        const buildDir = options?.compilerOptions?.buildDir ?? DEFAULT_BUILD_DIR;
        const outDir = options?.compilerOptions?.tsConfig?.outDir ?? DEFAULT_OUT_DIR;
        this.virtual = virtual;
        this.system = this.virtual ? createBrowserSystem(undefined, { useCaseSensitiveFileNames, addLibDefaults, fileWatcher }) : ts.sys;
        this.rootDir = resolvePath(this.system, rootDir ?? DEFAULT_ROOT_DIR);
        this.buildDir = resolvePath(this.system, this.rootDir, buildDir);
        const resolvedOutDir = resolvePath(this.system, this.rootDir, outDir);

        if (this.system.directoryExists(this.rootDir)) {
            this.deleteDirectory(this.rootDir);
        }
        if (!this.system.directoryExists(this.rootDir)) {
            getSubPaths(this.rootDir).forEach(it => !!it && !this.system.directoryExists(it) && this.system.createDirectory(it));
        }

        this.system.getCurrentDirectory = () => this.rootDir;

        if (!this.system.directoryExists(this.buildDir)) {
            this.system.createDirectory(this.buildDir);
        }

        if (!this.system.directoryExists(resolvedOutDir)) {
            this.system.createDirectory(resolvedOutDir);
        }

        const configFilePath = `${this.rootDir}/tsconfig.json`;

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
                    include: [`${this.buildDir}/**/*.ts`, `${this.buildDir}/**/*.tsx`],
                    exclude: [`node_modules`, resolvedOutDir],
                })
            );
        }

        // TODO: Resolve compiler options
        this.compilerOptions = resolveCompilerOptions(this.system, {
            ...compilerOptions,
            reporter,
            buildDir: this.rootDir,
            tsConfig: {
                configFilePath,
                ...(compilerOptions?.tsConfig ?? {}),
                outDir: resolvedOutDir,
            },
        });

        this.addonsConfig = {
            addonsDir: path.join(this.rootDir, "./addons"),
            reporter: reporter ?? new DefaultReporter(this.system),
            system: this.system,
            ...(addonConfig ?? {}),
        };
        if (!this.system.directoryExists(this.addonsConfig.addonsDir)) {
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

    public getOutDir(): string {
        return resolveProjectPath(this.system, this.rootDir, this.compilerOptions.tsConfig?.outDir ?? DEFAULT_OUT_DIR);
    }

    // TODO: Resolve compiler options
    public getCompilerOptions(): CompilerOptions {
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
                directories = [this.buildDir, this.getOutDir()];
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
        return this.addons?.getAvailableAddons("*").find((it: CompilerAddon) => it.getName() === addonName);
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
        const addonTargetPath = path.join(this.addonsConfig.addonsDir, addonName);
        let addonImportDir = path.join(this.rootDir, addonName);

        if (!this.system.directoryExists(addonTargetPath)) {
            this.system.createDirectory(addonTargetPath);
        }
        if (isFiles(addonSource)) {
            this.addFiles(this.resolveAddonSourcePaths(addonName, addonSource, addonTargetPath));
        } else {
            const addonsSourceDir = resolveProjectPath(this.system, this.rootDir, path.join(addonSource ?? DEFAULT_ADDONS_SOURCE_DIR, addonName));
            const sourceFs = this.system.directoryExists(addonsSourceDir) ? this.system : ts.sys;
            copyDirectory({ system: sourceFs, path: addonsSourceDir, kind: "addons" }, { system: this.system, path: addonTargetPath });
            addonImportDir = addonsSourceDir;
        }

        this.compileAddons(addonImportDir, this.addonsConfig.addonsDir);
        this.getOrCreateAddonRegistry().refresh();

        return this;
    }

    public addAddons(addonNames: string[], addonsSourceDir?: string): this {
        const addonsDir = this.addonsConfig.addonsDir;
        const addonsSourceDirPath = resolveProjectPath(this.system, this.rootDir, addonsSourceDir ?? DEFAULT_ADDONS_SOURCE_DIR);
        const sourceFs = this.system.directoryExists(addonsSourceDirPath) ? this.system : ts.sys;
        addonNames.forEach(addon => {
            copyDirectory(
                { system: sourceFs, path: path.join(addonsSourceDirPath, addon), kind: "addons" },
                { system: this.system, path: path.join(addonsDir, addon) }
            );
        });
        this.compileAddons(addonsSourceDirPath, addonsDir);
        this.getOrCreateAddonRegistry().refresh();

        return this;
    }

    public getProjectDir(): string {
        return this.buildDir;
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
                acc[resolveProjectPath(this.system, this.buildDir, filePath)] = content;
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
        const projectsSourcePath = resolveProjectPath(this.system, this.rootDir, projectsSourceDir ?? DEFAULT_PROJECTS_SOURCE_DIR);
        const sourceFs = this.system.directoryExists(projectsSourcePath) ? this.system : ts.sys;
        copyDirectory(
            { system: sourceFs, path: path.join(projectsSourcePath, projectName), kind: "project" },
            // use rootDir as target path because we copy src and other files from project directory
            { system: this.system, path: this.rootDir }
        );
        this.compilerOptions.cliArgs.fileNames = this.system.readDirectory(this.buildDir).filter(isSourceFile);

        return this;
    }

    public addProjectFile(relativePath: string, content: string): this {
        this.addFile(resolveProjectPath(this.system, this.rootDir, relativePath), content);
        return this;
    }

    public getProjectFiles(relativePath?: string): ProjectFiles {
        const targetDir = relativePath ? resolveProjectPath(this.system, this.rootDir, relativePath) : this.rootDir;
        return projectFiles(this.system.readDirectory(targetDir).map(it => projectFile(this.system, this.rootDir, it)));
    }

    public getProjectFile(filePath: string): ProjectFile | undefined {
        const file = this.system.readDirectory(this.rootDir).find(it => it.endsWith(filePath));
        return file ? projectFile(this.system, this.rootDir, file) : undefined;
    }

    public addSourceFile(relativePath: string, content: string): this {
        this.addFile(resolveProjectPath(this.system, this.buildDir, relativePath), content);
        return this;
    }

    public getSourceFiles(relativePath?: string): ProjectFiles {
        const targetDir = relativePath ? resolveProjectPath(this.system, this.buildDir, relativePath) : this.buildDir;
        return projectFiles(this.system.readDirectory(targetDir).map(it => projectFile(this.system, this.buildDir, it)));
    }

    public getSourceFile(filePath: string): ProjectFile | undefined {
        const file = this.system.readDirectory(this.buildDir).find(it => it.endsWith(filePath));
        return file ? projectFile(this.system, this.buildDir, file) : undefined;
    }

    public compile(): CompilationResult {
        const result = new Compiler(this.compilerOptions, this.system, this.getOrCreateAddonRegistry()).compile();
        return {
            getCompiledDir: () => this.getCompiledDir(),
            getCompiledFiles: () => this.getCompiledFiles(),
            getCompiledFile: (filePath: string) => this.getCompiledFile(filePath),
            getDiagnostics: () => result.diagnostics ?? [],
            hasEmitSkipped: () => result.emitSkipped ?? false,
            getEmittedFiles: () => result.emittedFiles ?? [],
            hasFailures: () => result.diagnostics.some(it => it.category === ts.DiagnosticCategory.Error),
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

    public getCompiledDir(): string {
        return resolveProjectPath(this.system, this.rootDir, this.getCompilerOptions().tsConfig?.outDir ?? DEFAULT_OUT_DIR);
    }

    public getCompiledFiles(relativePath?: string): ProjectFiles {
        const targetDir = relativePath ? resolveProjectPath(this.system, this.rootDir, relativePath) : this.getCompiledDir();
        return projectFiles(this.system.readDirectory(targetDir).map(it => projectFile(this.getSystem(), this.buildDir, it)));
    }

    public getCompiledFile(filePath: string): ProjectFile | undefined {
        const file = this.system.readDirectory(this.getCompiledDir()).find(it => it.endsWith(filePath));
        return file ? projectFile(this.system, this.buildDir, file) : undefined;
    }

    private getOrCreateAddonRegistry(): AddonRegistry {
        if (!this.addons) {
            this.addons = new AddonRegistry(this.addonsConfig);
        }
        return this.addons;
    }

    private resolveAddonSourcePaths(addonName: string, addonFiles: Record<string, string>, addonTargetPath: string): Record<string, string> {
        return Object.entries(addonFiles).reduce((acc: Record<string, string>, [filePath, content]) => {
            if (path.isAbsolute(filePath)) {
                acc[filePath] = content;
            } else {
                if (filePath.includes(addonName)) {
                    acc[path.join(this.addonsConfig.addonsDir, filePath)] = content;
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
            // TODO: Resolve compiler options
            new Compiler(
                {
                    ...resolveCompilerOptions(this.system, {
                        buildDir: curDir,
                    }),
                    tsConfig: {
                        module: ts.ModuleKind.CommonJS,
                        target: ts.ScriptTarget.ES5,
                        esModuleInterop: true,
                        moduleResolution: ts.ModuleResolutionKind.Node10,
                    },
                    cliArgs: { fileNames: this.system.readDirectory(curDir).filter(isSourceFile), options: {}, errors: [] },
                },
                this.system
            ).compile();
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
            filePath = resolveProjectPath(this.system, this.buildDir, filePath);
        }
        this.system.writeFile(filePath, content);
        if (isSourceFile(filePath)) {
            this.compilerOptions.cliArgs.fileNames.push(filePath);
        }
    }

    private deleteDirectory(dirPath: string): void {
        if (this.virtual) {
            this.system.readDirectory(dirPath).forEach((it: string) => this.system.deleteFile!(it));
        } else {
            fs.rmSync(dirPath, { recursive: true, force: true });
        }
    }
}

export type CompilationResult = {
    getCompiledDir: () => string;
    getCompiledFiles: () => ProjectFiles;
    getCompiledFile: (filePath: string) => ProjectFile | undefined;
    hasEmitSkipped: () => boolean;
    getEmittedFiles: () => string[];
    hasFailures: () => boolean;
    getFailureReport: (filter?: string) => string;
    getDiagnostics: () => readonly ts.Diagnostic[];
};

export type CompilationOptions = CompileSystemOptions & {
    compilerOptions?: Partial<CompilerOptions>;
    virtual?: boolean;
};

export type ProjectFiles = ProjectFile[] & { getPaths: (substringPrefix?: string) => string[]; getContents: () => string[] };

export interface ProjectFile {
    getPath(): string;
    getContent(): string | undefined;
}

export const projectFile = (system: ts.System, buildDir: string, relativePath: string): ProjectFile => ({
    getPath: () => resolveProjectPath(system, buildDir, relativePath),
    getContent: () => system.readFile(resolveProjectPath(system, buildDir, relativePath)),
});

const resolveProjectPath = (system: ts.System, buildDir: string, relativePath: string) => {
    let filePath;
    if (path.isAbsolute(relativePath)) {
        filePath = resolvePath(system, relativePath);
    } else {
        if (relativePath.includes(path.basename(buildDir))) {
            filePath = resolvePath(system, path.dirname(buildDir), relativePath);
        } else {
            filePath = resolvePath(system, buildDir, relativePath);
        }
    }
    return filePath;
};

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
