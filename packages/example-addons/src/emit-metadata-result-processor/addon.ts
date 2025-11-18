/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type AddonContext, type ResultProcessor } from "@quatico/websmith-api";
import path from "node:path";

export interface EmitMetadataConfig {
    /**
     * Output file name for the metadata (default: "emit-metadata.json")
     */
    outputFile?: string;
    /**
     * Include file content in metadata (default: false)
     */
    includeContent?: boolean;
}

/**
 * Example addon that generates metadata about emitted files using a result processor.
 *
 * This demonstrates the proper use of ResultProcessors with addonEmitOnly mode:
 * - ResultProcessors receive only the files that were actually emitted
 * - When addonEmitOnly is enabled, only addon-processed files are included
 * - ResultProcessors have access to AddonContext for file system operations
 * - Generated metadata files are written directly to the output directory
 *
 * @param ctx The addon context for the compilation.
 */
export const activate = (ctx: AddonContext<EmitMetadataConfig>): void => {
    const profileConfig = ctx.getProfileConfig();

    // Handle both flat config and nested config with addon name as key
    const addonConfig = (profileConfig as Record<string, EmitMetadataConfig>)?.["emit-metadata-result-processor"] ?? profileConfig;

    const outputFile = addonConfig?.outputFile ?? "emit-metadata.json";
    const includeContent = addonConfig?.includeContent ?? false;

    const resultProcessor: ResultProcessor = (emittedFiles: string[], processorCtx: AddonContext): void => {
        const system = processorCtx.getSystem();
        const compilerOptions = processorCtx.getCompilerOptions();
        const outDir = compilerOptions.outDir;

        if (!outDir) {
            return; // No output directory specified
        }

        // Create metadata for each emitted file
        const metadata = emittedFiles.map(filePath => {
            const fileName = path.basename(filePath);
            const fileInfo: Record<string, unknown> = {
                path: filePath,
                name: fileName,
                size: system.fileExists(filePath) ? system.readFile(filePath)?.length ?? 0 : 0,
            };

            // Optionally include file content
            if (includeContent && system.fileExists(filePath)) {
                fileInfo.content = system.readFile(filePath);
            }

            return fileInfo;
        });

        // Generate metadata JSON
        const metadataContent = JSON.stringify(
            {
                timestamp: new Date().toISOString(),
                totalFiles: emittedFiles.length,
                files: metadata,
            },
            null,
            2
        );

        // Write metadata file to output directory
        const metadataPath = path.join(outDir, outputFile);
        system.writeFile(metadataPath, metadataContent);
    };

    ctx.registerResultProcessor(resultProcessor);
};
