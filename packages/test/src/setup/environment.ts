import type { Reporter } from "@quatico/websmith-api";
import { CompilerArguments, createOptions } from "@quatico/websmith-compiler";
import { AddonRegistry, Compiler, createBrowserSystem } from "@quatico/websmith-core";
import { dirname, join } from "path";
import ts from "typescript";
import { copyFolderSync } from "./copy";
import { fileContent } from "./expect";
import { resolvePath } from "./paths";
import { stringToArray } from "./values";

export interface WebsmithEnv {
    compiler: Compiler;
    rootDir: string;
    system: ts.System;
    cleanUp: (path?: string) => void;
    addAddons: (addonNames: string, templateFolder?: string, addonsDir?: string) => AddonRegistry;
    addProject: (projectName: string, targetDir?: string, templateFolder?: string) => string;
    sourceFile: (fileName: string, content: string) => string;
}

export type WebsmithOptions = {
    compilerArguments?: CompilerArguments;
    files?: Record<string, string>;
    reporter?: Reporter;
    useCaseSensitiveFileNames?: boolean;
    virtual?: boolean;
};

export const setUp = (rootDir: string, options?: WebsmithOptions): WebsmithEnv => {
    const { virtual = false, compilerArguments = {}, useCaseSensitiveFileNames, files, reporter } = options ?? {};

    const system = virtual ? createBrowserSystem(files, useCaseSensitiveFileNames) : ts.sys;

    if (files) {
        if (!virtual) {
            throw new Error("Cannot provide files in non-virtual mode.");
        }

        const addonsToCompile = Object.keys(files)
            .filter(it => it.endsWith("/addon.ts"))
            .map(it => dirname(it));
        addonsToCompile.forEach(curDir => {
            const addonCompiler = new Compiler(
                {
                    ...createOptions(
                        {
                            addons: "",
                            addonsDir: "./do-not-use-addons",
                            buildDir: curDir,
                        },
                        reporter,
                        system
                    ),
                    project: { module: ts.ModuleKind.ES2015, target: ts.ScriptTarget.ES5 },
                    tsconfig: { options: {}, fileNames: system.readDirectory(curDir).filter(it => it.endsWith(".ts")), errors: [] },
                },
                system
            );
            addonCompiler.compile();
        });

        if (!fileContent(system, "./addons/target-addon/addon.js", "/")) {
            throw new Error(`Addons not compiled. ${system.readDirectory("./addons")}`);
        }

        jest.mock(
            "/addons/target-addon/addon",
            () => {
                return eval(files["./addons/target-addon/addon.js"]);
            },
            { virtual: true }
        );
    }

    const compileOptions = createOptions({ buildDir: "/", project: "./tsconfig.json", ...compilerArguments }, reporter, system);
    const resolved = resolvePath(system, rootDir);
    const compiler = new Compiler(compileOptions, system);

    if (!system.directoryExists(resolved)) {
        system.createDirectory(resolved);
    }

    process.chdir(resolved);

    // if (withDefaults && !existsSync(join(projectDir, "src"))) {
    //     mkdirSync(join(projectDir, "src"));
    // }
    // process.chdir(projectDir);

    // if (withDefaults && !existsSync(join(projectDir, "websmith.config.json"))) {
    //     writeFileSync(
    //         join(projectDir, "websmith.config.json"),
    //         JSON.stringify({
    //             addonsDir: "./addons",
    //         })
    //     );
    // }

    // if (withDefaults && !existsSync(join(projectDir, "tsconfig.json"))) {
    //     writeFileSync(
    //         join(projectDir, "tsconfig.json"),
    //         JSON.stringify({
    //             compilerOptions: {
    //                 target: "ESNEXT",
    //                 module: "ESNEXT",
    //                 lib: ["es2017", "es7", "es6", "dom"],
    //                 declaration: true,
    //                 outDir: "dist",
    //                 strict: true,
    //                 esModuleInterop: true,
    //             },
    //             include: ["src"],
    //             exclude: ["node_modules", "dist"],
    //         })
    //     );
    // }

    const cleanUp = (path?: string): void => {
        const target = path ?? resolved;
        if (system.fileExists(target)) {
            system.readDirectory(target).forEach(it => system.deleteFile!(it));
        }
    };

    const addAddons = (
        addonNames: string,
        templateFolder = "../test-data/addons/",
        addonsDir = compileOptions.addons.getAddonDir()
    ): AddonRegistry => {
        const addonsDirPath = resolvePath(system, addonsDir);
        stringToArray(addonNames).forEach(addon => {
            copyFolderSync(system, join(__dirname, templateFolder, addon), addonsDirPath);
        });
        const registry = compileOptions.addons.refresh();
        // @ts-expect-error - private method
        compiler.createTargetContextsIfNecessary();

        return registry;
    };

    const addProject = (projectName: string, targetDir?: string, templateFolder = "../test-data/projects/"): string => {
        const target = targetDir ?? process.cwd();
        copyFolderSync(system, join(__dirname, templateFolder, projectName), target);
        return resolvePath(system, `${target}/${projectName}`);
    };

    const sourceFile = (fileName: string, content: string): string => {
        system.writeFile(resolvePath(system, "src", fileName), content);
        return content;
    };

    return {
        rootDir: resolved,
        compiler,
        system,
        cleanUp,
        addAddons,
        sourceFile,
        addProject,
    };
};
