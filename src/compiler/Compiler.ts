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
import { dirname, isAbsolute, join, resolve } from "path";
import ts from "typescript";
import { createSystem, createWatchHost, recursiveFindByFilter } from "../environment";
import { CompilerOptions, Reporter } from "../model";
import { concat } from "./collections";
import { CompilationContext } from "./CompilationContext";
import { CompilationHost } from "./CompilationHost";
import type { CompilationOptions } from "./CompilationOptions";
import { CompilerConfig } from "./config";
import { DefaultReporter } from "./DefaultReporter";
import { createSharedHost } from "./host";
import { createParser, Project } from "./Parser";

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

    // TODO: Add support for style processors via addon
    // private compileImportedStyles: Transformer;

    constructor(options: CompilerOptions, system?: ts.System) {
        this.version = 0;
        this.contextMap = new Map();
        this.system = system ?? createSystem();
        this.setOptions(options);

        // TODO: Add support for style processors via addon
        // this.compileImportedStyles = createStyleCompiler(
        //     { sassOptions: options.sassOptions, reporter: this.reporter, system: this.system },
        //     this.addons.styleTransformers
        // );
    }

    public getContext(target?: string): CompilationContext | undefined {
        return this.contextMap.get(target ?? "All");
    }

    public getSystem(): ts.System {
        return this.system;
    }

    public getOptions(): CompilerOptions {
        return this.options;
    }

    public setOptions(options: CompilerOptions): this {
        this.options = options;
        this.options.targets.length === 0 && this.options.targets.push("All");

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

        this.options.targets.forEach((target: string) => {
            const { buildDir, config, project, tsconfig } = this.options;
            const { writeFile } = getCompilationOptions(target, config);

            const ctx = new CompilationContext({
                buildDir,
                project,
                system: this.system,
                tsconfig,
                rootFiles: this.getRootFiles(),
                reporter: this.reporter,
            });
            this.options.addons.getAddons(target).forEach(addon => {
                addon.activate(ctx);
            });
            this.contextMap.set(target, ctx);

            for (const fileName of this.getRootFiles()) {
                const fragment = this.emitSourceFile(fileName, target, writeFile);
                if (fragment?.files.length > 0) {
                    result.emittedFiles = concat(
                        result.emittedFiles,
                        fragment.files.map(it => it.name)
                    );
                } else {
                    // FIXME: Report error for source files that cannot be emitted
                }
            }
        });

        // TODO: Add style processors here to generate docs
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

    public watch() {
        const { filePaths } = this.parse();
        const host = createWatchHost(filePaths, this.options.project, this.system, this.reporter);
        // @ts-ignore FIXME: Implement watch mode
        const config = ts.createWatchProgram(host);
        // injectTransformers(host, this.getTransformers(config.getProgram().getProgram()));
    }

    protected emitSourceFile(fileName: string, target: string, writeFile = false): CompileFragment {
        // FIXME: CompilationContext <=> LanguageServiceHost <=> CompilationTarget
        const filePath = resolve(fileName);
        const ctx = this.contextMap.get(target);
        const cache = ctx?.getCache();

        if (ctx && cache) {
            if (!cache.hasChanged(filePath, target)) {
                return cache.getCachedFile(filePath, target);
            }
            let content = this.system.readFile(fileName) ?? "";
            ctx.getPreEmitTransformers().forEach(it => (content = it(fileName, content)));
            cache.updateSource(filePath, content, target);
            this.compilationHost.setLanguageHost(ctx.getLanguageHost());

            const output = this.langService.getEmitOutput(fileName);
            if (!output.emitSkipped) {
                cache.updateOutput(fileName, output.outputFiles);

                if (writeFile) {
                    this.writeOutputFiles(output);
                }
                return { version: cache.getVersion(fileName), files: output.outputFiles };
            }
        }

        return { version: 0, files: this.langService.getEmitOutput(fileName).outputFiles };
    }

    protected parse(fileNames?: string[]): Project {
        const { options, fileNames: globalFileNames } = this.options.tsconfig;

        return createParser({ compilerOptions: options, filePaths: globalFileNames, system: this.system })(fileNames);
    }

    // protected emit(program: ts.Program): ts.EmitResult {
    //     const result: any = program.emit(
    //         undefined /* target source file */,
    //         (fileName, content) => {
    //             this.system.writeFile(fileName, `/* @generated */${this.system.newLine}${content}`);
    //         },
    //         undefined /* cancellation token */,
    //         false /* emit d.ts files only */,
    //         this.getTransformers(program)
    //     );
    //     (this.getGenerators().docs ?? [])
    //         .map(cur => this.tryEmit(() => cur.emit(program, this.system)))
    //         .forEach(cur => {
    //             result.diagnostics = concat(result.diagnostics, cur.diagnostics);
    //             result.emitSkipped = result.emitSkipped === true || cur.emitSkipped === true;
    //             result.emittedFiles = concat(result.emittedFiles, cur.emittedFiles);
    //         });

    //     return result;
    // }

    protected report(program: ts.Program, result: ts.EmitResult): ts.EmitResult {
        ts.getPreEmitDiagnostics(program)
            .concat(result.diagnostics)
            .forEach(cur => this.reporter.reportDiagnostic(cur));

        return result;
    }

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
        return this.options.tsconfig.fileNames
            ? this.options.tsconfig.fileNames
            : recursiveFindByFilter(resolve(dirname(this.configPath), "./src"), (path: string) => path.endsWith(".ts"));
    }

    private writeOutputFiles(emitOutput: ts.EmitOutput) {
        for (const cur of emitOutput.outputFiles) {
            const filename = this.getFilePath(cur.name);
            const target = dirname(filename);
            if (!this.system.directoryExists(target)) {
                this.system.createDirectory(target);
            }
            this.system.writeFile(filename, cur.text);
        }
    }

    private getFilePath(fileName: string): string {
        const projectDir = dirname(this.options.buildDir);
        const basePath = this.getBasePath(fileName, projectDir);
        const outDir = this.options.project.outDir;
        if (!outDir) {
            return !isAbsolute(fileName) ? join(basePath, fileName) : fileName;
        }
        return fileName.includes(outDir) ? fileName : fileName.replace(basePath, resolve(projectDir, outDir));
    }

    private getBasePath(fileName: string, projectDir: string): string {
        return Object.keys(this.options.project.wildcardDirectories ?? {}).find(it => fileName.includes(it)) ?? projectDir;
    }
}

const getCompilationOptions = (target: string, config: CompilerConfig = {}): CompilationOptions => {
    const { targets = {} } = config;
    return targets[target] ?? {};
};
