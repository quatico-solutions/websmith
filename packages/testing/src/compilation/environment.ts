import { Compiler, CompilerOptions, createBrowserSystem } from "@quatico/websmith-core";
import { basename, dirname, extname, isAbsolute } from "path";
import requireFromString from "require-from-string";
import ts from "typescript";
import { compileOptions } from "../compile-options";
import { copyFolderSync } from "./copy";
import { resolvePath } from "./resolve-path";

export class CompilationEnv {
    private compiler: Compiler;
    private rootDir: string;
    private system: ts.System;
    private virtual: boolean;

    constructor(rootDir: string, options?: CompilationOptions) {
        const { virtual = true, compilerOptions = {}, useCaseSensitiveFileNames, files } = options ?? {};
        this.virtual = virtual;
        this.system = this.virtual ? createBrowserSystem(files, useCaseSensitiveFileNames) : ts.sys;
        this.rootDir = resolvePath(this.system, rootDir);

        this.addFiles(files);

        const compOptions = compileOptions(this.system, { buildDir: this.rootDir, ...compilerOptions });
        this.compileAddons(compOptions.addons.getAddonDir());

        this.compiler = new Compiler(compOptions, this.system);

        if (!this.system.directoryExists(this.rootDir)) {
            this.system.createDirectory(this.rootDir);
        }
    }

    public getRootDir(): string {
        return this.rootDir;
    }

    public getCompiler(): Compiler {
        return this.compiler;
    }
    public getCompilerOptions(): CompilerOptions {
        return this.compiler.getOptions();
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

    public getAddons() {
        return this.compiler.getOptions().addons;
    }

    public addAddon(addonName: string, addonCode: string): this {
        this.addAddonFile(addonName, addonCode);
        this.compileAddons(this.getAddons().getAddonDir());
        this.getAddons().refresh();
        return this;
    }

    public addAddons(addonNames: string[], sourceDir = "../test-data/addons/"): this {
        const addonsDir = resolvePath(this.system, this.getAddons().getAddonDir());
        addonNames.forEach(addon => {
            copyFolderSync(this.system, resolvePath(this.system, this.rootDir, sourceDir, addon), addonsDir);
        });
        this.compileAddons(this.getAddons().getAddonDir());
        this.getAddons().refresh();

        return this;
    }

    public getProject(projectName: string): Project | undefined {
        const buildDir = this.getCompilerOptions().buildDir;
        const projectDir = this.system.getDirectories(buildDir).find(it => it === projectName);
        if (projectDir) {
            return new Project(resolvePath(this.system, buildDir, projectDir), this.system);
        }
        return undefined;
    }

    public getProjects(): Project[] {
        const buildDir = this.getCompilerOptions().buildDir;
        const projectDirs = this.system.getDirectories(buildDir);
        return projectDirs.map(it => resolvePath(this.system, buildDir, it)).map(it => new Project(it, this.system));
    }

    public addProject(projectName: string, source?: string | Record<string, string>): this {
        const isFiles = (source?: string | Record<string, string>): source is Record<string, string> => typeof source === "object";
        const projectPath = resolvePath(this.system, this.rootDir, projectName);

        if (!this.system.directoryExists(projectPath)) {
            this.system.createDirectory(projectPath);
        }
        if (isFiles(source)) {
            this.addFiles(
                Object.entries(source).reduce((acc: Record<string, string>, [filePath, content]) => {
                    if (isAbsolute(filePath)) {
                        acc[filePath] = content;
                    } else {
                        if (filePath.includes(projectName)) {
                            acc[resolvePath(this.system, this.rootDir, filePath)] = content;
                        } else {
                            acc[resolvePath(this.system, this.rootDir, projectName, filePath)] = content;
                        }
                    }
                    return acc;
                }, {})
            );
        } else {
            const sourceDir = source ?? "../test-data/projects/";
            const projectDir = resolvePath(this.system, this.rootDir, sourceDir, projectName);
            copyFolderSync(this.system, projectDir, this.getCompilerOptions().buildDir);
        }
        return this;
    }

    private addAddonFile(addonName: string, addonCode: string) {
        this.system.writeFile(resolvePath(this.system, this.getAddons().getAddonDir(), addonName, "addon.ts"), addonCode);
    }

    private compileAddons(addonsDir: string) {
        const addonsToCompile = this.system
            .readDirectory(addonsDir)
            .filter(it => it.endsWith(".ts"))
            .map(it => dirname(it));

        addonsToCompile.forEach(curDir => {
            new Compiler(
                {
                    ...compileOptions(this.system, {
                        buildDir: curDir,
                    }),
                    project: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES5 },
                    tsconfig: { fileNames: this.system.readDirectory(curDir).filter(it => it.endsWith(".ts")), options: {}, errors: [] },
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

    private addFiles(files?: Record<string, string>) {
        if (!files) {
            return;
        }
        Object.keys(files).forEach(file => {
            this.system.writeFile(file, files[file]);
        });
    }
}

export type CompilationOptions = {
    compilerOptions?: Partial<CompilerOptions>;
    files?: Record<string, string>;
    useCaseSensitiveFileNames?: boolean;
    virtual?: boolean;
};
export class Project {
    private path: string;
    private system: ts.System;

    constructor(path: string, system: ts.System) {
        this.path = path;
        this.system = system;
    }

    public getPath(): string {
        return this.path;
    }

    public addFile(filePath: string, content: string): this {
        let path;
        if (isAbsolute(filePath)) {
            path = resolvePath(this.system, filePath);
        } else {
            if (filePath.includes(basename(this.path))) {
                path = resolvePath(this.system, dirname(this.path), filePath);
            } else {
                path = resolvePath(this.system, this.path, filePath);
            }
        }
        this.system.writeFile(path, content);
        return this;
    }

    public getFiles(): string[] {
        return this.system.readDirectory(this.path);
    }
}

export const compilationEnv = (rootDir: string, options?: CompilationOptions): CompilationEnv => new CompilationEnv(rootDir, options);
