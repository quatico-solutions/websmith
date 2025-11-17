/*
 * ---------------------------------------------------------------------------------------------
 *   Copyright (c) Quatico Solutions AG. All rights reserved.
 *   Licensed under the MIT License. See LICENSE in the project root for license information.
 * ---------------------------------------------------------------------------------------------
 */
import { type AddonContext, type Processor } from "@quatico/websmith-api";
import path from "path";

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
 * - Return unchanged content for non-matching files (won't be marked as addon-processed)
 * - Use simple string replacement (not AST transformation)
 * - Perfect for addonEmitOnly mode where only modified files should be emitted
 *
 * @param ctx The addon context for the compilation.
 */
export const activate = (ctx: AddonContext): void => {
    const profileConfig = ctx.getProfileConfig() as any;
    const config = profileConfig?.["selective-processor"] as SelectiveProcessorConfig | undefined;
    const filePattern = config?.filePattern;
    const matchPattern = config?.matchPattern ? new RegExp(config.matchPattern, "gi") : /foobar/gi;
    const replacement = config?.replacement ?? "barfoo";

    const processor: Processor = (fileName: string, content: string): string => {
        // If filePattern is specified, only process files matching the pattern
        if (filePattern) {
            const basename = path.basename(fileName);
            if (!basename.includes(filePattern)) {
                return content; // Return unchanged - won't be marked as addon-processed
            }
        }

        // Simple string replacement (not AST transformation)
        return content.replace(matchPattern, replacement);
    };

    ctx.registerProcessor(processor);
};
