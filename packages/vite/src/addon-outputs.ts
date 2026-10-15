/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { ErrorMessage, type Reporter, WarnMessage } from "@quatico/websmith-api";
import path from "node:path";
import type { Rollup } from "vite";

/** The part of Rollup's plugin context that an addon context method needs while a hook runs. */
export type OutputsContext = Pick<Rollup.PluginContext, "addWatchFile">;

/** The part of Rollup's plugin context that `generateBundle` needs. */
export type BundleContext = Pick<Rollup.PluginContext, "emitFile">;

/** The `AddonContext` method an entry or a watch file comes from, named in the diagnostics. */
export type AddonOutputMethod = "addInputFile" | "addAssetDependency" | "addVirtualFile" | "removeOutputFile";

type ModuleEntries = { virtualFiles: Map<string, string>; removals: Map<string, string> };

// The key of the entries made outside a transform and outside an activation, e.g. by a result processor
const BUILD_ENTRIES = "\0build";
// The key of the entries made on activation, which stay until the addons activate again
const ACTIVATION_ENTRIES = "\0activation";

const createEntries = (): ModuleEntries => ({ virtualFiles: new Map(), removals: new Map() });

/**
 * Bridges the addon contexts and Rollup: forwards watch files to the hook that runs, and keeps the virtual files and
 * removals of the addons per module until `generateBundle` applies them. Rollup's watch cache skips modules that did
 * not change, so a module's entries stay until it is built again. Addons stay active across watch rebuilds, so what
 * they add on activation stays until they activate again, and its watch files are added to every build.
 */
export class AddonOutputs {
    private context?: OutputsContext;
    private moduleId?: string;
    private activating = false;
    private outDir = "";
    private command: "build" | "serve" = "build";
    private readonly entries = new Map<string, ModuleEntries>();
    private readonly activationWatchFiles = new Set<string>();

    constructor(private readonly reporter: Reporter) {}

    /** Sets Vite's resolved `build.outDir`, which bundle file names are relative to, and the command. */
    public configure({ outDir, command }: { outDir: string; command: "build" | "serve" }): void {
        this.outDir = outDir;
        this.command = command;
    }

    /** Runs `fn` while `context` is the running hook, transforming `moduleId` if given, and restores the previous one. */
    public run<T>(context: OutputsContext, moduleId: string | undefined, fn: () => T): T {
        const previous = { context: this.context, moduleId: this.moduleId };
        try {
            this.context = context;
            this.moduleId = moduleId;
            return fn();
        } finally {
            this.context = previous.context;
            this.moduleId = previous.moduleId;
        }
    }

    /**
     * Runs `fn`, which creates the compiler or refreshes its addons, while `context` is the running hook: what the
     * addons add while they activate stays until `startActivation`. Then adds the watch files of the last activation
     * to `context`, since a watch rebuild that activates no addon would drop them.
     */
    public runActivation<T>(context: OutputsContext, fn: () => T): T {
        const previous = this.activating;
        try {
            this.activating = true;
            return this.run(context, undefined, fn);
        } finally {
            this.activating = previous;
            this.activationWatchFiles.forEach(cur => context.addWatchFile(cur));
        }
    }

    /** Drops the entries and watch files of the last activation, before the addons activate again. */
    public startActivation(): void {
        this.entries.delete(ACTIVATION_ENTRIES);
        this.activationWatchFiles.clear();
    }

    /** Drops the entries of `moduleId` before it is built again. */
    public startModule(moduleId: string): void {
        this.entries.delete(moduleId);
    }

    /** Drops the entries made outside a transform and outside an activation before a build starts. */
    public startBuild(): void {
        this.entries.delete(BUILD_ENTRIES);
    }

    /** Adds `filePath` to the watch files of the running hook; reports an error when no hook runs. */
    public addWatchFile(filePath: string, method: AddonOutputMethod, addon: string): void {
        if (!this.context) {
            this.reporter.reportDiagnostic(
                new ErrorMessage(`${method} of addon "${addon}" was called outside a Vite build hook: '${filePath}' is not watched`)
            );
            return;
        }
        if (this.activating) {
            this.activationWatchFiles.add(filePath);
        }
        this.context.addWatchFile(filePath);
    }

    /** Records an asset for the bundle; a file added twice keeps the last content. */
    public addVirtualFile(filePath: string, content: string, addon: string): void {
        const fileName = this.toBundleFileName(filePath, "addVirtualFile", addon);
        if (fileName !== undefined) {
            this.getEntries().virtualFiles.set(fileName, content);
        }
    }

    /** Records the removal of a bundle file, which also drops a virtual file of that name. */
    public removeOutputFile(filePath: string, addon: string): void {
        const fileName = this.toBundleFileName(filePath, "removeOutputFile", addon);
        if (fileName !== undefined) {
            this.getEntries().removals.set(fileName, addon);
        }
    }

    /**
     * Returns the bundle file name of `filePath`: a relative path as written, relative to `build.outDir`, an absolute
     * path inside `build.outDir` relative to it. Reports an error and returns undefined for a path outside it.
     */
    public toBundleFileName(filePath: string, method: AddonOutputMethod, addon: string): string | undefined {
        const normalized = filePath.replace(/\\/g, "/");
        const fileName = path.isAbsolute(normalized) ? path.relative(this.outDir, normalized).replace(/\\/g, "/") : path.posix.normalize(normalized);
        // "" and "." name build.outDir itself, which is no file of the bundle
        if (["", ".", ".."].includes(fileName) || fileName.startsWith("../") || path.isAbsolute(fileName)) {
            const action = method === "removeOutputFile" ? `remove '${filePath}' from` : `place '${filePath}' in`;
            this.reporter.reportDiagnostic(
                new ErrorMessage(`${method} of addon "${addon}" cannot ${action} the bundle: it is outside build.outDir '${this.outDir}'`)
            );
            return undefined;
        }
        return fileName;
    }

    /**
     * Applies the entries of `moduleIds`, of the last activation and those made outside a transform to `bundle` in a
     * build: emits the virtual files as assets, then deletes the removed files, warning for a file the bundle does not
     * hold. The dev server keeps them in memory only.
     */
    public generateBundle(context: BundleContext, bundle: Record<string, unknown>, moduleIds: Iterable<string>): void {
        if (this.command !== "build") {
            return;
        }
        const virtualFiles = new Map<string, string>();
        const removals = new Map<string, string>();
        [ACTIVATION_ENTRIES, ...moduleIds, BUILD_ENTRIES]
            .map(cur => this.entries.get(cur))
            .filter(cur => cur !== undefined)
            .forEach(cur => {
                cur.virtualFiles.forEach((content, fileName) => virtualFiles.set(fileName, content));
                cur.removals.forEach((addon, fileName) => removals.set(fileName, addon));
            });
        const removedVirtualFiles = [...removals.keys()].filter(cur => virtualFiles.delete(cur));
        virtualFiles.forEach((source, fileName) => context.emitFile({ type: "asset", fileName, source }));
        removals.forEach((addon, fileName) => {
            if (Object.hasOwn(bundle, fileName)) {
                delete bundle[fileName];
            } else if (!removedVirtualFiles.includes(fileName)) {
                this.reporter.reportDiagnostic(new WarnMessage(`removeOutputFile of addon "${addon}" found no '${fileName}' in the bundle`));
            }
        });
    }

    private getEntries(): ModuleEntries {
        const key = this.activating ? ACTIVATION_ENTRIES : (this.moduleId ?? BUILD_ENTRIES);
        let entries = this.entries.get(key);
        if (!entries) {
            entries = createEntries();
            this.entries.set(key, entries);
        }
        return entries;
    }
}
