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

    public getProjects(): string[] {
        const buildDir = this.getCompilerOptions().buildDir;
        const projectDirs = this.system.readDirectory(buildDir).map(it => {
            const end = it.indexOf("/", buildDir.length + 1);
            return it.substring(0, end);
        });
        return [...new Set(projectDirs)];
    }

    public addProject(projectName: string, options?: { sourceDir?: string; projectFiles?: Record<string, string> }): this {
        const { sourceDir = "../test-data/projects/", projectFiles } = options ?? {};
        if (projectFiles) {
            this.addFiles(
                Object.entries(projectFiles).reduce((acc: Record<string, string>, [filePath, content]) => {
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
            const projectDir = resolvePath(this.system, this.rootDir, sourceDir, projectName);
            copyFolderSync(this.system, projectDir, this.getCompilerOptions().buildDir);
        }
        return this;
    }

    public addSourceFile(fileName: string, content: string): this {
        this.system.writeFile(resolvePath(this.system, "src", fileName), content);
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

export const compilationEnv = (rootDir: string, options?: CompilationOptions): CompilationEnv => {
    // if (withDefaults && !existsSync(join(projectDir, "websmith.config.json"))) {
    //     writeFileSync(
    //         join(projectDir, "websmith.config.json"),
    //         JSON.stringify({
    //             addonsDir: "./addons",
    //         })
    //     );
    // }

    return new CompilationEnv(rootDir, options);
};
