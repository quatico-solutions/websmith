/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { CompilationContext, type CompilationContextOptions } from "@quatico/websmith-core";
import { type AddonOutputs } from "./addon-outputs";

const UNKNOWN_ADDON = "unknown addon";

/**
 * The addon context of the Vite plugin's profile. Generators, processors, transformers and result processors run as in
 * the CLI and the webpack loader; the methods that reach the bundle map to Rollup through `AddonOutputs`:
 * `addInputFile` and `addAssetDependency` watch their file, `addVirtualFile` emits an asset of the bundle and
 * `removeOutputFile` deletes a bundle file, both in `generateBundle`.
 */
export class ViteAddonContext extends CompilationContext {
    private runningAddon?: string;

    constructor(
        options: CompilationContextOptions,
        private readonly outputs: AddonOutputs
    ) {
        super(options);
        // A new context activates its addons again, which replaces what they added on their last activation
        outputs.startActivation();
    }

    /** Adds a code file to the root files, as in the CLI, and watches it. */
    public addInputFile(filePath: string): void {
        super.addInputFile(filePath);
        if (this.isCodeFileExtension(filePath)) {
            this.outputs.addWatchFile(this.resolvePath(filePath), "addInputFile", this.getRunningAddon());
        }
    }

    /** Watches a non-code file, so an edit rebuilds; a code file is an error. */
    public addAssetDependency(childPath: string, parentPath: string): void {
        super.addAssetDependency(childPath, parentPath);
        if (!this.isCodeFileExtension(childPath)) {
            this.outputs.addWatchFile(this.resolvePath(childPath), "addAssetDependency", this.getRunningAddon());
        }
    }

    /** Adds a file of any extension to the bundle, at a path relative to `build.outDir`. */
    public addVirtualFile(filePath: string, fileContent: string): void {
        this.outputs.addVirtualFile(filePath, fileContent, this.getRunningAddon());
    }

    /** Deletes a file from the bundle, at a path relative to `build.outDir`. */
    public removeOutputFile(filePath: string): void {
        this.outputs.removeOutputFile(filePath, this.getRunningAddon());
    }

    public runAsAddon<T>(addonName: string, fn: () => T): T {
        const previous = this.runningAddon;
        try {
            this.runningAddon = addonName;
            return super.runAsAddon(addonName, fn);
        } finally {
            this.runningAddon = previous;
        }
    }

    private getRunningAddon(): string {
        return this.runningAddon ?? UNKNOWN_ADDON;
    }
}
