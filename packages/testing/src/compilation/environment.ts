/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { AddonRegistry, Compiler, createBrowserSystem, type CompilerAddon, type CompilerOptions } from "@quatico/websmith-core";
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

    constructor(rootDir?: string, options?: CompilationOptions) {
        const { virtual = true, compilerOptions = {}, useCaseSensitiveFileNames, files } = options ?? {};
        this.virtual = virtual;
        this.system = this.virtual ? createBrowserSystem(undefined, useCaseSensitiveFileNames) : ts.sys;
        this.rootDir = resolvePath(this.system, rootDir ?? DEFAULT_ROOT_DIR);
        this.buildDir = resolvePath(this.system, this.rootDir, options?.compilerOptions?.buildDir ?? DEFAULT_BUILD_DIR);
        const outDir = resolvePath(this.system, this.rootDir, options?.compilerOptions?.project?.outDir ?? DEFAULT_OUT_DIR);

        if (!this.system.directoryExists(this.rootDir)) {
            this.system.createDirectory(this.rootDir);
        }
        this.system.getCurrentDirectory = () => this.rootDir;

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
        this.addFiles(files);
        this.compileAddons(this.compilerOptions.addons.getAddonsDir());
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

    public cleanUp(path?: string): this {
        const target = path ?? this.rootDir;
        if (this.system.fileExists(target)) {
            this.system.readDirectory(target).forEach(it => this.system.deleteFile!(it));
        }
        return this;
    }

    /**
     * The directory where active addons are moved to, for customizing the compilation.
     *
     * @returns absolute path to the addons directory, defaults to `${this.rootDir}/addons`
     */
    public getAddonsDir(): string {
        return this.getAddonRegistry().getAddonsDir();
    }

    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    public getActiveAddon(addonName: string): CompilerAddon | undefined {
        return this.getAddonRegistry()
            .getAvailableAddons()
            .find((it: CompilerAddon) => it.getName() === addonName);
    }

    public getActiveAddons(): CompilerAddon[] {
        return this.getAddonRegistry().getAvailableAddons();
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
        const addonTargetPath = join(this.getAddonsDir(), addonName);

        if (!this.system.directoryExists(addonTargetPath)) {
            this.system.createDirectory(addonTargetPath);
        }
        if (isFiles(addonSource)) {
            this.addFiles(
                Object.entries(addonSource).reduce((acc: Record<string, string>, [filePath, content]) => {
                    if (isAbsolute(filePath)) {
                        acc[filePath] = content;
                    } else {
                        if (filePath.includes(addonName)) {
                            acc[join(this.getAddonsDir(), filePath)] = content;
                        } else {
                            acc[join(addonTargetPath, filePath)] = content;
                        }
                    }
                    return acc;
                }, {})
            );
        } else {
            const addonsSourceDir = resolveProjectPath(this.system, this.rootDir, join(addonSource ?? DEFAULT_ADDONS_SOURCE_DIR, addonName));
            const sourceFs = this.system.directoryExists(addonsSourceDir) ? this.system : ts.sys;
            copyDirectory({ system: sourceFs, path: addonsSourceDir, kind: "addon" }, { system: this.system, path: addonTargetPath });
        }

        this.compileAddons(this.getAddonRegistry().getAddonsDir());
        this.getAddonRegistry().refresh();
        return this;
    }

    public addAddons(addonNames: string[], addonsSourceDir?: string): this {
        const addonsDir = this.getAddonsDir();
        const addonsSourceDirPath = resolveProjectPath(this.system, this.rootDir, addonsSourceDir ?? DEFAULT_ADDONS_SOURCE_DIR);
        const sourceFs = this.system.directoryExists(addonsSourceDirPath) ? this.system : ts.sys;
        addonNames.forEach(addon => {
            copyDirectory({ system: sourceFs, path: join(addonsSourceDirPath, addon), kind: "addon" }, { system: this.system, path: addonsDir });
        });
        this.compileAddons(addonsDir);
        this.getAddonRegistry().refresh();

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
            { system: this.system, path: this.rootDir }
        );
        this.compilerOptions.tsconfig.fileNames = this.system.readDirectory(this.buildDir).filter(isSourceFile);

        return this;
    }

    public addProjectFile(relativePath: string, content: string): this {
        this.addFile(resolveProjectPath(this.system, this.buildDir, relativePath), content);
        return this;
    }

    public getProjectFiles(): ProjectFile[] {
        return this.system.readDirectory(this.rootDir).map(it => projectFile(this.system, this.buildDir, it));
    }

    public getProjectFile(filePath: string): ProjectFile | undefined {
        const file = this.system.readDirectory(this.rootDir).find(it => it.endsWith(filePath));
        return file ? projectFile(this.system, this.buildDir, file) : undefined;
    }

    public compile(): this & CompilationResult {
        const result = new Compiler(this.compilerOptions, this.system).compile();
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

    public getCompiledFiles(): ProjectFile[] {
        return this.system.readDirectory(this.getCompiledDir()).map(it => projectFile(this.getSystem(), this.buildDir, it));
    }

    public getCompiledFile(filePath: string): ProjectFile | undefined {
        const file = this.system.readDirectory(this.getCompiledDir()).find(it => it.endsWith(filePath));
        return file ? projectFile(this.system, this.buildDir, file) : undefined;
    }

    private compileAddons(addonsDir: string) {
        const addonsToCompile = this.system
            .readDirectory(addonsDir)
            .filter(isSourceFile)
            .map(it => dirname(it));

        addonsToCompile.forEach(curDir => {
            new Compiler(
                {
                    ...compileOptions(this.system, {
                        buildDir: curDir,
                    }),
                    project: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES5 },
                    tsconfig: { fileNames: this.system.readDirectory(curDir).filter(isSourceFile), options: {}, errors: [] },
                },
                this.system
            ).compile();
        });

        if (this.virtual) {
            this.system
                .readDirectory(addonsDir, [".js", ".jsx"])
                .filter(it => basename(it, extname(it)).toLocaleLowerCase() === "addon")
                .map(it => this.system.resolvePath(it))
                .forEach(it => {
                    jest.mock(
                        extname(it).match(/^(?!.*\.d\.tsx?$).*\.[j]sx?$/g) ? it.replace(extname(it), "") : it,
                        () => requireFromString(this.system.readFile(it)!),
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

    private getAddonRegistry(): AddonRegistry {
        return this.compilerOptions.addons;
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
    files?: Record<string, string>;
    useCaseSensitiveFileNames?: boolean;
    virtual?: boolean;
};

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

export const compilationEnv = (rootDir: string, options?: CompilationOptions): CompilationEnv => new CompilationEnv(rootDir, options);
