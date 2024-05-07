/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import {
    AddonConfig,
    AddonRegistry,
    Compiler,
    CompilerAddons,
    DefaultReporter,
    compilerAddons,
    createBrowserSystem,
    type CompilerAddon,
    type CompilerOptions,
} from "@quatico/websmith-core";
import { Module } from "module";
import { basename, dirname, extname, isAbsolute, join } from "path";
import requireFromString from "require-from-string";
import ts from "typescript";
import { compileOptions } from "../compile-options";
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

    constructor(rootDir?: string, options?: Partial<CompilationOptions>, addonConfig?: Partial<AddonConfig>) {
        const { virtual = true, compilerOptions = {}, useCaseSensitiveFileNames } = options ?? {};
        this.virtual = virtual;
        this.system = this.virtual ? createBrowserSystem(undefined, useCaseSensitiveFileNames) : ts.sys;
        this.rootDir = resolvePath(this.system, rootDir ?? DEFAULT_ROOT_DIR);
        this.buildDir = resolvePath(this.system, this.rootDir, options?.compilerOptions?.buildDir ?? DEFAULT_BUILD_DIR);
        const outDir = resolvePath(this.system, this.rootDir, options?.compilerOptions?.project?.outDir ?? DEFAULT_OUT_DIR);

        if (!this.system.directoryExists(this.rootDir)) {
            this.system.createDirectory(this.rootDir);
        }
        this.system.getCurrentDirectory = () => this.rootDir;

        if (!this.system.directoryExists(this.buildDir)) {
            this.system.createDirectory(this.buildDir);
        }

        if (!this.system.directoryExists(outDir)) {
            this.system.createDirectory(outDir);
        }

        this.compilerOptions = compileOptions(this.system, {
            buildDir: this.buildDir,
            config: {
                configFilePath: `${this.rootDir}/websmith.config.json`,
                targets: {
                    "*": {
                        options: { outDir },
                    },
                },
            },
            project: { configFilePath: `${this.rootDir}/tsconfig.json`, outDir },
            ...compilerOptions,
        });

        const registryConfig = {
            ...(addonConfig ?? {}),
            addonsDir: join(this.rootDir, "./addons"),
            reporter: new DefaultReporter(this.system),
            system: this.system,
        };
        this.addons = new AddonRegistry(registryConfig);
        if (!this.system.directoryExists(this.addons.getAddonsDir())) {
            this.system.createDirectory(this.addons.getAddonsDir());
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
        const target = options === "project" ? this.getProjectDir() : options === "addons" && this.addons ? this.addons.getAddonsDir() : this.rootDir;
        if (this.system.directoryExists(target)) {
            if (this.isVirtual()) {
                this.system.readDirectory(target).forEach(it => this.system.deleteFile!(it));
            } else {
                ts.sys.readDirectory(target).forEach(it => this.system.deleteFile!(it));
            }
        }
        return this;
    }

    /**
     * The directory where active addons are moved to, for customizing the compilation.
     *
     * @returns absolute path to the addons directory, defaults to `${this.rootDir}/addons`
     */
    public getAddonsDir(): string | undefined {
        return this.addons?.getAddonsDir();
    }

    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    public getActiveAddon(addonName: string): CompilerAddon | undefined {
        return this.addons?.getAvailableAddons().find((it: CompilerAddon) => it.getName() === addonName);
    }

    public getActiveAddons(): CompilerAddons {
        return this.addons?.getAvailableAddons() ?? compilerAddons([]);
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
        if (!this.addons) {
            return this;
        }
        const addonTargetPath = join(this.addons.getAddonsDir(), addonName);
        let addonImportDir = join(this.rootDir, addonName);

        if (!this.system.directoryExists(addonTargetPath)) {
            this.system.createDirectory(addonTargetPath);
        }
        if (isFiles(addonSource)) {
            this.addFiles(this.resolveAddonSourcePaths(addonName, addonSource, addonTargetPath));
        } else {
            const addonsSourceDir = resolveProjectPath(this.system, this.rootDir, join(addonSource ?? DEFAULT_ADDONS_SOURCE_DIR, addonName));
            const sourceFs = this.system.directoryExists(addonsSourceDir) ? this.system : ts.sys;
            copyDirectory({ system: sourceFs, path: addonsSourceDir, kind: "addons" }, { system: this.system, path: addonTargetPath });
            addonImportDir = addonsSourceDir;
        }

        if (this.addons) {
            this.compileAddons(addonImportDir, this.addons.getAddonsDir());
            this.addons.refresh();
        }
        return this;
    }

    public addAddons(addonNames: string[], addonsSourceDir?: string): this {
        if (this.addons) {
            const addonsDir = this.addons.getAddonsDir();
            const addonsSourceDirPath = resolveProjectPath(this.system, this.rootDir, addonsSourceDir ?? DEFAULT_ADDONS_SOURCE_DIR);
            const sourceFs = this.system.directoryExists(addonsSourceDirPath) ? this.system : ts.sys;
            addonNames.forEach(addon => {
                copyDirectory({ system: sourceFs, path: join(addonsSourceDirPath, addon), kind: "addons" }, { system: this.system, path: addonsDir });
            });
            this.compileAddons(addonsSourceDirPath, addonsDir);
            this.addons?.refresh();
        }
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
            { system: sourceFs, path: join(projectsSourcePath, projectName), kind: "project" },
            // use rootDir as target path because we copy src and other files from project directory
            { system: this.system, path: this.rootDir }
        );
        this.compilerOptions.tsconfig.fileNames = this.system.readDirectory(this.buildDir).filter(isSourceFile);

        return this;
    }

    public addProjectFile(relativePath: string, content: string): this {
        this.addFile(resolveProjectPath(this.system, this.buildDir, relativePath), content);
        return this;
    }

    public getProjectFiles(): ProjectFiles {
        return projectFiles(this.system.readDirectory(this.rootDir).map(it => projectFile(this.system, this.buildDir, it)));
    }

    public getProjectFile(filePath: string): ProjectFile | undefined {
        const file = this.system.readDirectory(this.rootDir).find(it => it.endsWith(filePath));
        return file ? projectFile(this.system, this.buildDir, file) : undefined;
    }

    public compile(): this & CompilationResult {
        const result = new Compiler(this.compilerOptions, this.system, this.addons).compile();
        // @ts-expect-error - method is not part of the original object
        this.getDiagnostics = () => result.diagnostics;
        // @ts-expect-error - method is not part of the original object
        this.hasEmitSkipped = () => result.emitSkipped;
        // @ts-expect-error - method is not part of the original object
        this.getEmittedFiles = () => result.emittedFiles ?? [];
        // @ts-expect-error - method is not part of the original object
        this.hasFailures = () => result.diagnostics.some(it => it.category === ts.DiagnosticCategory.Error);
        // @ts-expect-error - method is not part of the original object
        this.getFailureReport = (filter?: string) => {
            const report = ts.formatDiagnostics(result.diagnostics, {
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
        };
        // @ts-expect-error - New methods were added to the object
        return this;
    }

    public getCompiledDir(): string {
        return resolveProjectPath(this.system, this.rootDir, this.getCompilerOptions().project.outDir ?? DEFAULT_OUT_DIR);
    }

    public getCompiledFiles(): ProjectFiles {
        return projectFiles(this.system.readDirectory(this.getCompiledDir()).map(it => projectFile(this.getSystem(), this.buildDir, it)));
    }

    public getCompiledFile(filePath: string): ProjectFile | undefined {
        const file = this.system.readDirectory(this.getCompiledDir()).find(it => it.endsWith(filePath));
        return file ? projectFile(this.system, this.buildDir, file) : undefined;
    }

    private resolveAddonSourcePaths(addonName: string, addonFiles: Record<string, string>, addonTargetPath: string): Record<string, string> {
        if (!this.addons) {
            return {};
        }
        return Object.entries(addonFiles).reduce((acc: Record<string, string>, [filePath, content]) => {
            if (isAbsolute(filePath)) {
                acc[filePath] = content;
            } else {
                if (filePath.includes(addonName)) {
                    acc[join(this.addons!.getAddonsDir(), filePath)] = content;
                } else {
                    acc[join(addonTargetPath, filePath)] = content;
                }
            }
            return acc;
        }, {});
    }

    private compileAddons(addonsSourceDir: string, addonsTargetDir: string) {
        const addonsToCompile = this.system
            .readDirectory(addonsTargetDir)
            .filter(isSourceFile)
            .map(it => dirname(it));

        addonsToCompile.forEach(curDir => {
            new Compiler(
                {
                    ...compileOptions(this.system, {
                        buildDir: curDir,
                    }),
                    project: {
                        module: ts.ModuleKind.CommonJS,
                        target: ts.ScriptTarget.ES5,
                        esModuleInterop: true,
                        moduleResolution: ts.ModuleResolutionKind.NodeNext,
                    },
                    tsconfig: { fileNames: this.system.readDirectory(curDir).filter(isSourceFile), options: {}, errors: [] },
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
                        basename(resolvedPath, extname(resolvedPath)) === "addon"
                            ? resolvedPath.replace(extname(resolvedPath), "")
                            : `./${basename(resolvedPath, extname(resolvedPath))}`,
                        () =>
                            requireFromString(this.system.readFile(resolvedPath)!, resolvedPath, {
                                prependPaths: [dirname(resolvedPath), addonsTargetDir],
                                // @ts-expect-error - nodeModulePaths is not part of the original object
                                appendPaths: Module._nodeModulePaths(dirname(addonsSourceDir)),
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
            this.addFile(resolveProjectPath(this.system, this.buildDir, file), files[file]);
        });
    }

    private addFile(filePath: string, content: string): void {
        this.system.writeFile(filePath, content);
        if (isSourceFile(filePath)) {
            this.compilerOptions.tsconfig.fileNames.push(filePath);
        }
    }
}

export type CompilationResult = {
    hasEmitSkipped: () => boolean;
    getEmittedFiles: () => string[];
    hasFailures: () => boolean;
    getFailureReport: (filter?: string) => string;
    getDiagnostics: () => ts.Diagnostic[];
};

export type CompilationOptions = {
    compilerOptions?: Partial<CompilerOptions>;
    useCaseSensitiveFileNames?: boolean;
    virtual?: boolean;
};

export type ProjectFiles = ProjectFile[] & { getPaths: () => string[]; getContents: () => string[] };

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
    if (isAbsolute(relativePath)) {
        filePath = resolvePath(system, relativePath);
    } else {
        if (relativePath.includes(basename(buildDir))) {
            filePath = resolvePath(system, dirname(buildDir), relativePath);
        } else {
            filePath = resolvePath(system, buildDir, relativePath);
        }
    }
    return filePath;
};

const isSourceFile = (filePath: string): boolean => filePath.endsWith(".ts") || filePath.endsWith(".tsx");

const isFiles = (source?: string | Record<string, string>): source is Record<string, string> => typeof source === "object";

const projectFiles = (result: ProjectFile[]): ProjectFiles => {
    return Object.assign(result, { getPaths: () => result.map(it => it.getPath()), getContents: () => result.map(it => it.getContent()!) });
};

export const compilationEnv = (rootDir: string, options?: Partial<CompilationOptions>, addonConfig?: Partial<AddonConfig>): CompilationEnv =>
    new CompilationEnv(rootDir, options, addonConfig);
