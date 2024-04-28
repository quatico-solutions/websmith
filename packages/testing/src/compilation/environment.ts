import { Compiler, CompilerOptions } from "@quatico/websmith-core";
import { dirname, join } from "path";
import ts from "typescript";
import { compileOptions } from "../compile-options";
import { copyFolderSync } from "./copy";
import { resolvePath } from "./resolve-path";
// import fs from "memfs";

export class CompilationEnv {
    private compiler: Compiler;
    private rootDir: string;
    private system: ts.System;

    constructor(rootDir: string, options?: CompilationOptions) {
        const { virtual = true, compilerOptions = {}, files } = options ?? {};
        this.system = ts.sys;
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

    public addAddons(addonNames: string[], templateFolder = "../test-data/addons/", addonsDir?: string): this {
        const addonsDirPath = resolvePath(this.system, addonsDir ?? this.getAddons().getAddonDir());
        addonNames.forEach(addon => {
            copyFolderSync(this.system, join(__dirname, templateFolder, addon), addonsDirPath);
        });
        this.compiler.getOptions().addons.refresh();
        // @ts-expect-error - private method
        this.compiler.createTargetContextsIfNecessary();

        return this;
    }

    public addProject(projectName: string, targetDir?: string, templateFolder = "../test-data/projects/"): this {
        const target = targetDir ?? this.getCompilerOptions().buildDir;
        copyFolderSync(this.system, join(__dirname, templateFolder, projectName), target);
        return this;
        // return resolvePath(system, `${target}/${projectName}`);
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
            const comp = new Compiler(
                {
                    ...compileOptions(this.system, {
                        buildDir: curDir,
                    }),
                    tsconfig: { fileNames: this.system.readDirectory(curDir).filter(it => it.endsWith(".ts")), options: {}, errors: [] },
                },
                this.system
            );
            const result = comp.compile();
            console.debug(`XXX`, result.emittedFiles);
        });
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
