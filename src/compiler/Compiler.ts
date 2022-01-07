/*
 * @license
 *
 * Copyright (c) 2017-2021 Quatico Solutions AG
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
import ts from "typescript";
import { createSystem, createWatchHost, injectTransformers } from "../environment";
import { CompilerAddon, CompilerOptions, fromGenerator, InfoMessage, Reporter, Transformer } from "../model";
import { AddonRegistry, createResolver, CustomGenerators } from "./addon-registry";
import { concat } from "./collections";
import { createConfig } from "./Config";
import { DefaultReporter } from "./DefaultReporter";
import { createParser, Project } from "./Parser";
import { createProcessorTransformer } from "./processor-transformer";
import { createStyleCompiler } from "./style-compiler";

export class Compiler {
    private config!: ts.ParsedCommandLine;
    private configPath: string;
    private reporter: Reporter;
    private system: ts.System;
    private addons: AddonRegistry;
    private compileImportedStyles: Transformer;

    constructor(options: CompilerOptions) {
        // TODO: Add extra compiler options, additional to tsconfig.json
        this.configPath = options.configPath;
        this.system = options.system ?? createSystem(options.libFiles);
        this.reporter = options.reporter ?? new DefaultReporter(this.system);
        this.addons = new AddonRegistry(options, this.reporter, this.system);
        this.config = this.parseConfig(this.configPath);

        this.compileImportedStyles = createStyleCompiler(
            { sassOptions: options.sassOptions, reporter: this.reporter, system: this.system },
            this.addons.styleTransformers
        );
    }

    public getAddonRegistry() {
        return this.addons;
    }

    public getSystem(): ts.System {
        return this.system;
    }

    public getOptions(): ts.CompilerOptions {
        return this.config.options;
    }

    public setOptions(options: ts.CompilerOptions): this {
        this.config.options = options;
        return this;
    }

    public compile(...fileNames: string[]): ts.EmitResult {
        const { program, stylePaths } = this.parse(fileNames);

        // FIXME: Add style processors here to generate docs
        // eslint-disable-next-line no-console
        stylePaths.filter(cur => cur.endsWith(".scss")).forEach(cur => console.log(`Style: ${cur}`));

        const result = this.emit(program);
        return this.report(program, result);
    }

    public watch() {
        const { filePaths } = this.parse();
        const host = createWatchHost(filePaths, this.config.options, this.system, this.reporter);
        const config = ts.createWatchProgram(host);
        injectTransformers(host, this.getTransformers(config.getProgram().getProgram()));
    }

    public enableAddons(...names: string[]): this {
        const addons = createResolver(this.reporter, this.system)(names);
        const addonNames: string[] = [];
        addons.forEach((addon: CompilerAddon) => {
            addon.activate(this.addons);
            addonNames.push(addon.name);
        });
        this.reporter.reportWatchStatus(new InfoMessage(`  + Addons: [${addonNames.map(cur => `"${cur}"`).join(", ")}]\n\n\n`));
        return this;
    }

    protected parseConfig(configFilePath: string): ts.ParsedCommandLine | never {
        return createConfig(configFilePath, this.system);
    }

    protected parse(fileNames?: string[]): Project {
        const { options, fileNames: globalFileNames } = this.config;

        return createParser({ compilerOptions: options, filePaths: globalFileNames, system: this.system })(fileNames);
    }

    protected emit(program: ts.Program): ts.EmitResult {
        const result: any = program.emit(
            undefined /* target source file */,
            (fileName, content) => {
                this.system.writeFile(fileName, `/* @generated */${this.system.newLine}${content}`);
            },
            undefined /* cancellation token */,
            false /* emit d.ts files only */,
            this.getTransformers(program)
        );
        (this.getGenerators().docs ?? [])
            .map(cur => this.tryEmit(() => cur.emit(program, this.system)))
            .forEach(cur => {
                result.diagnostics = concat(result.diagnostics, cur.diagnostics);
                result.emitSkipped = result.emitSkipped === true || cur.emitSkipped === true;
                result.emittedFiles = concat(result.emittedFiles, cur.emittedFiles);
            });

        return result;
    }

    protected report(program: ts.Program, result: ts.EmitResult): ts.EmitResult {
        ts.getPreEmitDiagnostics(program)
            .concat(result.diagnostics)
            .forEach(cur => this.reporter.reportDiagnostic(cur));

        return result;
    }

    protected getTransformers(program: ts.Program): ts.CustomTransformers {
        return {
            ...this.addons.transformers,
            before: [
                this.compileImportedStyles,
                createProcessorTransformer(this.addons.processors),
                ...(this.getGenerators().docs ?? []).map(cur => fromGenerator(cur, program)),
                ...(this.addons.transformers.before || []),
            ],
        };
    }

    protected getGenerators(): CustomGenerators {
        return this.addons.generators ?? {};
    }

    private tryEmit(emit: () => ts.EmitResult): ts.EmitResult {
        try {
            return emit();
        } catch (err) {
            return {
                diagnostics: [
                    {
                        category: 1 /* Error */,
                        code: 0,
                        file: undefined,
                        length: 0,
                        messageText: err.message,
                        start: 0,
                    },
                ],
                emitSkipped: true,
            };
        }
    }
}
