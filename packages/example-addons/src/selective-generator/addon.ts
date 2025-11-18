/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type AddonContext, type Generator } from "@quatico/websmith-api";
import path from "node:path";

export interface SelectiveGeneratorConfig {
    /**
     * Pattern to match in the filename (e.g., "service" will process "user-service.ts")
     * If empty or undefined, all files will be processed
     */
    filePattern?: string;
    /**
     * Suffix to add to generated files (default: ".generated")
     */
    generatedSuffix?: string;
}

/**
 * Example addon that conditionally generates additional files based on filename patterns.
 *
 * This demonstrates the proper use of Generators for selective file generation:
 * - Generators create additional source files during compilation
 * - Can be selective based on filename patterns
 * - Generated files and source files are marked as addon-processed
 * - Perfect for addonEmitOnly mode where only generated files should be emitted
 *
 * @param ctx The addon context for the compilation.
 */
export const activate = (ctx: AddonContext<SelectiveGeneratorConfig>): void => {
    const profileConfig = ctx.getProfileConfig();

    // Handle both flat config and nested config with addon name as key
    const addonConfig = (profileConfig as Record<string, SelectiveGeneratorConfig>)?.["selective-generator"] ?? profileConfig;

    const filePattern = addonConfig?.filePattern;
    const generatedSuffix = addonConfig?.generatedSuffix ?? ".generated";

    const generator: Generator = (fileName: string, _content: string): void => {
        // Skip files that are already generated to prevent infinite loops
        if (fileName.includes(generatedSuffix)) {
            return;
        }

        // If filePattern is specified, only generate for files matching the pattern
        if (filePattern) {
            const basename = path.basename(fileName);
            if (!basename.includes(filePattern)) {
                return; // Skip generation for non-matching files
            }
        }

        // Generate a companion file with metadata about the original file
        const dir = path.dirname(fileName);
        const baseName = path.basename(fileName, path.extname(fileName));
        const generatedFileName = path.join(dir, `${baseName}${generatedSuffix}.ts`);

        const generatedContent = `/*
            * AUTO-GENERATED FILE - DO NOT EDIT
            * Generated from: ${path.basename(fileName)}
            */

            export const metadata = {
                sourceFile: "${path.basename(fileName)}",
                generated: true,
                timestamp: "${new Date().toISOString()}",
            };

            export { ${baseName} } from "./${baseName}";
        `;

        // Add the generated file to the compilation
        ctx.addVirtualFile(generatedFileName, generatedContent);
    };

    ctx.registerGenerator(generator);
};
