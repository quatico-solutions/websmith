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

import ts, { CompilerOptions, IScriptSnapshot, LanguageServiceHost } from "typescript";

export class CompilationHost implements LanguageServiceHost {
    private currentHost: LanguageServiceHost;

    constructor(defaultHost: LanguageServiceHost) {
        this.currentHost = defaultHost;
    }

    public setLanguageHost(host: LanguageServiceHost): this {
        this.currentHost = host;
        return this;
    }

    public getNewLine(): string {
        if (!this.currentHost.getNewLine) {
            return ts.sys.newLine;
        }
        return this.currentHost.getNewLine();
    }

    public fileExists(path: string): boolean {
        if (!this.currentHost.fileExists) {
            return ts.sys.fileExists(path);
        }
        return this.currentHost.fileExists(path);
    }

    public readFile(path: string, encoding?: string): string | undefined {
        if (!this.currentHost.readFile) {
            return ts.sys.readFile(path, encoding);
        }
        return this.currentHost.readFile(path, encoding);
    }

    public readDirectory(
        path: string,
        extensions?: readonly string[],
        exclude?: readonly string[],
        include?: readonly string[],
        depth?: number
    ): string[] {
        if (!this.currentHost.readDirectory) {
            return ts.sys.readDirectory(path, extensions, exclude, include, depth);
        }
        return this.currentHost.readDirectory(path, extensions, exclude, include, depth);
    }

    public directoryExists(directoryName: string): boolean {
        if (!this.currentHost.directoryExists) {
            return ts.sys.directoryExists(directoryName);
        }
        return this.currentHost.directoryExists(directoryName);
    }

    public getDirectories(directoryName: string): string[] {
        if (!this.currentHost.getDirectories) {
            return ts.sys.getDirectories(directoryName);
        }
        return this.currentHost.getDirectories(directoryName);
    }

    public getCompilationSettings(): CompilerOptions {
        return this.currentHost.getCompilationSettings();
    }

    /**
     *  Get root files by default
     * @returns
     */
    public getScriptFileNames(): string[] {
        return this.currentHost.getScriptFileNames();
    }

    public getScriptVersion(fileName: string): string {
        return this.currentHost.getScriptVersion(fileName);
    }

    public getScriptSnapshot(fileName: string): IScriptSnapshot | undefined {
        return this.currentHost.getScriptSnapshot(fileName);
    }

    public getCurrentDirectory(): string {
        return this.currentHost.getCurrentDirectory();
    }

    public getDefaultLibFileName(options: CompilerOptions): string {
        return this.currentHost.getDefaultLibFileName(options);
    }

    public getCustomTransformers(): ts.CustomTransformers | undefined {
        return this.currentHost.getCustomTransformers?.();
    }
}
