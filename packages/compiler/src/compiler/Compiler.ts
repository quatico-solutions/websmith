/*
 * @license
 *
 * Copyright (c) 2017-2022 Quatico Solutions AG
 * Förrlibuckstrasse 220, 8005 Zurich, Switzerland
 *
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * Quatico Solutions AG, ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with Quatico.
 */

import { ErrorMessage, Reporter, TargetConfig } from "@websmith/addon-api";
import { dirname, extname, join } from "path";
import ts from "typescript";
import { createSystem, recursiveFindByFilter } from "../environment";
import { concat } from "./collections";
import { CompilationContext, CompilationHost, createSharedHost } from "./compilation";
import { CompilerOptions } from "./CompilerOptions";
import { CompilationConfig } from "./config";
import { DefaultReporter } from "./DefaultReporter";

export type CompileFragment = {
    version: number;
    files: ts.OutputFile[];
};

export class Compiler {
    public contextMap!: Map<string, CompilationContext>;
    public version: number;

    protected program?: ts.Program;
    protected compilationHost!: CompilationHost;
    protected langService!: ts.LanguageService;
    protected options!: CompilerOptions;

    private configPath!: string;
    private reporter!: Reporter;
    private system!: ts.System;

    // TODO: Styles: Add support for style processors via addon
    // private compileImportedStyles: Transformer;

    constructor(options: CompilerOptions, system?: ts.System) {
        this.version = 0;
        this.contextMap = new Map();
        this.system = system ?? createSystem();
        this.setOptions(options);

        // TODO: Styles: Add support for style processors via addon
        // this.compileImportedStyles = createStyleCompiler(
        //     { sassOptions: options.sassOptions, reporter: this.reporter, system: this.system },
        //     this.addons.styleTransformers
        // );
    }

    public getContext(target?: string): CompilationContext | undefined {
        return this.contextMap.get(target ?? "*");
    }

    public getSystem(): ts.System {
        return this.system;
    }

    public getReporter(): Reporter {
        return this.reporter;
    }

    public getOptions(): CompilerOptions {
        return this.options;
    }

    public setOptions(options: CompilerOptions): this {
        this.options = options;
        if (!this.options?.targets || this.options.targets.length === 0) {
            options.targets = ["*"];
        }

        this.reporter = options.reporter ?? new DefaultReporter(this.system);
        this.compilationHost = new CompilationHost(createSharedHost(this.system) as ts.LanguageServiceHost);
        this.langService = ts.createLanguageService(this.compilationHost, ts.createDocumentRegistry());

        if (!options.debug) {
            // eslint-disable-next-line no-console
            console.debug = () => undefined;
            // eslint-disable-next-line no-console
            console.log = () => undefined;
        }

        return this;
    }

    public compile(): ts.EmitResult {
        const result: ts.EmitResult = { diagnostics: [], emitSkipped: false, emittedFiles: [] };
        this.createTargetContextsIfNecessary();

        this.options.targets.forEach((target: string) => {
            const { config } = this.options;
            const { writeFile = true } = getTargetConfig(target, config);
            const ctx = this.contextMap.get(target);

            if (!ctx) {
                return;
            }

            for (const fileName of this.getRootFiles()) {
                const fragment = this.emitSourceFile(fileName, target, writeFile);
                if (fragment?.files.length > 0) {
                    result.emittedFiles = concat(
                        result.emittedFiles,
                        fragment.files.map(cur => cur.name)
                    );
                } else {
                    // FIXME: Report error for source files that cannot be emitted
                }
            }

            const files = this.getRootFiles();
            ctx.getResultProcessors().forEach(cur => cur(files));
        });

        // TODO: Styles: Add style processors here to generate docs
        // eslint-disable-next-line no-console
        // stylePaths.filter(cur => cur.endsWith(".scss")).forEach(cur => console.log(`Style: ${cur}`));

        /// Create single LanguageService with a dedicated CompilationHost and default LanguageServiceHost
        /// Receive targets, go though each target
        /// Create compilation per target with single CompilationContext per target
        /// Create single LanguageServiceHost inside CompilationHost (if necessary)
        /// Resolve addons for target
        /// Go through all root files and apply all addons

        // TODO: Return ts.EmitResult with diagnostics
        return this.report(this.langService.getProgram()!, result);
    }

    private fileWatchers: ts.FileWatcher[] = [];

    public watch() {
        this.createTargetContextsIfNecessary();

        if (typeof this.system.watchFile === "function") {
            this.getRootFiles().forEach(cur => {
                const emitTargets: string[] = this.getWritingTargets();

                this.fileWatchers.push(
                    this.system.watchFile!(cur, (fileName: string) => emitTargets.forEach(target => this.emitSourceFile(fileName, target, true)))
                );
                emitTargets.forEach(target => this.emitSourceFile(cur, target, true));
            });
        } else {
            this.reporter.reportDiagnostic(new ErrorMessage(`Watching is not supported by ${this.system.constructor.name}.`));
        }
    }

    public closeAllWatchers() {
        this.fileWatchers.forEach(cur => cur.close());
    }

    protected createTargetContextsIfNecessary(): this {
        this.options.targets.forEach((target: string) => {
            if (this.contextMap.has(target)) {
                return;
            }

            const { buildDir, config, project, tsconfig } = this.options;
            const { options, config: targetConfig } = getTargetConfig(target, config);

            const ctx = new CompilationContext({
                buildDir,
                project: { ...project, ...options },
                projectDir: dirname(config?.configFilePath ?? tsconfig.raw?.configFilePath ?? this.system.getCurrentDirectory()),
                system: this.system,
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                program: this.program!,
                tsconfig: { ...tsconfig, options: { ...project, ...options } },
                rootFiles: this.getRootFiles(),
                reporter: this.reporter,
                config: targetConfig,
                target,
            });
            this.options.addons.getAddons(target).forEach(addon => {
                addon.activate(ctx);
            });
            this.contextMap.set(target, ctx);
        });
        return this;
    }

    protected emitSourceFile(fileName: string, target: string, writeFile = true): CompileFragment {
        const filePath = this.system.resolvePath(fileName);
        const ctx = this.contextMap.get(target);
        const cache = ctx?.getCache();

        if (ctx && cache) {
            if (!cache.hasChanged(filePath)) {
                return cache.getCachedFile(filePath);
            }
            let content = this.system.readFile(fileName) ?? "";

            ctx.getGenerators().forEach(cur => cur(fileName, content));

            ctx.getProcessors().forEach(cur => (content = cur(fileName, content)));
            cache.updateSource(filePath, content);
            this.compilationHost.setLanguageHost(ctx.getLanguageHost());

            const output = this.langService.getEmitOutput(fileName);

            if (!output.emitSkipped) {
                cache.updateOutput(fileName, output.outputFiles);
                this.version++;

                if (writeFile) {
                    this.writeOutputFiles(output);
                }
                return { version: cache.getVersion(fileName), files: output.outputFiles };
            }
        }

        return { version: 0, files: this.langService.getEmitOutput(fileName).outputFiles };
    }

    protected report(program: ts.Program, result: ts.EmitResult): ts.EmitResult {
        ts.getPreEmitDiagnostics(program)
            .concat(result.diagnostics)
            .forEach(cur => this.reporter.reportDiagnostic(cur));

        return result;
    }

    // FIXME: compile and watch don't return proper ts.EmitResult(s)
    // private tryEmit(emit: () => ts.EmitResult): ts.EmitResult {
    //     try {
    //         return emit();
    //     } catch (err) {
    //         return {
    //             diagnostics: [
    //                 {
    //                     category: 1 /* Error */,
    //                     code: 0,
    //                     file: undefined,
    //                     length: 0,
    //                     messageText: err.message,
    //                     start: 0,
    //                 },
    //             ],
    //             emitSkipped: true,
    //         };
    //     }
    // }

    private getRootFiles(): string[] {
        return this.options?.tsconfig?.fileNames
            ? this.options.tsconfig.fileNames
            : recursiveFindByFilter(this.system.resolvePath(join(dirname(this.configPath), "./src")), (path: string) =>
                  ["ts", "tsx", "js", "jsx"].some(it => extname(path).includes(it))
              );
    }

    private writeOutputFiles(emitOutput: ts.EmitOutput) {
        emitOutput.outputFiles.forEach(cur => this.system.writeFile(cur.name, cur.text));
        // for (const cur of emitOutput.outputFiles) {
        //     const fileName = this.getFilePath(cur.name);
        //     this.system.writeFile(fileName, cur.text);
        // }
    }

    // private getFilePath(fileName: string): string {
    //     const projectDir = dirname(this.options.buildDir);
    //     const basePath = this.getBasePath(fileName, projectDir);
    //     const outDir = this.options.project.outDir;
    //     if (!outDir) {
    //         return !isAbsolute(fileName) ? join(basePath, fileName) : fileName;
    //     }
    //     return fileName.includes(outDir) ? fileName : fileName.replace(basePath, resolve(projectDir, outDir));
    // }

    // private getBasePath(fileName: string, projectDir: string): string {
    //     return Object.keys(this.options.project.wildcardDirectories ?? {}).find(it => fileName.includes(it)) ?? projectDir;
    // }

    private getWritingTargets() {
        const writingTargets: string[] = [];
        this.options.targets.forEach((target: string) => {
            const { writeFile } = getTargetConfig(target, this.options.config);
            if (writeFile) {
                writingTargets.push(target);
            }
        });
        return writingTargets;
    }
}

const getTargetConfig = (target: string, config?: CompilationConfig): TargetConfig => {
    if (config) {
        const { targets = {} } = config;
        return targets[target] ?? {};
    }
    return {};
};
