/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type AddonContext, type Processor } from "@quatico/websmith-api";
import path from "node:path";

export interface SelectiveProcessorConfig {
    /**
     * Pattern to match in the filename (e.g., "arrow" will process "foobar-arrow.ts")
     * If empty or undefined, all files will be processed
     */
    filePattern?: string;
    /**
     * Regex pattern to replace in the code (default: /foobar/gi)
     */
    matchPattern?: string;
    /**
     * Replacement string (default: "barfoo")
     */
    replacement?: string;
}

/**
 * Example addon that conditionally processes files based on filename patterns.
 *
 * This demonstrates the proper use of Processors for selective string manipulation:
 * - Processors operate on source code strings before TypeScript compilation
 * - Return modified content to trigger automatic processing detection
 * - Files that don't match the pattern return the original content unchanged
 * - Use simple string replacement (not AST transformation)
 * - Perfect for addonEmitOnly mode where only modified files should be emitted
 *
 * @param ctx The addon context for the compilation.
 */
export const activate = (ctx: AddonContext<SelectiveProcessorConfig>): void => {
    const profileConfig = ctx.getProfileConfig();

    // Handle both flat config and nested config with addon name as key
    const addonConfig = (profileConfig as Record<string, SelectiveProcessorConfig>)?.["selective-processor"] ?? profileConfig;

    const filePattern = addonConfig?.filePattern;
    const matchPattern = addonConfig?.matchPattern ? new RegExp(addonConfig.matchPattern, "gi") : /foobar/gi;
    const replacement = addonConfig?.replacement ?? "barfoo";

    const processor: Processor = (fileName: string, content: string): string => {
        // If filePattern is specified, only process files matching the pattern
        if (filePattern) {
            const basename = path.basename(fileName);
            if (!basename.includes(filePattern)) {
                return content; // Return original content for non-matching files
            }
        }

        // Simple string replacement (not AST transformation)
        // Framework automatically detects content change and marks file as processed
        return content.replace(matchPattern, replacement);
    };

    ctx.registerProcessor(processor);
};
